import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { PollingPanelComponent } from "./patterns/polling/polling-panel.component";
import { LongPollingPanelComponent } from "./patterns/long-polling/long-polling-panel.component";
import { SsePanelComponent } from "./patterns/sse/sse-panel.component";
import { SocketPanelComponent } from "./patterns/websocket/socket-panel.component";
import { CurrentOrderService } from "./services/current-order.service";

type TabId = "polling" | "long-polling" | "sse" | "socket";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    CommonModule,
    PollingPanelComponent,
    LongPollingPanelComponent,
    SsePanelComponent,
    SocketPanelComponent,
  ],
  templateUrl: "./app.component.html",
})
export class AppComponent implements OnInit {
  active: TabId = "polling";

  constructor(private currentOrder: CurrentOrderService) {}

  ngOnInit(): void {
    void this.currentOrder.startNewOrder();
  }

  setActive(tab: TabId) {
    this.active = tab;
  }
}
