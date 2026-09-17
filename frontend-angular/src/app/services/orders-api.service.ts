import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, switchMap, timer } from "rxjs";
import { environment } from "../../environments/environment";
import { OrderSnapshot } from "../types/order";

@Injectable({ providedIn: "root" })
export class OrdersApiService {
  constructor(private http: HttpClient) {}

  createOrder(): Observable<OrderSnapshot> {
    return this.http.post<OrderSnapshot>(`${environment.apiUrl}/api/orders`, {});
  }

  fetchOnce(orderId: string): Observable<OrderSnapshot> {
    return this.http.get<OrderSnapshot>(`${environment.apiUrl}/api/orders/${orderId}`);
  }

  advance(orderId: string): Observable<OrderSnapshot> {
    return this.http.post<OrderSnapshot>(`${environment.apiUrl}/api/orders/${orderId}/advance`, {});
  }

  // timer(0, ms) — primeiro tick imediato, igual ao tick() + setInterval do React.
  watch(orderId: string, intervalMs: number): Observable<OrderSnapshot> {
    return timer(0, intervalMs).pipe(switchMap(() => this.fetchOnce(orderId)));
  }
}
