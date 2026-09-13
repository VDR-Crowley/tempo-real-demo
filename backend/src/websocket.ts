import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import type { RawData } from "ws";
import { ordersService } from "./services/ordersService.js";
import type { OrderStatusSnapshot } from "./types/order.js";

interface SubscribeMessage {
  type: "subscribe";
}

function isSubscribeMessage(value: unknown): value is SubscribeMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    (value as { type: unknown }).type === "subscribe"
  );
}

// ws:// /api/orders/socket — conexão bidirecional: servidor empurra, cliente também manda mensagem
export function attachWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/api/orders/socket" });

  wss.on("connection", (socket: WebSocket) => {
    socket.send(JSON.stringify(ordersService.getStatus()));

    const onChange = (snapshot: OrderStatusSnapshot): void => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(snapshot));
      }
    };
    ordersService.on("change", onChange);

    socket.on("message", (raw: RawData) => {
      try {
        const msg: unknown = JSON.parse(raw.toString());
        if (isSubscribeMessage(msg)) {
          socket.send(JSON.stringify(ordersService.getStatus()));
        }
      } catch {
        // ignora mensagem malformada — demo não precisa validar schema
      }
    });

    socket.on("close", () => {
      ordersService.off("change", onChange);
    });
  });

  return wss;
}
