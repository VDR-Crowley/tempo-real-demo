import { useEffect, useState } from "react";
import { createOrder } from "../services/orderService";

// Pedido "corrente" do app — compartilhado pelas 3 abas. Trocar de pedido
// numa aba troca pras outras também, pra manter a história coerente se o
// apresentador mudar de aba no meio da demo.

type Listener = (orderId: string | null) => void;

let currentOrderId: string | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) {
    listener(currentOrderId);
  }
}

export async function startNewOrder(): Promise<void> {
  const snapshot = await createOrder();
  currentOrderId = snapshot.orderId;
  notify();
}

export function useCurrentOrderId(): string | null {
  const [orderId, setOrderId] = useState<string | null>(currentOrderId);

  useEffect(() => {
    listeners.add(setOrderId);
    return () => {
      listeners.delete(setOrderId);
    };
  }, []);

  return orderId;
}
