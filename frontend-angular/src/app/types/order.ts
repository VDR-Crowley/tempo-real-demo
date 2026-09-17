// Mesmo shape do backend (backend/src/types/order.ts) — os três serviços
// (polling/SSE/WebSocket) recebem exatamente esse payload. Único lugar do
// Angular que define esse tipo — nenhum serviço importa tipo de outro.

export const ORDER_STATUSES = [
  "Recebido",
  "Em separação",
  "Em transporte",
  "Entregue",
] as const;

export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

export interface OrderSnapshot {
  orderId: string;
  status: OrderStatusValue;
  seq: number;
  updatedAt: string;
  done: boolean;
}

// Evento recebido via SSE — mesmo shape do snapshot, com marcação de replay
// quando veio do replay-por-Last-Event-ID em vez de ao vivo.
export interface OrderEvent extends OrderSnapshot {
  replay?: boolean;
}
