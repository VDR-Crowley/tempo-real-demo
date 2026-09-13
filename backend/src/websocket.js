import { WebSocketServer } from "ws";
import { ordersService } from "./services/ordersService.js";

// ws:// /api/orders/socket — conexão bidirecional: servidor empurra, cliente também manda mensagem
export function attachWebSocket(server) {
  const wss = new WebSocketServer({ server, path: "/api/orders/socket" });

  wss.on("connection", (socket) => {
    socket.send(JSON.stringify(ordersService.getStatus()));

    const onChange = (snapshot) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(snapshot));
      }
    };
    ordersService.on("change", onChange);

    socket.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "subscribe") {
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
