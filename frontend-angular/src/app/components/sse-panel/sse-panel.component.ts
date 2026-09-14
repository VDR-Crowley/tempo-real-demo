import { Component, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Subscription } from "rxjs";
import { SseService } from "../../services/sse.service";
import { OrderStatus } from "../../services/polling.service";
import { StatusCardComponent } from "../status-card/status-card.component";
import { UpdateLogComponent } from "../update-log/update-log.component";

@Component({
  selector: "app-sse-panel",
  standalone: true,
  imports: [CommonModule, StatusCardComponent, UpdateLogComponent],
  templateUrl: "./sse-panel.component.html",
})
export class SsePanelComponent implements OnDestroy {
  data: OrderStatus | null = null;
  log: OrderStatus[] = [];
  connected = false;
  running = false;
  private sub?: Subscription;

  constructor(private sseService: SseService) {}

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  toggle() {
    if (this.running) {
      this.stop();
    } else {
      this.start();
    }
  }

  private start() {
    this.running = true;
    this.connected = true;
    this.sub = this.sseService.watch().subscribe({
      next: (s) => {
        this.data = s;
        this.log = [s, ...this.log].slice(0, 8);
      },
      error: () => (this.connected = false),
    });
  }

  private stop() {
    this.running = false;
    this.connected = false;
    this.sub?.unsubscribe();
  }
}
