import { useSSE } from "../hooks/useSSE";
import StatusCard from "./StatusCard";
import UpdateLog from "./UpdateLog";

export default function SSEPanel() {
  const { data, log, connected, running, toggle } = useSSE();
  return (
    <section>
      <div className="panel-controls">
        <button onClick={toggle}>{running ? "Parar" : "Iniciar"}</button>
      </div>
      <StatusCard title="Server-Sent Events" data={data} connected={connected} />
      <UpdateLog items={log} />
    </section>
  );
}
