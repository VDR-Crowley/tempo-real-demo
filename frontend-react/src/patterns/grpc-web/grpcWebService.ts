import { createClient } from "@connectrpc/connect";
import { createGrpcWebTransport } from "@connectrpc/connect-web";
import { API_URL } from "../../config";
import { OrderStreamService } from "../../generated/order_stream_pb";
import type { OrderSnapshot as GrpcOrderSnapshot } from "../../generated/order_stream_pb";
import type { OrderEvent, OrderStatusValue } from "../../types/order";

interface GrpcWebHandlers {
  onOpen: () => void;
  onError: () => void;
  onStatus: (event: OrderEvent) => void;
  onDone: (event: OrderEvent) => void;
}

export interface GrpcWebConnection {
  close: () => void;
}

const transport = createGrpcWebTransport({ baseUrl: API_URL });
const client = createClient(OrderStreamService, transport);

function toOrderEvent(snapshot: GrpcOrderSnapshot): OrderEvent {
  return {
    orderId: snapshot.orderId,
    status: snapshot.status as OrderStatusValue,
    seq: snapshot.seq,
    updatedAt: snapshot.updatedAt,
    done: snapshot.done,
  };
}

// Sem reconexão automática do navegador (isso é uma coisa do EventSource) —
// quem chama decide o que fazer no onError; ver useGrpcWeb.
export function openOrderStream(orderId: string, handlers: GrpcWebHandlers): GrpcWebConnection {
  const controller = new AbortController();

  (async () => {
    try {
      handlers.onOpen();
      for await (const snapshot of client.watchOrder({ orderId }, { signal: controller.signal })) {
        const event = toOrderEvent(snapshot);
        if (snapshot.done) {
          handlers.onDone(event);
          return;
        }
        handlers.onStatus(event);
      }
    } catch {
      if (controller.signal.aborted) {
        return;
      }
      handlers.onError();
    }
  })();

  return {
    close: () => controller.abort(),
  };
}

export function advanceOrder(orderId: string): Promise<void> {
  return client.advanceOrder({ orderId }).then(() => undefined);
}
