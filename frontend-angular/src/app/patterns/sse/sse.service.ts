import { Injectable, NgZone } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import { OrderEvent } from "../../types/order";

// Emissão bruta do ciclo de vida do EventSource — quem decide o que cada
// "error" significa (primeira conexão ainda tentando vs. queda depois de já
// ter conectado) é o componente, igual ao useSSE do React.
export type SseUpdate =
  | { kind: "open" }
  | { kind: "error" }
  | { kind: "status"; event: OrderEvent }
  | { kind: "done"; event: OrderEvent };

@Injectable({ providedIn: "root" })
export class SseService {
  constructor(private zone: NgZone) {}

  // Nunca fecha a conexão no erro — isso mataria a reconexão automática do
  // navegador, que é o argumento central do SSE. Erro vira emissão de
  // estado (kind: "error"), nunca subscriber.error().
  watch(orderId: string): Observable<SseUpdate> {
    return new Observable<SseUpdate>((subscriber) => {
      const es = new EventSource(`${environment.apiUrl}/api/orders/${orderId}/stream`);

      es.onopen = () => {
        this.zone.run(() => subscriber.next({ kind: "open" }));
      };
      es.onerror = () => {
        this.zone.run(() => subscriber.next({ kind: "error" }));
      };
      es.addEventListener("status", (event) => {
        const messageEvent = event as MessageEvent<string>;
        const orderEvent = JSON.parse(messageEvent.data) as OrderEvent;
        this.zone.run(() => subscriber.next({ kind: "status", event: orderEvent }));
      });
      es.addEventListener("done", (event) => {
        const messageEvent = event as MessageEvent<string>;
        const orderEvent = JSON.parse(messageEvent.data) as OrderEvent;
        this.zone.run(() => subscriber.next({ kind: "done", event: orderEvent }));
        es.close();
      });

      return () => es.close();
    });
  }
}
