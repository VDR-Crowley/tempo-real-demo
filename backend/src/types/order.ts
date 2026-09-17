// Tipo compartilhado do "estado do pedido" — polling, SSE e WebSocket leem
// esse mesmo shape, então ele mora num só lugar.

export const ORDER_STATUSES = [
  "Recebido",
  "Em separação",
  "Em transporte",
  "Entregue",
] as const;

export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

// Snapshot do pedido num instante (usado por GET/POST e como base do evento).
export interface OrderSnapshot {
  orderId: string;
  status: OrderStatusValue;
  seq: number;
  updatedAt: string;
  done: boolean;
}

// Uma transição do pedido — mesmo shape do snapshot, guardado em histórico
// pra permitir o replay do SSE via Last-Event-ID.
export type OrderEvent = OrderSnapshot;
