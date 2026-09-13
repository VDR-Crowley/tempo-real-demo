import { api } from "./api";
import type { OrderStatus } from "../types/order";

export function fetchOrderStatus(orderId: string): Promise<OrderStatus> {
  return api.get<OrderStatus>(`/orders/${orderId}`).then((res) => res.data);
}
