import { useSSE } from "../hooks/useSSE";
import StatusCard from "./StatusCard";
import UpdateLog from "./UpdateLog";

export default function SSEPanel() {
  const { data, log, connected } = useSSE();
  return (
    <section>
      <StatusCard title="Server-Sent Events" data={data} connected={connected} />
      <UpdateLog items={log} />
    </section>
  );
}
