interface MetricsBarProps {
  requests: number;
  unchanged: number;
  lastChangeDelayMs: number | null;
}

export default function MetricsBar({ requests, unchanged, lastChangeDelayMs }: MetricsBarProps) {
  const wastePercent = requests > 0 ? Math.round((unchanged / requests) * 100) : 0;

  return (
    <div className="metrics-bar">
      <div className="metrics-bar__item">
        <span className="metrics-bar__value">{requests}</span>
        <span className="metrics-bar__label">requests</span>
      </div>
      <div className="metrics-bar__item">
        <span className="metrics-bar__value">{unchanged}</span>
        <span className="metrics-bar__label">sem mudança</span>
      </div>
      <div className="metrics-bar__item">
        <span className="metrics-bar__value">{wastePercent}%</span>
        <span className="metrics-bar__label">desperdício</span>
      </div>
      <div className="metrics-bar__item">
        <span className="metrics-bar__value">
          {lastChangeDelayMs !== null ? `${(lastChangeDelayMs / 1000).toFixed(1)}s` : "—"}
        </span>
        <span className="metrics-bar__label">atraso da última mudança</span>
      </div>
    </div>
  );
}
