import { useCurrentOrderId, startNewOrder } from "../../hooks/useCurrentOrder";
import { useLongPolling } from "./useLongPolling";
import { advanceOrder } from "../../services/orderService";
import StatusTimeline from "../../components/StatusTimeline";
import EventLog from "../../components/EventLog";

export default function LongPollingPanel() {
  const orderId = useCurrentOrderId();
  const { status, done, rows, metrics, running, toggle, summary } = useLongPolling(orderId);

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
      </div>
      <StatusTimeline currentStatus={status} done={done} />
      <p className="last-event-id">
        {metrics.requests} requests · {metrics.changes} mudanças — o servidor segura a conexão o resto do
        tempo, sem request "no vácuo" como no polling comum.
      </p>
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
