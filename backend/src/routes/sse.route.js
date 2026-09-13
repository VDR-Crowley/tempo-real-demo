import { Router } from "express";
import { ordersService } from "../services/ordersService.js";

export const sseRoute = Router();

// GET /api/orders/stream — conexão HTTP mantida aberta, servidor empurra toda mudança
sseRoute.get("/orders/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send(ordersService.getStatus());

  const onChange = (snapshot) => send(snapshot);
  ordersService.on("change", onChange);

  req.on("close", () => {
    ordersService.off("change", onChange);
  });
});
