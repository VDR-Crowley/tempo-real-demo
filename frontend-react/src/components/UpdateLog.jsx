export default function UpdateLog({ items }) {
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
