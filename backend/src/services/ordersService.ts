import { EventEmitter } from "node:events";
import { ORDER_STATUSES, type OrderStatusSnapshot } from "../types/order.js";

// Serviço = única fonte de verdade do "estado do pedido".
// Rotas (polling/sse/websocket) só leem daqui ou escutam o evento "change" —
// nenhuma delas sabe como o status é gerado.
// Callbacks de "change" são tipados no ponto de uso (routes, websocket) com
// OrderStatusSnapshot — o EventEmitter em si continua a API padrão do Node.

class OrdersService extends EventEmitter {
  private currentIndex: number;
  private updatedAt: string;

  constructor() {
    super();
    this.currentIndex = 0;
    this.updatedAt = new Date().toISOString();
    this._startSimulation();
  }

  getStatus(): OrderStatusSnapshot {
    return {
      status: ORDER_STATUSES[this.currentIndex],
      updatedAt: this.updatedAt,
    };
  }

  private _advance(): OrderStatusSnapshot {
    this.currentIndex = (this.currentIndex + 1) % ORDER_STATUSES.length;
    this.updatedAt = new Date().toISOString();
    const snapshot = this.getStatus();
    this.emit("change", snapshot);
    return snapshot;
  }

  private _startSimulation(): void {
    // troca de status a cada 5s — só pra ter algo "mudando de verdade" na demo
    setInterval(() => this._advance(), 5000);
  }
}

export const ordersService = new OrdersService();
