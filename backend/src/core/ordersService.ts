import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { ORDER_STATUSES, type OrderEvent, type OrderSnapshot } from "../types/order.js";

// Serviço = única fonte de verdade do estado dos pedidos.
// Rotas (polling/sse/websocket) só leem daqui ou escutam o evento "change" —
// nenhuma delas sabe como o status avança.
//
// Sem avanço automático por tempo — o pedido só muda via advance()
// (controle de palco), pra quem estiver apresentando decidir o ritmo.

interface OrderState {
  orderId: string;
  statusIndex: number;
  seq: number;
  updatedAt: string;
  done: boolean;
  events: OrderEvent[];
}

class OrdersService extends EventEmitter {
  private orders = new Map<string, OrderState>();

  createOrder(): OrderSnapshot {
    const orderId = randomUUID();
    const state: OrderState = {
      orderId,
      statusIndex: 0,
      seq: 1,
      updatedAt: new Date().toISOString(),
      done: false,
      events: [],
    };
    state.events.push(this._buildEvent(state));
    this.orders.set(orderId, state);
    return this._snapshot(state);
  }

  getState(orderId: string): OrderSnapshot | null {
    const state = this.orders.get(orderId);
    return state ? this._snapshot(state) : null;
  }

  getEventsAfter(orderId: string, lastSeq: number): OrderEvent[] {
    const state = this.orders.get(orderId);
    if (!state) {
      return [];
    }
    return state.events.filter((event) => event.seq > lastSeq);
  }

  // Usado pelo long polling: resolve na hora se já tem novidade (seq maior
  // que afterSeq), senão fica pendurado até a próxima mudança, o abort do
  // signal (cliente desconectou) ou o timeout (devolve o mesmo estado —
  // nada mudou, cliente reabre a conexão sozinho).
  waitForChange(
    orderId: string,
    afterSeq: number,
    timeoutMs: number,
    signal?: AbortSignal
  ): Promise<OrderSnapshot | null> {
    const state = this.orders.get(orderId);
    if (!state) {
      return Promise.resolve(null);
    }
    if (state.seq > afterSeq) {
      return Promise.resolve(this._snapshot(state));
    }

    return new Promise((resolve) => {
      let settled = false;

      const finish = (value: OrderSnapshot | null): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        this.off("change", onChange);
        signal?.removeEventListener("abort", onAbort);
        resolve(value);
      };

      const onChange = (event: OrderEvent): void => {
        if (event.orderId === orderId) {
          finish(event);
        }
      };
      const onAbort = (): void => finish(null);
      const timer = setTimeout(() => finish(this._snapshot(state)), timeoutMs);

      this.on("change", onChange);
      signal?.addEventListener("abort", onAbort);
    });
  }

  // Força a próxima transição agora (único jeito do pedido avançar).
  advance(orderId: string): OrderSnapshot | null {
    const state = this.orders.get(orderId);
    if (!state) {
      return null;
    }
    if (state.done) {
      return this._snapshot(state);
    }
    this._advanceState(state);
    return this._snapshot(state);
  }

  private _advanceState(state: OrderState): void {
    state.statusIndex += 1;
    state.seq += 1;
    state.updatedAt = new Date().toISOString();
    state.done = state.statusIndex >= ORDER_STATUSES.length - 1;

    const event = this._buildEvent(state);
    state.events.push(event);
    this.emit("change", event);
  }

  private _buildEvent(state: OrderState): OrderEvent {
    return this._snapshot(state);
  }

  private _snapshot(state: OrderState): OrderSnapshot {
    return {
      orderId: state.orderId,
      status: ORDER_STATUSES[state.statusIndex],
      seq: state.seq,
      updatedAt: state.updatedAt,
      done: state.done,
    };
  }
}

export const ordersService = new OrdersService();
