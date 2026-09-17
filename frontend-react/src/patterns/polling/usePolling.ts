import { useEffect, useRef, useState } from "react";
import { fetchOrderStatus } from "../../services/orderService";
import type { OrderStatusValue } from "../../types/order";
import type { LogRow } from "../../components/EventLog";

interface PollingMetrics {
  requests: number;
  unchanged: number;
  changes: number;
  lastChangeDelayMs: number | null;
}

interface UsePollingResult {
  status: OrderStatusValue | null;
  done: boolean;
  rows: LogRow[];
  metrics: PollingMetrics;
  running: boolean;
  toggle: () => void;
  summary: string | null;
}

const MAX_ROWS = 8;
const EMPTY_METRICS: PollingMetrics = { requests: 0, unchanged: 0, changes: 0, lastChangeDelayMs: null };

export function usePolling(orderId: string | null, intervalMs: number): UsePollingResult {
  const [status, setStatus] = useState<OrderStatusValue | null>(null);
  const [done, setDone] = useState(false);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [metrics, setMetrics] = useState<PollingMetrics>(EMPTY_METRICS);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSeqRef = useRef<number | null>(null);
  const delaySumRef = useRef(0);
  const metricsRef = useRef<PollingMetrics>(EMPTY_METRICS);

  useEffect(() => {
    setStatus(null);
    setDone(false);
    setRows([]);
    setSummary(null);
    metricsRef.current = EMPTY_METRICS;
    setMetrics(EMPTY_METRICS);
    lastSeqRef.current = null;
    delaySumRef.current = 0;
  }, [orderId]);

  useEffect(() => {
    if (!running || !orderId) {
      return;
    }

    let cancelled = false;

    const tick = async (): Promise<void> => {
      try {
        const snapshot = await fetchOrderStatus(orderId);
        if (cancelled) {
          return;
        }

        const changed = lastSeqRef.current !== snapshot.seq;
        lastSeqRef.current = snapshot.seq;

        const arrivedAt = Date.now();
        const delayMs = changed ? arrivedAt - new Date(snapshot.updatedAt).getTime() : null;
        if (changed && delayMs !== null) {
          delaySumRef.current += delayMs;
        }

        const next: PollingMetrics = {
          requests: metricsRef.current.requests + 1,
          unchanged: metricsRef.current.unchanged + (changed ? 0 : 1),
          changes: metricsRef.current.changes + (changed ? 1 : 0),
          lastChangeDelayMs: changed ? delayMs : metricsRef.current.lastChangeDelayMs,
        };
        metricsRef.current = next;

        setStatus(snapshot.status);
        setDone(snapshot.done);
        setMetrics(next);
        setRows((prev) =>
          [
            {
              key: `${snapshot.seq}-${arrivedAt}`,
              primary: snapshot.status,
              secondary: new Date(snapshot.updatedAt).toLocaleTimeString(),
              tone: changed ? "changed" : "unchanged",
            } satisfies LogRow,
            ...prev,
          ].slice(0, MAX_ROWS)
        );

        if (snapshot.done) {
          setRunning(false);
          const wastePercent = next.requests > 0 ? Math.round((next.unchanged / next.requests) * 100) : 0;
          const avgDelaySeconds = next.changes > 0 ? delaySumRef.current / next.changes / 1000 : 0;
          setSummary(
            `${next.requests} requests para capturar ${next.changes} mudanças — ${wastePercent}% foram desperdício. Atraso médio: ${avgDelaySeconds.toFixed(1)}s.`
          );
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

  return { status, done, rows, metrics, running, toggle, summary };
}
