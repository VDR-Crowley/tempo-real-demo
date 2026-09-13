// Mesmo shape do backend (backend/src/types/order.ts) — os três serviços
// (polling/SSE/WebSocket) recebem exatamente esse payload.

export type OrderStatusValue =
  | "Recebido"
  | "Em separação"
  | "Em transporte"
  | "Entregue";

export interface OrderStatus {
  orderId?: string;
  status: OrderStatusValue;
  updatedAt: string;
}
