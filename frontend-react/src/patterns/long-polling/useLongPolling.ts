import { useEffect, useRef, useState } from "react";
import { longPoll } from "./longPollingService";
import type { OrderStatusValue } from "../../types/order";
import type { LogRow } from "../../components/EventLog";

interface LongPollingMetrics {
  requests: number;
  changes: number;
}

interface UseLongPollingResult {
  status: OrderStatusValue | null;
  done: boolean;
  rows: LogRow[];
  metrics: LongPollingMetrics;
  running: boolean;
  toggle: () => void;
  summary: string | null;
}

const MAX_ROWS = 8;
const EMPTY_METRICS: LongPollingMetrics = { requests: 0, changes: 0 };

export function useLongPolling(orderId: string | null): UseLongPollingResult {
  const [status, setStatus] = useState<OrderStatusValue | null>(null);
  const [done, setDone] = useState(false);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [metrics, setMetrics] = useState<LongPollingMetrics>(EMPTY_METRICS);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const lastSeqRef = useRef(0);
  const metricsRef = useRef<LongPollingMetrics>(EMPTY_METRICS);

  useEffect(() => {
    setStatus(null);
    setDone(false);
    setRows([]);
    setSummary(null);
    metricsRef.current = EMPTY_METRICS;
    setMetrics(EMPTY_METRICS);
    lastSeqRef.current = 0;
  }, [orderId]);

  useEffect(() => {
    if (!running || !orderId) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const loop = async (): Promise<void> => {
      while (!cancelled) {
        try {
          const snapshot = await longPoll(orderId, lastSeqRef.current, controller.signal);
          if (cancelled) {
            return;
          }

          const changed = snapshot.seq !== lastSeqRef.current;
          lastSeqRef.current = snapshot.seq;

          const next: LongPollingMetrics = {
            requests: metricsRef.current.requests + 1,
            changes: metricsRef.current.changes + (changed ? 1 : 0),
          };
          metricsRef.current = next;

          setMetrics(next);
          setStatus(snapshot.status);
          setDone(snapshot.done);
          setRows((prev) =>
            [
              {
                key: `${snapshot.seq}-${Date.now()}`,
                primary: changed ? snapshot.status : "sem novidade — servidor devolveu no timeout",
                secondary: new Date(snapshot.updatedAt).toLocaleTimeString(),
                tone: changed ? "changed" : "marker",
              } satisfies LogRow,
              ...prev,
            ].slice(0, MAX_ROWS)
          );

          if (snapshot.done) {
            setRunning(false);
            setSummary(
              `${next.requests} requests para capturar ${next.changes} mudanças — cada uma só voltou quando teve novidade ou estourou o timeout do servidor.`
            );
            return;
          }
        } catch {
          if (cancelled) {
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    };

    loop();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [orderId, running]);

  const toggle = () => setRunning((r) => !r);

  return { status, done, rows, metrics, running, toggle, summary };
}
