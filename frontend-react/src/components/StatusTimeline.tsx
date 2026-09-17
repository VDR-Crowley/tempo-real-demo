import { ORDER_STATUSES, type OrderStatusValue } from "../types/order";

interface StatusTimelineProps {
  currentStatus: OrderStatusValue | null;
  done: boolean;
}

export default function StatusTimeline({ currentStatus, done }: StatusTimelineProps) {
  const currentIndex = currentStatus ? ORDER_STATUSES.indexOf(currentStatus) : -1;

  return (
    <ol className="status-timeline">
      {ORDER_STATUSES.map((status, index) => {
        const state =
          index < currentIndex || (index === currentIndex && done)
            ? "done"
            : index === currentIndex
              ? "current"
              : "pending";
        return (
          <li key={status} className={`status-timeline__step status-timeline__step--${state}`}>
            {status}
          </li>
        );
      })}
    </ol>
  );
}
