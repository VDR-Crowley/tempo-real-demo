import { ConnectError, Code, type ConnectRouter, type HandlerContext } from "@connectrpc/connect";
import { ordersService } from "../../core/ordersService.js";
import { OrderStreamService } from "../../generated/order_stream_pb.js";
import type { WatchOrderRequest, AdvanceOrderRequest } from "../../generated/order_stream_pb.js";
import type { OrderEvent } from "../../types/order.js";

// Ponte entre o EventEmitter("change") do ordersService (já usado pelo
// long-polling) e um async generator — sem timeout, fica aberto até o
// pedido terminar ou o cliente abortar (aba fechada / desconectar).
async function* watchOrderChanges(orderId: string, signal: AbortSignal): AsyncGenerator<OrderEvent> {
  let resolveNext: ((event: OrderEvent | null) => void) | null = null;
  const queue: OrderEvent[] = [];

  const onChange = (event: OrderEvent): void => {
    if (event.orderId !== orderId) {
      return;
    }
    if (resolveNext) {
      const resolve = resolveNext;
      resolveNext = null;
      resolve(event);
    } else {
      queue.push(event);
    }
  };

  const onAbort = (): void => {
    if (resolveNext) {
      const resolve = resolveNext;
      resolveNext = null;
      resolve(null);
    }
  };

  ordersService.on("change", onChange);
  signal.addEventListener("abort", onAbort);

  try {
    while (!signal.aborted) {
      const event =
        queue.length > 0
          ? queue.shift()!
          : await new Promise<OrderEvent | null>((resolve) => {
              resolveNext = resolve;
            });
      if (event === null) {
        return;
      }
      yield event;
      if (event.done) {
        return;
      }
    }
  } finally {
    ordersService.off("change", onChange);
    signal.removeEventListener("abort", onAbort);
  }
}

export default (router: ConnectRouter) =>
  router.service(OrderStreamService, {
    async *watchOrder(req: WatchOrderRequest, context: HandlerContext) {
      const current = ordersService.getState(req.orderId);
      if (!current) {
        throw new ConnectError("pedido não encontrado", Code.NotFound);
      }
      yield current;
      if (current.done) {
        return;
      }
      yield* watchOrderChanges(req.orderId, context.signal);
    },
    async advanceOrder(req: AdvanceOrderRequest) {
      const snapshot = ordersService.advance(req.orderId);
      if (!snapshot) {
        throw new ConnectError("pedido não encontrado", Code.NotFound);
      }
      return snapshot;
    },
  });
