import { Injectable, NgZone } from "@angular/core";
import { Observable } from "rxjs";
import { OrderStatus } from "./polling.service";

@Injectable({ providedIn: "root" })
export class SocketService {
  constructor(private zone: NgZone) {}

  watch(): Observable<OrderStatus> {
    return new Observable<OrderStatus>((subscriber) => {
      const ws = new WebSocket("ws://localhost:4000/api/orders/socket");

      ws.onopen = () => ws.send(JSON.stringify({ type: "subscribe" }));
      ws.onmessage = (event) => {
        this.zone.run(() => subscriber.next(JSON.parse(event.data)));
      };
      ws.onerror = (err) => {
        this.zone.run(() => subscriber.error(err));
      };

      return () => ws.close();
    });
  }
}
