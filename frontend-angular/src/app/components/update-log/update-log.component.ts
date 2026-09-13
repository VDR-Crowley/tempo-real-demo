import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { OrderStatus } from "../../services/polling.service";

@Component({
  selector: "app-update-log",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./update-log.component.html",
})
export class UpdateLogComponent {
  @Input() items: OrderStatus[] = [];
}
