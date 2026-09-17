import { Component, EventEmitter, Input, Output } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ClientApp } from "../../types/ws";

export interface ChatMessageView {
  id: string;
  app: ClientApp;
  nick: string;
  text: string;
  at: string;
}

@Component({
  selector: "app-chat-panel",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./chat-panel.component.html",
})
export class ChatPanelComponent {
  @Input() messages: ChatMessageView[] = [];
  @Input() typingLabel: string | null = null;
  @Input() value = "";
  @Output() valueChange = new EventEmitter<string>();
  @Output() send = new EventEmitter<void>();

  onInput(newValue: string): void {
    this.valueChange.emit(newValue);
  }

  onSubmit(): void {
    this.send.emit();
  }

  formatTime(at: string): string {
    return new Date(at).toLocaleTimeString();
  }
}
