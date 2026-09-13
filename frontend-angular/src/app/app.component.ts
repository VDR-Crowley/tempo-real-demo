import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { PollingPanelComponent } from "./components/polling-panel/polling-panel.component";
import { SsePanelComponent } from "./components/sse-panel/sse-panel.component";
import { SocketPanelComponent } from "./components/socket-panel/socket-panel.component";

type TabId = "polling" | "sse" | "socket";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, PollingPanelComponent, SsePanelComponent, SocketPanelComponent],
  templateUrl: "./app.component.html",
})
export class AppComponent {
  active: TabId = "polling";

  setActive(tab: TabId) {
    this.active = tab;
  }
}
