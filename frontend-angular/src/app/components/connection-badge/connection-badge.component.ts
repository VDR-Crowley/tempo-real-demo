import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ConnectionState } from "../../types/connection";

const LABELS: Record<ConnectionState, string> = {
  desconectado: "desconectado",
  conectando: "conectando",
  conectado: "conectado",
  reconectando: "reconectando",
};

@Component({
  selector: "app-connection-badge",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./connection-badge.component.html",
})
export class ConnectionBadgeComponent {
  @Input() state: ConnectionState = "desconectado";
  @Input() attempt?: number;
  @Input() retryInSeconds?: number;

  get label(): string {
    if (this.state === "reconectando" && this.attempt !== undefined && this.retryInSeconds !== undefined) {
      return `reconectando (tentativa ${this.attempt}, em ${this.retryInSeconds}s)`;
    }
    return LABELS[this.state];
  }
}
