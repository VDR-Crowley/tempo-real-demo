import { useEffect, useRef, useState } from "react";
import { fetchOrderStatus } from "../services/pollingService";
import type { OrderStatus } from "../types/order";

interface UsePollingResult {
  data: OrderStatus | null;
  log: OrderStatus[];
  running: boolean;
  toggle: () => void;
}

export function usePolling(orderId: string, intervalMs = 5000): UsePollingResult {
  const [data, setData] = useState<OrderStatus | null>(null);
  const [log, setLog] = useState<OrderStatus[]>([]);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) {
      return;
    }

    let cancelled = false;

    const tick = async (): Promise<void> => {
      try {
        const result = await fetchOrderStatus(orderId);
        if (!cancelled) {
          setData(result);
          setLog((prev) => [result, ...prev].slice(0, 8));
        }
      } catch {
        // demo: erro de rede fica silencioso, em produção trataria de verdade
      }
    };

    tick();
    timerRef.current = setInterval(tick, intervalMs);

    return () => {
      cancelled = true;
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    };
  }, [orderId, intervalMs, running]);

  const toggle = () => setRunning((r) => !r);

  return { data, log, running, toggle };
}
