import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-metrics-bar",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./metrics-bar.component.html",
})
export class MetricsBarComponent {
  @Input() requests = 0;
  @Input() unchanged = 0;
  @Input() lastChangeDelayMs: number | null = null;

  get wastePercent(): number {
    return this.requests > 0 ? Math.round((this.unchanged / this.requests) * 100) : 0;
  }

  get lastChangeDelayLabel(): string {
    return this.lastChangeDelayMs !== null ? `${(this.lastChangeDelayMs / 1000).toFixed(1)}s` : "—";
  }
}
