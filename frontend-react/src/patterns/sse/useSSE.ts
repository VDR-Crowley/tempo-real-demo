import { useEffect, useRef, useState } from "react";
import { openOrderStream } from "./sseService";
import type { OrderStatusValue } from "../../types/order";
import type { LogRow } from "../../components/EventLog";
import type { ConnectionState } from "../../components/ConnectionBadge";

interface UseSSEResult {
  status: OrderStatusValue | null;
  done: boolean;
  connectionState: ConnectionState;
  lastEventId: number | null;
  attempt: number;
  retryInSeconds: number;
  rows: LogRow[];
  running: boolean;
  toggle: () => void;
}

const MAX_ROWS = 8;
const RETRY_SECONDS = 3;

export function useSSE(orderId: string | null): UseSSEResult {
  const [status, setStatus] = useState<OrderStatusValue | null>(null);
  const [done, setDone] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("desconectado");
  const [lastEventId, setLastEventId] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [retryInSeconds, setRetryInSeconds] = useState(RETRY_SECONDS);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [running, setRunning] = useState(false);

  const hasConnectedOnceRef = useRef(false);
  const attemptRef = useRef(0);
  const lastEventIdRef = useRef<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addRow = (row: LogRow): void => {
    setRows((prev) => [row, ...prev].slice(0, MAX_ROWS));
  };

  const stopCountdown = (): void => {
    if (countdownRef.current !== null) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  const startCountdown = (): void => {
    stopCountdown();
    let remaining = RETRY_SECONDS;
    setRetryInSeconds(remaining);
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setRetryInSeconds(Math.max(remaining, 0));
      if (remaining <= 0) {
        stopCountdown();
      }
    }, 1000);
  };

  useEffect(() => {
    setStatus(null);
    setDone(false);
    setConnectionState("desconectado");
    setLastEventId(null);
    setAttempt(0);
    setRows([]);
    hasConnectedOnceRef.current = false;
    attemptRef.current = 0;
    lastEventIdRef.current = null;
    stopCountdown();
  }, [orderId]);

  useEffect(() => {
    if (!running || !orderId) {
      return;
    }

    setConnectionState("conectando");
    hasConnectedOnceRef.current = false;
    attemptRef.current = 0;

    const connection = openOrderStream(orderId, {
      onOpen: () => {
        stopCountdown();
        if (hasConnectedOnceRef.current) {
          addRow({
            key: `reconnect-${Date.now()}`,
            primary: `↻ reconectado — retomando do id ${lastEventIdRef.current ?? "?"}`,
            tone: "marker",
          });
        }
        hasConnectedOnceRef.current = true;
        attemptRef.current = 0;
        setAttempt(0);
        setConnectionState("conectado");
      },
      onError: () => {
        if (!hasConnectedOnceRef.current) {
          setConnectionState("conectando");
          return;
        }
        attemptRef.current += 1;
        if (attemptRef.current === 1) {
          addRow({ key: `drop-${Date.now()}`, primary: "⚡ conexão caiu", tone: "marker" });
        }
        setAttempt(attemptRef.current);
        setConnectionState("reconectando");
        startCountdown();
      },
      onStatus: (event) => {
        lastEventIdRef.current = event.seq;
        setLastEventId(event.seq);
        setStatus(event.status);
        addRow({
          key: `${event.seq}-${Date.now()}`,
          primary: event.status,
          secondary: `id ${event.seq}${event.replay ? " (replay)" : ""}`,
          tone: "changed",
        });
      },
      onDone: (event) => {
        lastEventIdRef.current = event.seq;
        setLastEventId(event.seq);
        setStatus(event.status);
        setDone(true);
        setConnectionState("desconectado");
        setRunning(false);
        addRow({
          key: `done-${Date.now()}`,
          primary: "stream encerrado pelo servidor — e fechado pelo cliente, senão o navegador reconectaria pra sempre",
          tone: "marker",
        });
      },
    });

    return () => {
      connection.close();
      stopCountdown();
    };
  }, [orderId, running]);

  const toggle = () => setRunning((r) => !r);

  return { status, done, connectionState, lastEventId, attempt, retryInSeconds, rows, running, toggle };
}
