import { Component, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Subscription } from "rxjs";
import { OrdersApiService } from "../../services/orders-api.service";
import { CurrentOrderService } from "../../services/current-order.service";
import { OrderSnapshot, OrderStatusValue } from "../../types/order";
import { StatusTimelineComponent } from "../../components/status-timeline/status-timeline.component";
import { MetricsBarComponent } from "../../components/metrics-bar/metrics-bar.component";
import { EventLogComponent, LogRow } from "../../components/event-log/event-log.component";
import { SelectComponent } from "../../components/select/select.component";

interface PollingMetrics {
  requests: number;
  unchanged: number;
  changes: number;
  lastChangeDelayMs: number | null;
}

const EMPTY_METRICS: PollingMetrics = { requests: 0, unchanged: 0, changes: 0, lastChangeDelayMs: null };
const MAX_ROWS = 8;
const INTERVAL_OPTIONS = [
  { label: "1s", value: 1000 },
  { label: "3s", value: 3000 },
  { label: "5s", value: 5000 },
];
const AUTO_ADVANCE_MS = 10000;

@Component({
  selector: "app-polling-panel",
  standalone: true,
  imports: [CommonModule, StatusTimelineComponent, MetricsBarComponent, EventLogComponent, SelectComponent],
  templateUrl: "./polling-panel.component.html",
})
export class PollingPanelComponent implements OnDestroy {
  readonly intervalOptions = INTERVAL_OPTIONS;

  orderId: string | null = null;
  intervalMs = 5000;
  status: OrderStatusValue | null = null;
  done = false;
  rows: LogRow[] = [];
  metrics: PollingMetrics = EMPTY_METRICS;
  running = false;
  summary: string | null = null;

  private orderSub: Subscription;
  private pollSub?: Subscription;
  private autoAdvanceTimer?: ReturnType<typeof setInterval>;
  private lastSeq: number | null = null;
  private delaySum = 0;

  constructor(
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
    this.pollSub?.unsubscribe();
    this.stopAutoAdvance();
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

  onIntervalChange(value: number): void {
    this.intervalMs = value;
    if (this.running) {
      this.stop();
      this.start();
    }
  }

  private stopAutoAdvance(): void {
    if (this.autoAdvanceTimer !== undefined) {
      clearInterval(this.autoAdvanceTimer);
      this.autoAdvanceTimer = undefined;
    }
  }

  private startAutoAdvance(): void {
    this.stopAutoAdvance();
    this.autoAdvanceTimer = setInterval(() => {
      if (this.orderId) {
        this.ordersApi.advance(this.orderId).subscribe();
      }
    }, AUTO_ADVANCE_MS);
  }

  private resetRun(): void {
    this.pollSub?.unsubscribe();
    this.stopAutoAdvance();
    this.running = false;
    this.status = null;
    this.done = false;
    this.rows = [];
    this.metrics = EMPTY_METRICS;
    this.summary = null;
    this.lastSeq = null;
    this.delaySum = 0;
  }

  private start(): void {
    if (!this.orderId) {
      return;
    }
    this.running = true;
    this.pollSub = this.ordersApi
      .watch(this.orderId, this.intervalMs)
      .subscribe((snapshot) => this.handleSnapshot(snapshot));
    this.startAutoAdvance();
  }

  private stop(): void {
    this.running = false;
    this.pollSub?.unsubscribe();
    this.stopAutoAdvance();
  }

  private handleSnapshot(snapshot: OrderSnapshot): void {
    const changed = this.lastSeq !== snapshot.seq;
    this.lastSeq = snapshot.seq;

    const arrivedAt = Date.now();
    const delayMs = changed ? arrivedAt - new Date(snapshot.updatedAt).getTime() : null;
    if (changed && delayMs !== null) {
      this.delaySum += delayMs;
    }

    this.metrics = {
      requests: this.metrics.requests + 1,
      unchanged: this.metrics.unchanged + (changed ? 0 : 1),
      changes: this.metrics.changes + (changed ? 1 : 0),
      lastChangeDelayMs: changed ? delayMs : this.metrics.lastChangeDelayMs,
    };

    this.status = snapshot.status;
    this.done = snapshot.done;
    const newRow: LogRow = {
      key: `${snapshot.seq}-${arrivedAt}`,
      primary: snapshot.status,
      secondary: new Date(snapshot.updatedAt).toLocaleTimeString(),
      tone: changed ? "changed" : "unchanged",
    };
    this.rows = [newRow, ...this.rows].slice(0, MAX_ROWS);

    if (snapshot.done) {
      this.stop();
      const wastePercent =
        this.metrics.requests > 0 ? Math.round((this.metrics.unchanged / this.metrics.requests) * 100) : 0;
      const avgDelaySeconds = this.metrics.changes > 0 ? this.delaySum / this.metrics.changes / 1000 : 0;
      this.summary = `${this.metrics.requests} requests para capturar ${this.metrics.changes} mudanças — ${wastePercent}% foram desperdício. Atraso médio: ${avgDelaySeconds.toFixed(1)}s.`;
    }
  }
}
