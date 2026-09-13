import { api } from "./api";

export function fetchOrderStatus(orderId) {
  return api.get(`/orders/${orderId}`).then((res) => res.data);
}
