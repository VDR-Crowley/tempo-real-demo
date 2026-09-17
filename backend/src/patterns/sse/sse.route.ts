import { Router, type Request, type Response } from "express";
import { ordersService } from "../../core/ordersService.js";
import type { OrderEvent } from "../../types/order.js";

export const sseRoute = Router();

const openConnections = new Set<Response>();

// POST /api/dev/drop-sse — botão "Simular queda": derruba toda conexão SSE
// aberta sem avisar o cliente. Fica aqui (não num arquivo "dev" genérico)
// porque só faz sentido junto do que ela derruba.
sseRoute.post("/dev/drop-sse", (_req: Request, res: Response<{ dropped: number }>) => {
  const dropped = openConnections.size;
  for (const openRes of openConnections) {
    openRes.destroy();
  }
  res.json({ dropped });
});

function parseLastEventId(header: string | string[] | undefined): number {
  const raw = Array.isArray(header) ? header[0] : header;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

// GET /api/orders/:id/stream — protocolo SSE completo: id/replay/heartbeat/done.
sseRoute.get("/orders/:id/stream", (req: Request<{ id: string }>, res: Response) => {
  const orderId = req.params.id;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 3000\n\n");
  openConnections.add(res);

  const writeStatus = (event: OrderEvent, replay: boolean): void => {
    const payload = replay ? { ...event, replay: true } : event;
    res.write(`id: ${event.seq}\nevent: status\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  const writeDone = (event: OrderEvent, replay: boolean): void => {
    const payload = replay ? { ...event, replay: true } : event;
    res.write(`id: ${event.seq}\nevent: done\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  const cleanup = (): void => {
    clearInterval(heartbeat);
    ordersService.off("change", onChange);
    openConnections.delete(res);
  };

  const finish = (event: OrderEvent, replay: boolean): void => {
    writeStatus(event, replay);
    writeDone(event, replay);
    cleanup();
    res.end();
  };

  const onChange = (event: OrderEvent): void => {
    if (event.orderId !== orderId) {
      return;
    }
    if (event.done) {
      finish(event, false);
      return;
    }
    writeStatus(event, false);
  };

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 15000);

  const lastSeq = parseLastEventId(req.headers["last-event-id"]);
  const pending = ordersService.getEventsAfter(orderId, lastSeq);

  let alreadyDone = false;
  for (const event of pending) {
    if (event.done) {
      finish(event, true);
      alreadyDone = true;
      break;
    }
    writeStatus(event, true);
  }

  if (alreadyDone) {
    return;
  }

  ordersService.on("change", onChange);
  req.on("close", cleanup);
});
