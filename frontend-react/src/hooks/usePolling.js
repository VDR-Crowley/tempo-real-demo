import { useEffect, useRef, useState } from "react";
import { fetchOrderStatus } from "../services/pollingService";

export function usePolling(orderId, intervalMs = 5000) {
  const [data, setData] = useState(null);
  const [log, setLog] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
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
      clearInterval(timerRef.current);
    };
  }, [orderId, intervalMs]);

  return { data, log };
}
