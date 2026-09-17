# Backend — tempo real demo

Um serviço só (`core/ordersService.ts`) guardando o estado de cada pedido
(`Map<orderId, ...>`) e emitindo um evento `change` sempre que um deles
muda. Os patterns só leem/escutam esse serviço — nenhum deles sabe como o
status avança. Sem timer automático: o pedido só muda via `advance()`
(controle de palco), chamado pelo botão "Avançar agora" ou por qualquer
chamada direta à API.

```
backend/src/
├── types/            # order.ts (status/seq/done), ws.ts (protocolo do chat)
├── core/
│   ├── orders.route.ts     # POST /orders, POST /orders/:id/advance — usado por todos os patterns
│   └── ordersService.ts    # única fonte de verdade do estado dos pedidos
├── patterns/
│   ├── polling/       polling.route.ts        # GET /orders/:id
│   ├── long-polling/  long-polling.route.ts   # GET /orders/:id/long-poll
│   ├── sse/           sse.route.ts            # GET /orders/:id/stream + POST /dev/drop-sse
│   └── websocket/     websocket.ts            # ws /orders/socket (status + chat)
└── server.ts
```

## Rodando

```
npm install
npm run dev       # tsx watch — http://localhost:4000, recompila a cada mudança
npm run build     # tsc -> dist/
npm start         # roda o build (dist/server.js)
npm run typecheck # tsc --noEmit
```

Env vars: `PORT` (default `4000`), `LONG_POLL_TIMEOUT_MS` (default
`25000` — quanto tempo o long polling segura a resposta antes de devolver
o mesmo estado de qualquer jeito).

## Endpoints

| Método | Rota | Pattern |
|---|---|---|
| POST | `/api/orders` | — (criar pedido) |
| POST | `/api/orders/:id/advance` | — (avançar, controle de palco) |
| GET | `/api/orders/:id` | polling |
| GET | `/api/orders/:id/long-poll?sinceSeq=N` | long polling |
| GET | `/api/orders/:id/stream` | SSE |
| POST | `/api/dev/drop-sse` | SSE (simular queda) |
| ws | `/api/orders/socket` | WebSocket |

## Protocolo SSE (`patterns/sse/sse.route.ts`)

```
retry: 3000

id: 2
event: status
data: {"orderId":"...","status":"Em separação","seq":2,"updatedAt":"...","replay":false}

: heartbeat            <- comentário a cada 15s, keep-alive
```

- Lê `Last-Event-ID` na abertura; se vier preenchido, faz replay de todo
  evento com `seq` maior, marcado com `"replay": true` no payload.
- Ao chegar em `Entregue`: manda o último `event: status`, depois um
  `event: done`, só então encerra a resposta.
- `Content-Type: text/event-stream`, `Cache-Control: no-cache`,
  `Connection: keep-alive`, `X-Accel-Buffering: no`.

## Protocolo do chat WebSocket (`patterns/websocket/websocket.ts`)

Uma conexão só carrega push de status (por `subscribe`) e chat entre os
clientes conectados.

Cliente → servidor: `{"type":"hello","app":"angular"|"react","nick":string}`,
`{"type":"chat","text":string}`, `{"type":"typing"}`,
`{"type":"subscribe","orderId":string}`.

Servidor → cliente (broadcast pra todos, inclusive quem enviou — o eco
prova o round-trip): `{"type":"presence","peers":[...]}`,
`{"type":"chat","id","app","nick","text","at"}`,
`{"type":"typing","app","nick"}`,
`{"type":"status","orderId","status","seq","updatedAt","done"}`.

## Onde entra o HTTP Streaming

Não tem pattern próprio aqui — ver o comentário em `server.ts`: ele mora
entre long polling e SSE (mandar pedaço e continuar aberto, sem o
contrato de evento que o SSE tem em cima).
