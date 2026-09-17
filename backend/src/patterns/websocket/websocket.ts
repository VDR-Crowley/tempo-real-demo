import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import type { RawData } from "ws";
import { ordersService } from "../../core/ordersService.js";
import type { OrderEvent } from "../../types/order.js";
import {
  isHelloMessage,
  isChatMessage,
  isTypingMessage,
  isSubscribeMessage,
  type ClientApp,
  type ServerMessage,
} from "../../types/ws.js";

interface ClientInfo {
  id: string;
  socket: WebSocket;
  app: ClientApp | null;
  nick: string | null;
  subscribedOrderId: string | null;
}

// ws:// /api/orders/socket — uma conexão só carrega push de status e chat
// entre os clientes conectados (tipicamente uma aba Angular e uma React).
export function attachWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/api/orders/socket" });
  const clients = new Map<WebSocket, ClientInfo>();

  const broadcast = (message: ServerMessage): void => {
    const raw = JSON.stringify(message);
    for (const client of clients.values()) {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(raw);
      }
    }
  };

  const broadcastPresence = (): void => {
    const peers = [...clients.values()]
      .filter((client) => client.app !== null && client.nick !== null)
      .map((client) => ({ id: client.id, app: client.app as ClientApp, nick: client.nick as string }));
    broadcast({ type: "presence", peers });
  };

  // Um único listener global — não é por conexão — repassa cada mudança de
  // pedido só pra quem assinou aquele orderId.
  const onOrderChange = (event: OrderEvent): void => {
    for (const client of clients.values()) {
      if (client.subscribedOrderId === event.orderId && client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(
          JSON.stringify({
            type: "status",
            orderId: event.orderId,
            status: event.status,
            seq: event.seq,
            updatedAt: event.updatedAt,
            done: event.done,
          } satisfies ServerMessage)
        );
      }
    }
  };
  ordersService.on("change", onOrderChange);

  wss.on("connection", (socket: WebSocket) => {
    const info: ClientInfo = {
      id: randomUUID(),
      socket,
      app: null,
      nick: null,
      subscribedOrderId: null,
    };
    clients.set(socket, info);

    socket.on("message", (raw: RawData) => {
      let msg: unknown;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (isHelloMessage(msg)) {
        info.app = msg.app;
        info.nick = msg.nick;
        broadcastPresence();
        return;
      }

      if (isChatMessage(msg)) {
        if (!info.app || !info.nick) {
          return;
        }
        broadcast({
          type: "chat",
          id: randomUUID(),
          app: info.app,
          nick: info.nick,
          text: msg.text,
          at: new Date().toISOString(),
        });
        return;
      }

      if (isTypingMessage(msg)) {
        if (!info.app || !info.nick) {
          return;
        }
        broadcast({ type: "typing", app: info.app, nick: info.nick });
        return;
      }

      if (isSubscribeMessage(msg)) {
        info.subscribedOrderId = msg.orderId;
        const snapshot = ordersService.getState(msg.orderId);
        if (snapshot && socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: "status",
              orderId: snapshot.orderId,
              status: snapshot.status,
              seq: snapshot.seq,
              updatedAt: snapshot.updatedAt,
              done: snapshot.done,
            } satisfies ServerMessage)
          );
        }
      }
    });

    socket.on("close", () => {
      clients.delete(socket);
      broadcastPresence();
    });
  });

  return wss;
}
