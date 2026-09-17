export interface LogRow {
  key: string;
  primary: string;
  secondary?: string;
  tone: "changed" | "unchanged" | "marker";
}

interface EventLogProps {
  rows: LogRow[];
}

export default function EventLog({ rows }: EventLogProps) {
  const lastKey = rows[rows.length - 1]?.key;

  return (
    <ul className="event-log">
      {rows.map((row) => (
        <li
          key={row.key}
          className={`event-log__row event-log__row--${row.tone}${row.key === lastKey ? " event-log__row--enter" : ""}`}
        >
          <strong>{row.primary}</strong>
          {row.secondary ? <span className="event-log__secondary"> — {row.secondary}</span> : null}
        </li>
      ))}
    </ul>
  );
}
