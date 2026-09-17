import { API_URL } from "../../config";
import type { OrderEvent } from "../../types/order";

interface SseHandlers {
  onOpen: () => void;
  onError: () => void;
  onStatus: (event: OrderEvent) => void;
  onDone: (event: OrderEvent) => void;
}

export interface SseConnection {
  close: () => void;
}

// Nunca fecha a conexão no erro — isso mataria a reconexão automática do
// navegador, que é o argumento central do SSE. Só fecha quando o pedido
// termina (event: done) ou quando o consumidor chama close() explicitamente.
export function openOrderStream(orderId: string, handlers: SseHandlers): SseConnection {
  const es = new EventSource(`${API_URL}/api/orders/${orderId}/stream`);

  es.onopen = () => handlers.onOpen();
  es.onerror = () => handlers.onError();

  es.addEventListener("status", (event) => {
    const messageEvent = event as MessageEvent<string>;
    handlers.onStatus(JSON.parse(messageEvent.data) as OrderEvent);
  });

  es.addEventListener("done", (event) => {
    const messageEvent = event as MessageEvent<string>;
    handlers.onDone(JSON.parse(messageEvent.data) as OrderEvent);
    es.close();
  });

  return {
    close: () => es.close(),
  };
}
