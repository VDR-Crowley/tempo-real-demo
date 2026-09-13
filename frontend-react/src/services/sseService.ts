import type { OrderStatus } from "../types/order";

type MessageHandler = (data: OrderStatus) => void;
type ErrorHandler = (err: Event) => void;

export function openOrderStream(
  onMessage: MessageHandler,
  onError?: ErrorHandler
): () => void {
  const es = new EventSource("http://localhost:4000/api/orders/stream");

  es.onmessage = (event: MessageEvent<string>) => {
    onMessage(JSON.parse(event.data) as OrderStatus);
  };
  es.onerror = (err: Event) => onError?.(err);

  return () => es.close();
}
