import { api } from "../../services/api";
import type { OrderSnapshot } from "../../types/order";

// GET /api/orders/:id/long-poll?sinceSeq=N — mesma pergunta do polling, só
// que o servidor segura a resposta até ter novidade (seq > sinceSeq) ou até
// estourar o timeout dele. O cliente reabre assim que a resposta volta.
export function longPoll(
  orderId: string,
  sinceSeq: number,
  signal: AbortSignal
): Promise<OrderSnapshot> {
  return api
    .get<OrderSnapshot>(`/orders/${orderId}/long-poll`, { params: { sinceSeq }, signal })
    .then((res) => res.data);
}
