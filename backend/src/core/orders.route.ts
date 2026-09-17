import { Router, type Request, type Response } from "express";
import { ordersService } from "./ordersService.js";
import type { OrderSnapshot } from "../types/order.js";

export const ordersRoute = Router();

interface ErrorBody {
  error: string;
}

// POST /api/orders — cria um pedido novo (ciclo próprio, some ao chegar em "Entregue")
ordersRoute.post("/orders", (_req: Request, res: Response<OrderSnapshot>) => {
  res.json(ordersService.createOrder());
});

// POST /api/orders/:id/advance — força a próxima transição agora (controle de palco)
ordersRoute.post(
  "/orders/:id/advance",
  (req: Request<{ id: string }>, res: Response<OrderSnapshot | ErrorBody>) => {
    const snapshot = ordersService.advance(req.params.id);
    if (!snapshot) {
      res.status(404).json({ error: "pedido não encontrado" });
      return;
    }
    res.json(snapshot);
  }
);
