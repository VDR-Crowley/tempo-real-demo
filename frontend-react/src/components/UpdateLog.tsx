import type { OrderStatus } from "../types/order";

interface UpdateLogProps {
  items: OrderStatus[];
}

export default function UpdateLog({ items }: UpdateLogProps) {
  return (
    <ul className="update-log">
      {items.map((item, i) => (
        <li key={item.updatedAt + i}>
          <strong>{item.status}</strong> — {new Date(item.updatedAt).toLocaleTimeString()}
        </li>
      ))}
    </ul>
  );
}
