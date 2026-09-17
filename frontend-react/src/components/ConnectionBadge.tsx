export type ConnectionState = "desconectado" | "conectando" | "conectado" | "reconectando";

interface ConnectionBadgeProps {
  state: ConnectionState;
  attempt?: number;
  retryInSeconds?: number;
}

const LABELS: Record<ConnectionState, string> = {
  desconectado: "desconectado",
  conectando: "conectando",
  conectado: "conectado",
  reconectando: "reconectando",
};

export default function ConnectionBadge({ state, attempt, retryInSeconds }: ConnectionBadgeProps) {
  const label =
    state === "reconectando" && attempt !== undefined && retryInSeconds !== undefined
      ? `reconectando (tentativa ${attempt}, em ${retryInSeconds}s)`
      : LABELS[state];

  return (
    <span className={`badge badge--${state}`}>
      <span className="badge__dot" />
      {label}
    </span>
  );
}
