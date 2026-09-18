import { Component, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Subscription } from "rxjs";
import { GrpcWebService } from "./grpc-web.service";
import { CurrentOrderService } from "../../services/current-order.service";
import { OrderStatusValue } from "../../types/order";
import { ConnectionState } from "../../types/connection";
import { StatusTimelineComponent } from "../../components/status-timeline/status-timeline.component";
import { ConnectionBadgeComponent } from "../../components/connection-badge/connection-badge.component";
import { EventLogComponent, LogRow } from "../../components/event-log/event-log.component";

const MAX_ROWS = 8;
const RETRY_SECONDS = 3;
const AUTO_ADVANCE_MS = 5000;

@Component({
  selector: "app-grpc-web-panel",
  standalone: true,
  imports: [CommonModule, StatusTimelineComponent, ConnectionBadgeComponent, EventLogComponent],
  templateUrl: "./grpc-web-panel.component.html",
})
export class GrpcWebPanelComponent implements OnDestroy {
  orderId: string | null = null;
  status: OrderStatusValue | null = null;
  done = false;
  connectionState: ConnectionState = "desconectado";
  attempt = 0;
  retryInSeconds = RETRY_SECONDS;
  rows: LogRow[] = [];
  running = false;

  private orderSub: Subscription;
  private streamSub?: Subscription;
  private countdownTimer?: ReturnType<typeof setInterval>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private autoAdvanceTimer?: ReturnType<typeof setInterval>;

  constructor(
    private grpcWebService: GrpcWebService,
    private currentOrder: CurrentOrderService
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
    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
    }
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
      void this.grpcWebService.advance(this.orderId);
    }
  }

  private resetRun(): void {
    this.streamSub?.unsubscribe();
    this.stopCountdown();
    this.stopAutoAdvance();
    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.running = false;
    this.status = null;
    this.done = false;
    this.connectionState = "desconectado";
    this.attempt = 0;
    this.rows = [];
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

  private startCountdown(onFinish: () => void): void {
    this.stopCountdown();
    let remaining = RETRY_SECONDS;
    this.retryInSeconds = remaining;
    this.countdownTimer = setInterval(() => {
      remaining -= 1;
      this.retryInSeconds = Math.max(remaining, 0);
      if (remaining <= 0) {
        this.stopCountdown();
        onFinish();
      }
    }, 1000);
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
        void this.grpcWebService.advance(this.orderId);
      }
    }, AUTO_ADVANCE_MS);
  }

  private start(): void {
    if (!this.orderId) {
      return;
    }
    this.running = true;
    this.connectionState = "conectando";
    this.connect();
  }

  private connect(): void {
    if (!this.orderId) {
      return;
    }
    this.streamSub = this.grpcWebService.watch(this.orderId).subscribe((update) => {
      if (update.kind === "open") {
        this.stopCountdown();
        this.attempt = 0;
        this.connectionState = "conectado";
        this.startAutoAdvance();
        return;
      }
      if (update.kind === "error") {
        this.stopAutoAdvance();
        this.attempt += 1;
        if (this.attempt === 1) {
          this.addRow({ key: `drop-${Date.now()}`, primary: "⚡ conexão caiu", tone: "marker" });
        }
        this.connectionState = "reconectando";
        this.startCountdown(() => {
          this.reconnectTimer = setTimeout(() => this.connect(), 0);
        });
        return;
      }
      if (update.kind === "status") {
        this.status = update.event.status;
        this.addRow({
          key: `${update.event.seq}-${Date.now()}`,
          primary: update.event.status,
          secondary: `seq ${update.event.seq}`,
          tone: "changed",
        });
        return;
      }
      this.status = update.event.status;
      this.done = true;
      this.connectionState = "desconectado";
      this.stop();
      this.addRow({ key: `done-${Date.now()}`, primary: "stream encerrado pelo servidor", tone: "marker" });
    });
  }

  private stop(): void {
    this.running = false;
    this.streamSub?.unsubscribe();
    this.stopCountdown();
    this.stopAutoAdvance();
    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }
}
