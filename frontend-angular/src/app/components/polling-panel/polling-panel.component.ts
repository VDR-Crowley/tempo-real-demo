import { Component, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Subscription } from "rxjs";
import { PollingService, OrderStatus } from "../../services/polling.service";
import { StatusCardComponent } from "../status-card/status-card.component";
import { UpdateLogComponent } from "../update-log/update-log.component";

@Component({
  selector: "app-polling-panel",
  standalone: true,
  imports: [CommonModule, StatusCardComponent, UpdateLogComponent],
  templateUrl: "./polling-panel.component.html",
})
export class PollingPanelComponent implements OnDestroy {
  data: OrderStatus | null = null;
  log: OrderStatus[] = [];
  running = false;
  private sub?: Subscription;

  constructor(private pollingService: PollingService) {}

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
    this.pollingService.fetchOnce("123").subscribe((s) => this.push(s));
    this.sub = this.pollingService.watch("123", 5000).subscribe((s) => this.push(s));
  }

  private stop() {
    this.running = false;
    this.sub?.unsubscribe();
  }

  private push(status: OrderStatus) {
    this.data = status;
    this.log = [status, ...this.log].slice(0, 8);
  }
}
