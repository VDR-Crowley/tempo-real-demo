export function openOrderStream(onMessage, onError) {
  const es = new EventSource("http://localhost:4000/api/orders/stream");

  es.onmessage = (event) => onMessage(JSON.parse(event.data));
  es.onerror = (err) => onError?.(err);

  return () => es.close();
}
