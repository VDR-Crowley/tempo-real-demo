import { api } from "./api";
import type { OrderSnapshot } from "../types/order";

export function createOrder(): Promise<OrderSnapshot> {
  return api.post<OrderSnapshot>("/orders").then((res) => res.data);
}

export function fetchOrderStatus(orderId: string): Promise<OrderSnapshot> {
  return api.get<OrderSnapshot>(`/orders/${orderId}`).then((res) => res.data);
}

export function advanceOrder(orderId: string): Promise<OrderSnapshot> {
  return api.post<OrderSnapshot>(`/orders/${orderId}/advance`).then((res) => res.data);
}
