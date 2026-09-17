import { api } from "../../services/api";

// POST /api/dev/drop-sse — botão "Simular queda": derruba toda conexão SSE aberta.
export function dropSseConnections(): Promise<{ dropped: number }> {
  return api.post<{ dropped: number }>("/dev/drop-sse").then((res) => res.data);
}
