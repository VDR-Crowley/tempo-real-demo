import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import { OrderSnapshot } from "../../types/order";

@Injectable({ providedIn: "root" })
export class LongPollingService {
  constructor(private http: HttpClient) {}

  // GET /api/orders/:id/long-poll?sinceSeq=N — mesma pergunta do polling, só
  // que o servidor segura a resposta até ter novidade (seq > sinceSeq) ou
  // até estourar o timeout dele. O cliente reabre assim que a resposta volta.
  longPoll(orderId: string, sinceSeq: number): Observable<OrderSnapshot> {
    return this.http.get<OrderSnapshot>(`${environment.apiUrl}/api/orders/${orderId}/long-poll`, {
      params: { sinceSeq },
    });
  }
}
