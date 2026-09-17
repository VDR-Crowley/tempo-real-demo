# Frontend React — tempo real demo

Cada pattern mora na própria pasta em `src/patterns/<nome>/`: serviço
(fetch/EventSource/WebSocket) + hook (liga o serviço ao ciclo de vida do
componente) + painel (`.tsx`, só recebe dado do hook e renderiza — nunca
toca em `fetch`/`EventSource`/`WebSocket` direto).

```
src/
├── types/            order.ts, ws.ts — mesmo shape do backend
├── config.ts          # única constante de URL do backend (VITE_API_URL, fallback localhost:4000)
├── services/api.ts, orderService.ts   # criar/buscar/avançar pedido — usado por todos os patterns
├── hooks/useCurrentOrder.ts            # pedido "corrente", compartilhado pelas 4 abas
├── components/         # StatusTimeline, ConnectionBadge, MetricsBar, EventLog, ChatPanel — dumb, sem saber de qual pattern vieram
└── patterns/
    ├── polling/        usePolling.ts + PollingPanel.tsx
    ├── long-polling/   longPollingService.ts + useLongPolling.ts + LongPollingPanel.tsx
    ├── sse/            sseService.ts + devService.ts + useSSE.ts + SSEPanel.tsx
    └── websocket/      socketService.ts + useSocket.ts + SocketPanel.tsx
```

```
npm install
npm run dev       # http://localhost:5173 — precisa do backend rodando em :4000
npm run build     # tsc -b (typecheck) + vite build
npm run typecheck # só o typecheck (tsc -b)
```

`VITE_API_URL` (env, opcional) sobrescreve a URL do backend — sem ela,
cai em `http://localhost:4000`.
