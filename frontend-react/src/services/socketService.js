export function openOrderSocket(onMessage, onError) {
  const ws = new WebSocket("ws://localhost:4000/api/orders/socket");

  ws.onopen = () => ws.send(JSON.stringify({ type: "subscribe" }));
  ws.onmessage = (event) => onMessage(JSON.parse(event.data));
  ws.onerror = (err) => onError?.(err);

  return () => ws.close();
}
