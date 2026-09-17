import { WS_URL } from "../../config";
import type { ClientApp, ClientMessage, ServerMessage } from "../../types/ws";

interface SocketHandlers {
  onOpen: () => void;
  onClose: () => void;
  onError: () => void;
  onMessage: (message: ServerMessage) => void;
}

export interface SocketConnection {
  sendHello: (app: ClientApp, nick: string) => void;
  sendChat: (text: string) => void;
  sendTyping: () => void;
  subscribe: (orderId: string) => void;
  close: () => void;
}

// Nunca fecha a conexão no erro (mesma regra do sseService) — quem decide
// fechar é o usuário (Desconectar) ou o navegador (onclose nativo).
export function connectSocket(handlers: SocketHandlers): SocketConnection {
  const ws = new WebSocket(`${WS_URL}/api/orders/socket`);

  const send = (payload: ClientMessage): void => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  };

  ws.onopen = () => handlers.onOpen();
  ws.onclose = () => handlers.onClose();
  ws.onerror = () => handlers.onError();
  ws.onmessage = (event: MessageEvent<string>) => {
    handlers.onMessage(JSON.parse(event.data) as ServerMessage);
  };

  return {
    sendHello: (app, nick) => send({ type: "hello", app, nick }),
    sendChat: (text) => send({ type: "chat", text }),
    sendTyping: () => send({ type: "typing" }),
    subscribe: (orderId) => send({ type: "subscribe", orderId }),
    close: () => ws.close(),
  };
}
