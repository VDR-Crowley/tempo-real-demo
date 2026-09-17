import { Component, ElementRef, EventEmitter, HostListener, Input, Output } from "@angular/core";
import { CommonModule } from "@angular/common";

export interface SelectOption<T> {
  label: string;
  value: T;
}

@Component({
  selector: "app-select",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./select.component.html",
})
export class SelectComponent<T> {
  @Input() value!: T;
  @Input() options: SelectOption<T>[] = [];
  @Output() valueChange = new EventEmitter<T>();

  open = false;

  constructor(private elementRef: ElementRef<HTMLElement>) {}

  get current(): SelectOption<T> | undefined {
    return this.options.find((option) => option.value === this.value);
  }

  toggle(): void {
    this.open = !this.open;
  }

  select(option: SelectOption<T>): void {
    this.valueChange.emit(option.value);
    this.open = false;
  }

  @HostListener("document:mousedown", ["$event"])
  onDocumentMouseDown(event: MouseEvent): void {
    if (this.open && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.open = false;
    }
  }
}
