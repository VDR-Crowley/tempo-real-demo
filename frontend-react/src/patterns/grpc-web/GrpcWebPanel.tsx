import { useEffect } from "react";
import { useCurrentOrderId, startNewOrder } from "../../hooks/useCurrentOrder";
import { useGrpcWeb } from "./useGrpcWeb";
import { advanceOrder } from "./grpcWebService";
import StatusTimeline from "../../components/StatusTimeline";
import ConnectionBadge from "../../components/ConnectionBadge";
import EventLog from "../../components/EventLog";

const AUTO_ADVANCE_MS = 5000;

export default function GrpcWebPanel() {
  const orderId = useCurrentOrderId();
  const { status, done, connectionState, attempt, retryInSeconds, rows, running, toggle } = useGrpcWeb(orderId);

  useEffect(() => {
    if (!orderId || done || connectionState !== "conectado") {
      return;
    }
    const timer = setInterval(() => {
      advanceOrder(orderId);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [orderId, done, connectionState]);

  return (
    <section>
      <div className="panel-controls">
        <button onClick={toggle} disabled={done || !orderId}>
          {running ? "Desconectar" : "Conectar"}
        </button>
        <button onClick={() => startNewOrder()}>Novo pedido</button>
        <button onClick={() => orderId && advanceOrder(orderId)} disabled={!orderId || done}>
          Avançar agora
        </button>
      </div>
      <ConnectionBadge state={connectionState} attempt={attempt} retryInSeconds={retryInSeconds} />
      <StatusTimeline currentStatus={status} done={done} />
      <EventLog rows={rows} />
    </section>
  );
}
