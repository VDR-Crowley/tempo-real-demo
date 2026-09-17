import { Injectable, NgZone } from "@angular/core";
import { Subject } from "rxjs";
import { environment } from "../../../environments/environment";
import { ClientApp, ClientMessage, ServerMessage } from "../../types/ws";

export type SocketUpdate = { kind: "open" } | { kind: "close" } | { kind: "message"; message: ServerMessage };

export interface SocketHandle {
  updates$: Subject<SocketUpdate>;
  sendHello: (app: ClientApp, nick: string) => void;
  sendChat: (text: string) => void;
  sendTyping: () => void;
  subscribe: (orderId: string) => void;
  close: () => void;
}

@Injectable({ providedIn: "root" })
export class SocketService {
  constructor(private zone: NgZone) {}

  // Nunca fecha a conexão no erro (mesma regra do sse.service) — quem
  // decide fechar é o usuário (Desconectar) ou o navegador (onclose nativo).
  connect(): SocketHandle {
    const updates$ = new Subject<SocketUpdate>();
    const ws = new WebSocket(`${environment.wsUrl}/api/orders/socket`);

    const send = (payload: ClientMessage): void => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    };

    ws.onopen = () => this.zone.run(() => updates$.next({ kind: "open" }));
    ws.onclose = () => this.zone.run(() => updates$.next({ kind: "close" }));
    ws.onerror = () => {
      // sem fechamento forçado — o navegador cuida do ciclo de vida nativo do WebSocket
    };
    ws.onmessage = (event: MessageEvent<string>) => {
      const message = JSON.parse(event.data) as ServerMessage;
      this.zone.run(() => updates$.next({ kind: "message", message }));
    };

    return {
      updates$,
      sendHello: (app, nick) => send({ type: "hello", app, nick }),
      sendChat: (text) => send({ type: "chat", text }),
      sendTyping: () => send({ type: "typing" }),
      subscribe: (orderId) => send({ type: "subscribe", orderId }),
      close: () => ws.close(),
    };
  }
}
