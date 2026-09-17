import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";

export interface LogRow {
  key: string;
  primary: string;
  secondary?: string;
  tone: "changed" | "unchanged" | "marker";
}

@Component({
  selector: "app-event-log",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./event-log.component.html",
})
export class EventLogComponent {
  @Input() rows: LogRow[] = [];
}
