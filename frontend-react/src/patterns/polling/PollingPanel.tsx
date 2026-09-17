import { useEffect, useState } from "react";
import { usePolling } from "./usePolling";
import { useCurrentOrderId, startNewOrder } from "../../hooks/useCurrentOrder";
import { advanceOrder } from "../../services/orderService";
import StatusTimeline from "../../components/StatusTimeline";
import MetricsBar from "../../components/MetricsBar";
import EventLog from "../../components/EventLog";
import Select from "../../components/Select";

const INTERVAL_OPTIONS = [
  { label: "1s", value: 1000 },
  { label: "3s", value: 3000 },
  { label: "5s", value: 5000 },
];

const AUTO_ADVANCE_MS = 10000;

export default function PollingPanel() {
  const orderId = useCurrentOrderId();
  const [intervalMs, setIntervalMs] = useState(5000);
  const { status, done, rows, metrics, running, toggle, summary } = usePolling(orderId, intervalMs);

  useEffect(() => {
    if (!running || !orderId || done) {
      return;
    }
    const timer = setInterval(() => {
      advanceOrder(orderId);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [running, orderId, done]);

  return (
    <section>
      <div className="panel-controls">
        <button onClick={toggle} disabled={done || !orderId}>
          {running ? "Parar" : "Iniciar"}
        </button>
        <button onClick={() => startNewOrder()}>Novo pedido</button>
        <button onClick={() => orderId && advanceOrder(orderId)} disabled={!orderId || done}>
          Avançar agora
        </button>
        <Select value={intervalMs} options={INTERVAL_OPTIONS} onChange={setIntervalMs} />
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
