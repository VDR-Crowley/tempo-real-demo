import { EventEmitter } from "node:events";

// Serviço = única fonte de verdade do "estado do pedido".
// Rotas (polling/sse/websocket) só leem daqui ou escutam o evento "change" —
// nenhuma delas sabe como o status é gerado.
const STATUSES = ["Recebido", "Em separação", "Em transporte", "Entregue"];

class OrdersService extends EventEmitter {
  constructor() {
    super();
    this.currentIndex = 0;
    this.updatedAt = new Date().toISOString();
    this._startSimulation();
  }

  getStatus() {
    return {
      status: STATUSES[this.currentIndex],
      updatedAt: this.updatedAt,
    };
  }

  _advance() {
    this.currentIndex = (this.currentIndex + 1) % STATUSES.length;
    this.updatedAt = new Date().toISOString();
    const snapshot = this.getStatus();
    this.emit("change", snapshot);
    return snapshot;
  }

  _startSimulation() {
    // troca de status a cada 5s — só pra ter algo "mudando de verdade" na demo
    setInterval(() => this._advance(), 5000);
  }
}

export const ordersService = new OrdersService();
