import { Router, type Request, type Response } from "express";
import { ordersService } from "../../core/ordersService.js";
import type { OrderSnapshot } from "../../types/order.js";

export const pollingRoute = Router();

interface ErrorBody {
  error: string;
}

// GET /api/orders/:id — o cliente pergunta, o servidor só responde o estado
// atual. É o pattern inteiro: repetir essa chamada de tempos em tempos.
pollingRoute.get(
  "/orders/:id",
  (req: Request<{ id: string }>, res: Response<OrderSnapshot | ErrorBody>) => {
    const snapshot = ordersService.getState(req.params.id);
    if (!snapshot) {
      res.status(404).json({ error: "pedido não encontrado" });
      return;
    }
    res.json(snapshot);
  }
);
