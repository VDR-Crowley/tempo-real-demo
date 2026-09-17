import { Router, type Request, type Response } from "express";
import { ordersService } from "../../core/ordersService.js";
import type { OrderSnapshot } from "../../types/order.js";

export const longPollingRoute = Router();

// Quanto tempo o servidor segura a resposta esperando novidade antes de
// devolver o mesmo estado de qualquer jeito (o cliente reabre na hora).
const LONG_POLL_TIMEOUT_MS = Number(process.env.LONG_POLL_TIMEOUT_MS) || 25000;

interface ErrorBody {
  error: string;
}

// GET /api/orders/:id/long-poll?sinceSeq=N — mesma pergunta do polling, só
// que o servidor não responde na hora: segura a conexão até ter uma
// transição com seq > sinceSeq, ou até estourar o timeout. Zero byte
// trafega enquanto nada muda.
longPollingRoute.get(
  "/orders/:id/long-poll",
  async (req: Request<{ id: string }>, res: Response<OrderSnapshot | ErrorBody>) => {
    const orderId = req.params.id;
    const sinceSeqRaw = Number(req.query.sinceSeq);
    const sinceSeq = Number.isFinite(sinceSeqRaw) ? sinceSeqRaw : 0;

    if (!ordersService.getState(orderId)) {
      res.status(404).json({ error: "pedido não encontrado" });
      return;
    }

    const controller = new AbortController();
    req.on("close", () => controller.abort());

    const result = await ordersService.waitForChange(
      orderId,
      sinceSeq,
      LONG_POLL_TIMEOUT_MS,
      controller.signal
    );

    if (controller.signal.aborted || res.writableEnded) {
      return;
    }
    if (!result) {
      res.status(404).json({ error: "pedido não encontrado" });
      return;
    }
    res.json(result);
  }
);
