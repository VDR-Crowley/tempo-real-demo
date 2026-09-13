import { Component, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Subscription } from "rxjs";
import { SocketService } from "../../services/socket.service";
import { OrderStatus } from "../../services/polling.service";
import { StatusCardComponent } from "../status-card/status-card.component";
import { UpdateLogComponent } from "../update-log/update-log.component";

@Component({
  selector: "app-socket-panel",
  standalone: true,
  imports: [CommonModule, StatusCardComponent, UpdateLogComponent],
  templateUrl: "./socket-panel.component.html",
})
export class SocketPanelComponent implements OnInit, OnDestroy {
  data: OrderStatus | null = null;
  log: OrderStatus[] = [];
  connected = false;
  private sub?: Subscription;

  constructor(private socketService: SocketService) {}

  ngOnInit() {
    this.connected = true;
    this.sub = this.socketService.watch().subscribe({
      next: (s) => {
        this.data = s;
        this.log = [s, ...this.log].slice(0, 8);
      },
      error: () => (this.connected = false),
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}
