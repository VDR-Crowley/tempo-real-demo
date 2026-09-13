import { useSocket } from "../hooks/useSocket";
import StatusCard from "./StatusCard";
import UpdateLog from "./UpdateLog";

export default function SocketPanel() {
  const { data, log, connected } = useSocket();
  return (
    <section>
      <StatusCard title="WebSocket" data={data} connected={connected} />
      <UpdateLog items={log} />
    </section>
  );
}
