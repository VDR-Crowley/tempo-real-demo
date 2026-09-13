import type { OrderStatus } from "../types/order";

type MessageHandler = (data: OrderStatus) => void;
type ErrorHandler = (err: Event) => void;

export function openOrderSocket(
  onMessage: MessageHandler,
  onError?: ErrorHandler
): () => void {
  const ws = new WebSocket("ws://localhost:4000/api/orders/socket");

  ws.onopen = () => ws.send(JSON.stringify({ type: "subscribe" }));
  ws.onmessage = (event: MessageEvent<string>) => {
    onMessage(JSON.parse(event.data) as OrderStatus);
  };
  ws.onerror = (err: Event) => onError?.(err);

  return () => ws.close();
}
