import { useEffect, useRef, useState } from "react";
import { openOrderStream } from "./grpcWebService";
import type { OrderStatusValue } from "../../types/order";
import type { LogRow } from "../../components/EventLog";
import type { ConnectionState } from "../../components/ConnectionBadge";

interface UseGrpcWebResult {
  status: OrderStatusValue | null;
  done: boolean;
  connectionState: ConnectionState;
  attempt: number;
  retryInSeconds: number;
  rows: LogRow[];
  running: boolean;
  toggle: () => void;
}

const MAX_ROWS = 8;
const RETRY_SECONDS = 3;

export function useGrpcWeb(orderId: string | null): UseGrpcWebResult {
  const [status, setStatus] = useState<OrderStatusValue | null>(null);
  const [done, setDone] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("desconectado");
  const [attempt, setAttempt] = useState(0);
  const [retryInSeconds, setRetryInSeconds] = useState(RETRY_SECONDS);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [running, setRunning] = useState(false);

  const attemptRef = useRef(0);
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

  const startCountdown = (onFinish: () => void): void => {
    stopCountdown();
    let remaining = RETRY_SECONDS;
    setRetryInSeconds(remaining);
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setRetryInSeconds(Math.max(remaining, 0));
      if (remaining <= 0) {
        stopCountdown();
        onFinish();
      }
    }, 1000);
  };

  useEffect(() => {
    setStatus(null);
    setDone(false);
    setConnectionState("desconectado");
    setAttempt(0);
    setRows([]);
    attemptRef.current = 0;
    stopCountdown();
  }, [orderId]);

  useEffect(() => {
    if (!running || !orderId) {
      return;
    }

    let cancelled = false;
    let connection: ReturnType<typeof openOrderStream> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    setConnectionState("conectando");
    attemptRef.current = 0;

    // Stream gRPC-Web não reconecta sozinho (diferente do EventSource do
    // SSE) — no erro, agenda uma nova tentativa depois do countdown.
    const connect = (): void => {
      if (cancelled) {
        return;
      }
      connection = openOrderStream(orderId, {
        onOpen: () => {
          stopCountdown();
          attemptRef.current = 0;
          setAttempt(0);
          setConnectionState("conectado");
        },
        onError: () => {
          attemptRef.current += 1;
          if (attemptRef.current === 1) {
            addRow({ key: `drop-${Date.now()}`, primary: "⚡ conexão caiu", tone: "marker" });
          }
          setAttempt(attemptRef.current);
          setConnectionState("reconectando");
          startCountdown(() => {
            reconnectTimer = setTimeout(connect, 0);
          });
        },
        onStatus: (event) => {
          setStatus(event.status);
          addRow({
            key: `${event.seq}-${Date.now()}`,
            primary: event.status,
            secondary: `seq ${event.seq}`,
            tone: "changed",
          });
        },
        onDone: (event) => {
          setStatus(event.status);
          setDone(true);
          setConnectionState("desconectado");
          setRunning(false);
          addRow({ key: `done-${Date.now()}`, primary: "stream encerrado pelo servidor", tone: "marker" });
        },
      });
    };

    connect();

    return () => {
      cancelled = true;
      stopCountdown();
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
      }
      connection?.close();
    };
  }, [orderId, running]);

  const toggle = () => setRunning((r) => !r);

  return { status, done, connectionState, attempt, retryInSeconds, rows, running, toggle };
}
