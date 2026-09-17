import { useCurrentOrderId, startNewOrder } from "../../hooks/useCurrentOrder";
import { useSSE } from "./useSSE";
import { advanceOrder } from "../../services/orderService";
import { dropSseConnections } from "./devService";
import StatusTimeline from "../../components/StatusTimeline";
import ConnectionBadge from "../../components/ConnectionBadge";
import EventLog from "../../components/EventLog";

export default function SSEPanel() {
  const orderId = useCurrentOrderId();
  const { status, done, connectionState, lastEventId, attempt, retryInSeconds, rows, running, toggle } =
    useSSE(orderId);

  return (
    <section>
      <div className="panel-controls">
        <button onClick={toggle} disabled={done || !orderId}>
          {running ? "Desconectar" : "Conectar"}
        </button>
        <button onClick={() => startNewOrder()}>Novo pedido</button>
        <button onClick={() => dropSseConnections()} disabled={connectionState !== "conectado"}>
          Simular queda
        </button>
        <button onClick={() => orderId && advanceOrder(orderId)} disabled={!orderId || done}>
          Avançar agora
        </button>
      </div>
      <ConnectionBadge state={connectionState} attempt={attempt} retryInSeconds={retryInSeconds} />
      <p className="last-event-id">Last-Event-ID: {lastEventId ?? "—"}</p>
      <StatusTimeline currentStatus={status} done={done} />
      <EventLog rows={rows} />
    </section>
  );
}
