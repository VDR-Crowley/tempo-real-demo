import { Component, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Subscription } from "rxjs";
import { SocketService, SocketHandle } from "./socket.service";
import { CurrentOrderService } from "../../services/current-order.service";
import { OrderStatusValue } from "../../types/order";
import { ClientApp, PresencePeer, ServerMessage } from "../../types/ws";
import { ConnectionState } from "../../types/connection";
import { StatusTimelineComponent } from "../../components/status-timeline/status-timeline.component";
import { ConnectionBadgeComponent } from "../../components/connection-badge/connection-badge.component";
import { ChatPanelComponent, ChatMessageView } from "../../components/chat-panel/chat-panel.component";

const APP: ClientApp = "angular";
const MAX_MESSAGES = 20;
const TYPING_TIMEOUT_MS = 2000;

@Component({
  selector: "app-socket-panel",
  standalone: true,
  imports: [CommonModule, StatusTimelineComponent, ConnectionBadgeComponent, ChatPanelComponent],
  templateUrl: "./socket-panel.component.html",
})
export class SocketPanelComponent implements OnDestroy {
  orderId: string | null = null;
  connectionState: ConnectionState = "desconectado";
  running = false;
  nick = `${APP}-1`;
  status: OrderStatusValue | null = null;
  done = false;
  peers: PresencePeer[] = [];
  messages: ChatMessageView[] = [];
  typingLabel: string | null = null;
  chatInput = "";
  frames = { sent: 0, received: 0 };

  private orderSub: Subscription;
  private updatesSub?: Subscription;
  private handle?: SocketHandle;
  private typingTimeout?: ReturnType<typeof setTimeout>;

  constructor(
    private socketService: SocketService,
    private currentOrder: CurrentOrderService
  ) {
    this.orderSub = this.currentOrder.orderId$.subscribe((orderId) => {
      this.orderId = orderId;
      this.status = null;
      this.done = false;
      if (this.orderId && this.handle) {
        this.handle.subscribe(this.orderId);
        this.countSent();
      }
    });
  }

  ngOnDestroy(): void {
    this.orderSub.unsubscribe();
    this.updatesSub?.unsubscribe();
    this.handle?.close();
    if (this.typingTimeout !== undefined) {
      clearTimeout(this.typingTimeout);
    }
  }

  toggle(): void {
    if (this.running) {
      this.disconnect();
    } else {
      this.connect();
    }
  }

  onChatInputChange(value: string): void {
    this.chatInput = value;
    this.handle?.sendTyping();
    this.countSent();
  }

  sendChat(): void {
    const text = this.chatInput.trim();
    if (!text || !this.handle) {
      return;
    }
    this.handle.sendChat(text);
    this.countSent();
    this.chatInput = "";
  }

  isSelf(peer: PresencePeer): boolean {
    return peer.nick === this.nick && peer.app === APP;
  }

  private countSent(): void {
    this.frames = { ...this.frames, sent: this.frames.sent + 1 };
  }

  private countReceived(): void {
    this.frames = { ...this.frames, received: this.frames.received + 1 };
  }

  private connect(): void {
    this.connectionState = "conectando";
    this.running = true;
    const handle = this.socketService.connect();
    this.handle = handle;

    this.updatesSub = handle.updates$.subscribe((update) => {
      if (update.kind === "open") {
        this.connectionState = "conectado";
        handle.sendHello(APP, this.nick);
        this.countSent();
        if (this.orderId) {
          handle.subscribe(this.orderId);
          this.countSent();
        }
        return;
      }
      if (update.kind === "close") {
        this.connectionState = "desconectado";
        this.running = false;
        return;
      }
      this.countReceived();
      this.handleMessage(update.message);
    });
  }

  private disconnect(): void {
    this.running = false;
    this.connectionState = "desconectado";
    this.updatesSub?.unsubscribe();
    this.handle?.close();
    this.handle = undefined;
  }

  private handleMessage(message: ServerMessage): void {
    if (message.type === "presence") {
      this.peers = message.peers;
      return;
    }
    if (message.type === "chat") {
      this.messages = [
        ...this.messages,
        { id: message.id, app: message.app, nick: message.nick, text: message.text, at: message.at },
      ].slice(-MAX_MESSAGES);
      return;
    }
    if (message.type === "typing") {
      this.typingLabel = `${message.nick} (${message.app === "react" ? "React" : "Angular"}) está digitando...`;
      if (this.typingTimeout !== undefined) {
        clearTimeout(this.typingTimeout);
      }
      this.typingTimeout = setTimeout(() => (this.typingLabel = null), TYPING_TIMEOUT_MS);
      return;
    }
    this.status = message.status;
    this.done = message.done;
  }
}
