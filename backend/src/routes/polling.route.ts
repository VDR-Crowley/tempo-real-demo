import { Router, type Request, type Response } from "express";
import { ordersService } from "../services/ordersService.js";
import type { OrderStatus } from "../types/order.js";

export const pollingRoute = Router();

// GET /api/orders/:id — o cliente pergunta, o servidor só responde o estado atual
pollingRoute.get(
  "/orders/:id",
  (req: Request<{ id: string }>, res: Response<OrderStatus>) => {
    res.json({ orderId: req.params.id, ...ordersService.getStatus() });
  }
);
