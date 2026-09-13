// Tipo compartilhado do "estado do pedido" — as três rotas (polling/SSE/WebSocket)
// leem/emitem esse mesmo shape, então ele mora num só lugar.

export const ORDER_STATUSES = [
  "Recebido",
  "Em separação",
  "Em transporte",
  "Entregue",
] as const;

export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

// Snapshot puro do ordersService — sem orderId, que é um detalhe da rota de polling.
export interface OrderStatusSnapshot {
  status: OrderStatusValue;
  updatedAt: string;
}

// Payload de resposta da rota de polling: snapshot + qual pedido foi consultado.
export interface OrderStatus extends OrderStatusSnapshot {
  orderId?: string;
}
