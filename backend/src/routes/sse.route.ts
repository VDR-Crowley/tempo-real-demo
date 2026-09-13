import { Router, type Request, type Response } from "express";
import { ordersService } from "../services/ordersService.js";
import type { OrderStatusSnapshot } from "../types/order.js";

export const sseRoute = Router();

// GET /api/orders/stream — conexão HTTP mantida aberta, servidor empurra toda mudança
sseRoute.get("/orders/stream", (req: Request, res: Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (data: OrderStatusSnapshot): void => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send(ordersService.getStatus());

  const onChange = (snapshot: OrderStatusSnapshot): void => send(snapshot);
  ordersService.on("change", onChange);

  req.on("close", () => {
    ordersService.off("change", onChange);
  });
});
