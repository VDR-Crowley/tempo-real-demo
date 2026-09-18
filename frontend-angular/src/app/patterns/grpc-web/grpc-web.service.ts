import { Injectable, NgZone } from "@angular/core";
import { Observable } from "rxjs";
import { createClient } from "@connectrpc/connect";
import { createGrpcWebTransport } from "@connectrpc/connect-web";
import { environment } from "../../../environments/environment";
import { OrderStreamService } from "../../../generated/order_stream_pb";
import type { OrderSnapshot as GrpcOrderSnapshot } from "../../../generated/order_stream_pb";
import { OrderEvent, OrderStatusValue } from "../../types/order";

export type GrpcWebUpdate =
  | { kind: "open" }
  | { kind: "error" }
  | { kind: "status"; event: OrderEvent }
  | { kind: "done"; event: OrderEvent };

function toOrderEvent(snapshot: GrpcOrderSnapshot): OrderEvent {
  return {
    orderId: snapshot.orderId,
    status: snapshot.status as OrderStatusValue,
    seq: snapshot.seq,
    updatedAt: snapshot.updatedAt,
    done: snapshot.done,
  };
}

@Injectable({ providedIn: "root" })
export class GrpcWebService {
  private readonly client = createClient(
    OrderStreamService,
    createGrpcWebTransport({ baseUrl: environment.apiUrl })
  );

  constructor(private zone: NgZone) {}

  // Sem reconexão automática (isso é coisa do EventSource/SSE) — quem
  // assina decide o que fazer no "error", igual ao componente do gRPC-Web.
  watch(orderId: string): Observable<GrpcWebUpdate> {
    return new Observable<GrpcWebUpdate>((subscriber) => {
      const controller = new AbortController();

      (async () => {
        try {
          this.zone.run(() => subscriber.next({ kind: "open" }));
          for await (const snapshot of this.client.watchOrder({ orderId }, { signal: controller.signal })) {
            const event = toOrderEvent(snapshot);
            if (snapshot.done) {
              this.zone.run(() => subscriber.next({ kind: "done", event }));
              return;
            }
            this.zone.run(() => subscriber.next({ kind: "status", event }));
          }
        } catch {
          if (controller.signal.aborted) {
            return;
          }
          this.zone.run(() => subscriber.next({ kind: "error" }));
        }
      })();

      return () => controller.abort();
    });
  }

  advance(orderId: string): Promise<void> {
    return this.client.advanceOrder({ orderId }).then(() => undefined);
  }
}
