import { Component, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Subscription } from "rxjs";
import { LongPollingService } from "./long-polling.service";
import { OrdersApiService } from "../../services/orders-api.service";
import { CurrentOrderService } from "../../services/current-order.service";
import { OrderSnapshot, OrderStatusValue } from "../../types/order";
import { StatusTimelineComponent } from "../../components/status-timeline/status-timeline.component";
import { EventLogComponent, LogRow } from "../../components/event-log/event-log.component";

interface LongPollingMetrics {
  requests: number;
  changes: number;
}

const EMPTY_METRICS: LongPollingMetrics = { requests: 0, changes: 0 };
const MAX_ROWS = 8;

@Component({
  selector: "app-long-polling-panel",
  standalone: true,
  imports: [CommonModule, StatusTimelineComponent, EventLogComponent],
  templateUrl: "./long-polling-panel.component.html",
})
export class LongPollingPanelComponent implements OnDestroy {
  orderId: string | null = null;
  status: OrderStatusValue | null = null;
  done = false;
  rows: LogRow[] = [];
  metrics: LongPollingMetrics = EMPTY_METRICS;
  running = false;
  summary: string | null = null;

  private orderSub: Subscription;
  private requestSub?: Subscription;
  private lastSeq = 0;
  private stopped = true;

  constructor(
    private longPollingService: LongPollingService,
    private ordersApi: OrdersApiService,
    private currentOrder: CurrentOrderService
  ) {
    this.orderSub = this.currentOrder.orderId$.subscribe((orderId) => {
      this.orderId = orderId;
      this.resetRun();
    });
  }

  ngOnDestroy(): void {
    this.orderSub.unsubscribe();
    this.requestSub?.unsubscribe();
    this.stopped = true;
  }

  toggle(): void {
    if (this.running) {
      this.stop();
    } else {
      this.start();
    }
  }

  newOrder(): void {
    void this.currentOrder.startNewOrder();
  }

  advanceNow(): void {
    if (this.orderId) {
      this.ordersApi.advance(this.orderId).subscribe();
    }
  }

  private resetRun(): void {
    this.requestSub?.unsubscribe();
    this.stopped = true;
    this.running = false;
    this.status = null;
    this.done = false;
    this.rows = [];
    this.metrics = EMPTY_METRICS;
    this.summary = null;
    this.lastSeq = 0;
  }

  private start(): void {
    if (!this.orderId) {
      return;
    }
    this.running = true;
    this.stopped = false;
    this.loop();
  }

  private stop(): void {
    this.running = false;
    this.stopped = true;
    this.requestSub?.unsubscribe();
  }

  private loop(): void {
    if (this.stopped || !this.orderId) {
      return;
    }
    this.requestSub = this.longPollingService.longPoll(this.orderId, this.lastSeq).subscribe({
      next: (snapshot) => this.handleSnapshot(snapshot),
      error: () => {
        if (this.stopped) {
          return;
        }
        setTimeout(() => this.loop(), 1000);
      },
    });
  }

  private handleSnapshot(snapshot: OrderSnapshot): void {
    const changed = snapshot.seq !== this.lastSeq;
    this.lastSeq = snapshot.seq;

    this.metrics = {
      requests: this.metrics.requests + 1,
      changes: this.metrics.changes + (changed ? 1 : 0),
    };
    this.status = snapshot.status;
    this.done = snapshot.done;

    const newRow: LogRow = {
      key: `${snapshot.seq}-${Date.now()}`,
      primary: changed ? snapshot.status : "sem novidade — servidor devolveu no timeout",
      secondary: new Date(snapshot.updatedAt).toLocaleTimeString(),
      tone: changed ? "changed" : "marker",
    };
    this.rows = [newRow, ...this.rows].slice(0, MAX_ROWS);

    if (snapshot.done) {
      this.stop();
      this.summary = `${this.metrics.requests} requests para capturar ${this.metrics.changes} mudanças — cada uma só voltou quando teve novidade ou estourou o timeout do servidor.`;
      return;
    }

    if (!this.stopped) {
      this.loop();
    }
  }
}
