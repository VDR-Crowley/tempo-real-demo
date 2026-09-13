import { Router } from "express";
import { ordersService } from "../services/ordersService.js";

export const pollingRoute = Router();

// GET /api/orders/:id — o cliente pergunta, o servidor só responde o estado atual
pollingRoute.get("/orders/:id", (req, res) => {
  res.json({ orderId: req.params.id, ...ordersService.getStatus() });
});
