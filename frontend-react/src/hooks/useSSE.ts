import { useEffect, useState } from "react";
import { openOrderStream } from "../services/sseService";
import type { OrderStatus } from "../types/order";

interface UseSSEResult {
  data: OrderStatus | null;
  log: OrderStatus[];
  connected: boolean;
  running: boolean;
  toggle: () => void;
}

export function useSSE(): UseSSEResult {
  const [data, setData] = useState<OrderStatus | null>(null);
  const [log, setLog] = useState<OrderStatus[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const [running, setRunning] = useState<boolean>(false);

  useEffect(() => {
    if (!running) {
      setConnected(false);
      return;
    }

    setConnected(true);
    const close = openOrderStream(
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
  }, [running]);

  const toggle = () => setRunning((r) => !r);

  return { data, log, connected, running, toggle };
}
