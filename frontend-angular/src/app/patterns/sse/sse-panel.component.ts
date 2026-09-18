import { Component, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Subscription } from "rxjs";
import { SseService } from "./sse.service";
import { OrdersApiService } from "../../services/orders-api.service";
import { CurrentOrderService } from "../../services/current-order.service";
import { DevService } from "./dev.service";
import { OrderStatusValue } from "../../types/order";
import { ConnectionState } from "../../types/connection";
import { StatusTimelineComponent } from "../../components/status-timeline/status-timeline.component";
import { ConnectionBadgeComponent } from "../../components/connection-badge/connection-badge.component";
import { EventLogComponent, LogRow } from "../../components/event-log/event-log.component";

const MAX_ROWS = 8;
const RETRY_SECONDS = 3;
const AUTO_ADVANCE_MS = 5000;

@Component({
  selector: "app-sse-panel",
  standalone: true,
  imports: [CommonModule, StatusTimelineComponent, ConnectionBadgeComponent, EventLogComponent],
  templateUrl: "./sse-panel.component.html",
})
export class SsePanelComponent implements OnDestroy {
  orderId: string | null = null;
  status: OrderStatusValue | null = null;
  done = false;
  connectionState: ConnectionState = "desconectado";
  lastEventId: number | null = null;
  attempt = 0;
  retryInSeconds = RETRY_SECONDS;
  rows: LogRow[] = [];
  running = false;

  private orderSub: Subscription;
  private streamSub?: Subscription;
  private countdownTimer?: ReturnType<typeof setInterval>;
  private autoAdvanceTimer?: ReturnType<typeof setInterval>;
  private hasConnectedOnce = false;

  constructor(
    private sseService: SseService,
    private ordersApi: OrdersApiService,
    private currentOrder: CurrentOrderService,
    private devService: DevService
  ) {
    this.orderSub = this.currentOrder.orderId$.subscribe((orderId) => {
      this.orderId = orderId;
      this.resetRun();
    });
  }

  ngOnDestroy(): void {
    this.orderSub.unsubscribe();
    this.streamSub?.unsubscribe();
    this.stopCountdown();
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

  dropConnection(): void {
    this.devService.dropSseConnections().subscribe();
  }

  private resetRun(): void {
    this.streamSub?.unsubscribe();
    this.stopCountdown();
    this.stopAutoAdvance();
    this.running = false;
    this.status = null;
    this.done = false;
    this.connectionState = "desconectado";
    this.lastEventId = null;
    this.attempt = 0;
    this.rows = [];
    this.hasConnectedOnce = false;
  }

  private addRow(row: LogRow): void {
    this.rows = [row, ...this.rows].slice(0, MAX_ROWS);
  }

  private stopCountdown(): void {
    if (this.countdownTimer !== undefined) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = undefined;
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

  private startCountdown(): void {
    this.stopCountdown();
    let remaining = RETRY_SECONDS;
    this.retryInSeconds = remaining;
    this.countdownTimer = setInterval(() => {
      remaining -= 1;
      this.retryInSeconds = Math.max(remaining, 0);
      if (remaining <= 0) {
        this.stopCountdown();
      }
    }, 1000);
  }

  private start(): void {
    if (!this.orderId) {
      return;
    }
    this.running = true;
    this.connectionState = "conectando";
    this.hasConnectedOnce = false;

    this.streamSub = this.sseService.watch(this.orderId).subscribe((update) => {
      if (update.kind === "open") {
        this.stopCountdown();
        if (this.hasConnectedOnce) {
          this.addRow({
            key: `reconnect-${Date.now()}`,
            primary: `↻ reconectado — retomando do id ${this.lastEventId ?? "?"}`,
            tone: "marker",
          });
        }
        this.hasConnectedOnce = true;
        this.attempt = 0;
        this.connectionState = "conectado";
        this.startAutoAdvance();
        return;
      }

      if (update.kind === "error") {
        this.stopAutoAdvance();
        if (!this.hasConnectedOnce) {
          this.connectionState = "conectando";
          return;
        }
        this.attempt += 1;
        if (this.attempt === 1) {
          this.addRow({ key: `drop-${Date.now()}`, primary: "⚡ conexão caiu", tone: "marker" });
        }
        this.connectionState = "reconectando";
        this.startCountdown();
        return;
      }

      if (update.kind === "status") {
        this.lastEventId = update.event.seq;
        this.status = update.event.status;
        this.addRow({
          key: `${update.event.seq}-${Date.now()}`,
          primary: update.event.status,
          secondary: `id ${update.event.seq}${update.event.replay ? " (replay)" : ""}`,
          tone: "changed",
        });
        return;
      }

      this.lastEventId = update.event.seq;
      this.status = update.event.status;
      this.done = true;
      this.connectionState = "desconectado";
      this.stop();
      this.addRow({
        key: `done-${Date.now()}`,
        primary: "stream encerrado pelo servidor — e fechado pelo cliente, senão o navegador reconectaria pra sempre",
        tone: "marker",
      });
    });
  }

  private stop(): void {
    this.running = false;
    this.connectionState = "desconectado";
    this.streamSub?.unsubscribe();
    this.stopCountdown();
    this.stopAutoAdvance();
  }
}
