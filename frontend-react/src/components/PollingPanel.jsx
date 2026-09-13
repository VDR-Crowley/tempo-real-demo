import { usePolling } from "../hooks/usePolling";
import StatusCard from "./StatusCard";
import UpdateLog from "./UpdateLog";

export default function PollingPanel() {
  const { data, log } = usePolling("123", 5000);
  return (
    <section>
      <StatusCard title="Polling (GET a cada 5s)" data={data} />
      <UpdateLog items={log} />
    </section>
  );
}
