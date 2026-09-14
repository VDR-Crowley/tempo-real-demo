import { usePolling } from "../hooks/usePolling";
import StatusCard from "./StatusCard";
import UpdateLog from "./UpdateLog";

export default function PollingPanel() {
  const { data, log, running, toggle } = usePolling("123", 5000);
  return (
    <section>
      <div className="panel-controls">
        <button onClick={toggle}>{running ? "Parar" : "Iniciar"}</button>
      </div>
      <StatusCard title="Polling (GET a cada 5s)" data={data} />
      <UpdateLog items={log} />
    </section>
  );
}
