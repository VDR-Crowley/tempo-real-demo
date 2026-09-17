import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ORDER_STATUSES, OrderStatusValue } from "../../types/order";

@Component({
  selector: "app-status-timeline",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./status-timeline.component.html",
})
export class StatusTimelineComponent {
  @Input() currentStatus: OrderStatusValue | null = null;
  @Input() done = false;

  readonly statuses = ORDER_STATUSES;

  stepState(status: OrderStatusValue, index: number): "done" | "current" | "pending" {
    const currentIndex = this.currentStatus ? this.statuses.indexOf(this.currentStatus) : -1;
    if (index < currentIndex || (index === currentIndex && this.done)) {
      return "done";
    }
    if (index === currentIndex) {
      return "current";
    }
    return "pending";
  }
}
