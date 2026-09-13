import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { OrderStatus } from "../../services/polling.service";

// Componente burro: só recebe Input()s e renderiza. Não sabe se o dado
// veio de polling, SSE ou WebSocket.
@Component({
  selector: "app-status-card",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./status-card.component.html",
})
export class StatusCardComponent {
  @Input() title = "";
  @Input() data: OrderStatus | null = null;
  @Input() connected: boolean | null = null;
}
