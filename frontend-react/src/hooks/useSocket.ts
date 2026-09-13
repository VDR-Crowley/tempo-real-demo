import { useEffect, useState } from "react";
import { openOrderSocket } from "../services/socketService";
import type { OrderStatus } from "../types/order";

interface UseSocketResult {
  data: OrderStatus | null;
  log: OrderStatus[];
  connected: boolean;
}

export function useSocket(): UseSocketResult {
  const [data, setData] = useState<OrderStatus | null>(null);
  const [log, setLog] = useState<OrderStatus[]>([]);
  const [connected, setConnected] = useState<boolean>(false);

  useEffect(() => {
    setConnected(true);
    const close = openOrderSocket(
      (snapshot) => {
        setData(snapshot);
        setLog((prev) => [snapshot, ...prev].slice(0, 8));
      },
      () => setConnected(false)
    );

    return () => {
      close();
      setConnected(false);
    };
  }, []);

  return { data, log, connected };
}
