import { Injectable, NgZone } from "@angular/core";
import { Observable } from "rxjs";
import { OrderStatus } from "./polling.service";

@Injectable({ providedIn: "root" })
export class SseService {
  constructor(private zone: NgZone) {}

  watch(): Observable<OrderStatus> {
    return new Observable<OrderStatus>((subscriber) => {
      const es = new EventSource("http://localhost:4000/api/orders/stream");

      es.onmessage = (event) => {
        this.zone.run(() => subscriber.next(JSON.parse(event.data)));
      };
      es.onerror = (err) => {
        this.zone.run(() => subscriber.error(err));
      };

      return () => es.close();
    });
  }
}
