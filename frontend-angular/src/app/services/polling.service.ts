import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, interval, switchMap } from "rxjs";

export interface OrderStatus {
  orderId?: string;
  status: string;
  updatedAt: string;
}

@Injectable({ providedIn: "root" })
export class PollingService {
  constructor(private http: HttpClient) {}

  fetchOnce(orderId: string): Observable<OrderStatus> {
    return this.http.get<OrderStatus>(`http://localhost:4000/api/orders/${orderId}`);
  }

  watch(orderId: string, intervalMs = 5000): Observable<OrderStatus> {
    // switchMap cancela a chamada anterior se o próximo tick chegar antes
    return interval(intervalMs).pipe(
      switchMap(() => this.http.get<OrderStatus>(`http://localhost:4000/api/orders/${orderId}`))
    );
  }
}
