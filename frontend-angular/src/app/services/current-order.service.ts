import { Injectable } from "@angular/core";
import { BehaviorSubject, firstValueFrom } from "rxjs";
import { OrdersApiService } from "./orders-api.service";

// Pedido "corrente" do app — compartilhado pelas 3 abas. Trocar de pedido
// numa aba troca pras outras também, pra manter a história coerente se o
// apresentador mudar de aba no meio da demo.
@Injectable({ providedIn: "root" })
export class CurrentOrderService {
  private orderIdSubject = new BehaviorSubject<string | null>(null);
  readonly orderId$ = this.orderIdSubject.asObservable();

  constructor(private ordersApi: OrdersApiService) {}

  async startNewOrder(): Promise<void> {
    const snapshot = await firstValueFrom(this.ordersApi.createOrder());
    this.orderIdSubject.next(snapshot.orderId);
  }
}
