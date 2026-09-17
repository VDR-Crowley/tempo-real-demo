import { useState } from "react";
import { usePolling } from "./usePolling";
import { useCurrentOrderId, startNewOrder } from "../../hooks/useCurrentOrder";
import StatusTimeline from "../../components/StatusTimeline";
import MetricsBar from "../../components/MetricsBar";
import EventLog from "../../components/EventLog";

const INTERVAL_OPTIONS = [
  { label: "1s", value: 1000 },
  { label: "3s", value: 3000 },
  { label: "5s", value: 5000 },
];

export default function PollingPanel() {
  const orderId = useCurrentOrderId();
  const [intervalMs, setIntervalMs] = useState(5000);
  const { status, done, rows, metrics, running, toggle, summary } = usePolling(orderId, intervalMs);

  return (
    <section>
      <div className="panel-controls">
        <button onClick={toggle} disabled={done || !orderId}>
          {running ? "Parar" : "Iniciar"}
        </button>
        <button onClick={() => startNewOrder()}>Novo pedido</button>
        <select value={intervalMs} onChange={(e) => setIntervalMs(Number(e.target.value))}>
          {INTERVAL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <StatusTimeline currentStatus={status} done={done} />
      <MetricsBar
        requests={metrics.requests}
        unchanged={metrics.unchanged}
        lastChangeDelayMs={metrics.lastChangeDelayMs}
      />
      {done && summary ? (
        <div className="finish-banner">
          <span className="badge on">concluído</span>
          <p>{summary}</p>
        </div>
      ) : null}
      <EventLog rows={rows} />
    </section>
  );
}
