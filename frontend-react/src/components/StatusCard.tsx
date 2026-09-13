import type { OrderStatus } from "../types/order";

interface StatusCardProps {
  title: string;
  data: OrderStatus | null;
  connected?: boolean;
}

export default function StatusCard({ title, data, connected }: StatusCardProps) {
  return (
    <div className="status-card">
      <h3>{title}</h3>
      {connected !== undefined && (
        <span className={`badge ${connected ? "on" : "off"}`}>
          {connected ? "conectado" : "desconectado"}
        </span>
      )}
      <p className="status-value">{data?.status ?? "carregando..."}</p>
      <p className="status-time">
        {data?.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : ""}
      </p>
    </div>
  );
}
