# Tempo real demo — rewrite pra ciclo finito, SSE de verdade e WebSocket bidirecional

Data: 2026-09-14

## Contexto

Demo ao vivo de palestra (35-40min) sobre polling vs SSE vs WebSocket, pra
plateia front-end (Angular e React lado a lado). Hoje o backend gira em
carrossel infinito, orderId é decorativo, SSE não usa o protocolo de verdade
(sem id/replay/heartbeat), Angular e React têm bug de paridade no
`onerror` do SSE/WebSocket (um mata a reconexão, outro não), e não dá pra
controlar o ritmo da demo no palco.

## Regra de ouro

Angular e React chegam ao mesmo resultado final: mesmas abas, controles,
rótulos, contadores, estados, comportamento em falha. Única diferença
permitida: título e `--accent` (Angular `#ea5e5e`, React `#5ec8ea`). Todo
recurso novo entra nos dois fronts na mesma entrega.

## Sub-projetos (ordem de execução)

1. **Backend** — `ordersService` por pedido, ciclo finito, endpoints novos,
   SSE de protocolo completo, WebSocket bidirecional com chat.
2. **Aba Polling** (Angular + React) — timeline, métricas, fim explícito.
3. **Aba SSE** (Angular + React) — estado de conexão em 4 valores, replay
   via Last-Event-ID, fix de paridade no erro/reconexão.
4. **Aba WebSocket** (Angular + React) — push de status + chat bidirecional,
   presença, indicador de digitação, painel de frames.
5. **Docs** — README raiz + subpastas, com roteiro de demonstração.

Cada etapa só avança com `npm run typecheck` limpo nos pacotes tocados.

## 1. Backend

### `ordersService`

- Estado por pedido: `Map<orderId, OrderState>`.
- `OrderState`: `{ orderId, status, seq, updatedAt, done, events: OrderEvent[], timer: NodeJS.Timeout | null }`.
- `ORDER_STATUSES = ["Recebido", "Em separação", "Em transporte", "Entregue"]`
  — ordem fixa, sem voltar ao início. Ao alcançar `Entregue`: `done = true`,
  `clearInterval(timer)`, nenhum avanço posterior.
- Cada transição gera `OrderEvent { seq, orderId, status, updatedAt, done }`,
  guardado em `events` (no máximo 4 por pedido — o próprio ciclo finito já
  limita, sem necessidade de cap/TTL adicional pra uma demo de palco).
- `createOrder()`: `randomUUID()` (nativo do Node, sem lib nova), status
  inicial `Recebido`, seq 1, inicia timer de auto-avanço a cada `STEP_MS`
  (env, default `3000`).
- `advance(orderId)`: força a próxima transição agora e reseta o timer do
  pedido (evita avanço duplicado logo em seguida).
- `getState(orderId)`, `getEventsAfter(orderId, lastSeq)` (replay pro SSE).

### Endpoints

| Método | Rota | Faz |
|---|---|---|
| POST | `/api/orders` | `createOrder()` → snapshot |
| POST | `/api/orders/:id/advance` | força transição, devolve snapshot |
| GET | `/api/orders/:id` | snapshot atual |
| GET | `/api/orders/:id/stream` | SSE (protocolo abaixo) |
| POST | `/api/dev/drop-sse` | `res.destroy()` em toda conexão SSE aberta, sem avisar cliente |
| ws | `/api/orders/socket` | push de status + chat |

Registro de rotas: `/orders/:id/stream` é mais específico que `/orders/:id`
por causa do segmento extra — Express resolve sem precisar de truque de
ordem (diferente do conflito antigo `/orders/stream` vs `/orders/:id`).

### SSE — protocolo completo

- Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`,
  `Connection: keep-alive`, `X-Accel-Buffering: no`.
- `retry: 3000` mandado uma vez na abertura.
- Lê `req.headers["last-event-id"]` na abertura. Se presente, replay de
  todos eventos com `seq` maior, cada um com `"replay": true` no payload e
  `id: <seq>`.
- Modo live: nova transição → `id: <seq>\nevent: status\ndata: {...}\n\n`.
- Heartbeat: `: heartbeat\n\n` a cada 15s, sem `id`, não conta como evento.
- Ao virar `done`: manda último `event: status`, depois `event: done`, só
  então `res.end()`.
- Cleanup em `req.on("close")` (mantém o que já existe).

### WebSocket — bidirecional (status + chat)

Uma conexão só carrega push de status e chat entre os clientes conectados
(tipicamente uma aba Angular e uma React, na demo).

Cliente → servidor: `hello` (`app`, `nick`), `chat` (`text`), `typing`,
`subscribe` (`orderId`). Validado com type guards (`isHelloMessage`,
`isChatMessage`, etc., seguindo o padrão de `isSubscribeMessage` já
existente) — mensagem malformada é ignorada, socket não cai.

Servidor → cliente (broadcast pra todos, inclusive o remetente — o eco
prova o round-trip): `presence` (`peers: [{id, app, nick}]`), `chat`
(`id, app, nick, text, at`), `typing` (`app, nick`), `status` (`orderId,
status, seq, updatedAt, done`).

### Config

- `STEP_MS` via env, default `3000`.

## 2-4. Frontends (Polling / SSE / WebSocket)

Detalhamento por aba segue literalmente o que já está descrito no pedido
original do usuário (rótulos, controles, textos em português, componentes
espelhados `StatusTimeline`, `MetricsBar`, `EventLog`, `ChatPanel`,
`ConnectionBadge`). Pontos que fixam decisão:

- **Escopo do orderId**: cada app (Angular e React) mantém **um orderId
  "atual" único, no componente raiz/serviço compartilhado**, usado pelas 3
  abas — clicar "Novo pedido" em qualquer aba troca o pedido corrente pras
  outras também. Isso mantém a história coerente se o apresentador trocar
  de aba no meio da demo.
- **Fix de paridade SSE/WebSocket**: nenhum front fecha a conexão no
  `onerror`. Angular: serviço emite união
  `{ kind: "state"; value: ConnectionState } | { kind: "event"; data: OrderEvent }`
  (ou `Subject<ConnectionState>` separado) — nunca `subscriber.error()`.
  React: mesmo padrão equivalente (estado de conexão via `useState`,
  nunca fecha o `EventSource`/`WebSocket` no error handler).
- **Tipos únicos**: Angular ganha `src/app/types/order.ts` com `OrderStatus`
  tipado como union (`"Recebido" | "Em separação" | "Em transporte" |
  "Entregue"`), igual ao React. Nenhum serviço Angular importa tipo de
  outro serviço.
- **URL do backend**: uma constante só por app — `frontend-react/src/config.ts`
  (lê `import.meta.env.VITE_API_URL`, fallback `http://localhost:4000`);
  Angular usa `environments/environment.ts` com o mesmo fallback. Zero URL
  hardcoded em serviço.
- **Sem libs novas**: nada de `socket.io`, `@microsoft/fetch-event-source`,
  `@tanstack/react-query`. API nativa (`EventSource`, `WebSocket`, `fetch`/
  `HttpClient`) é o ponto da palestra.

## 5. Docs

Atualizar `README.md` raiz e de cada subpasta: endpoints novos, protocolo
do chat, formato do event stream, roteiro de demonstração (sequência de
cliques pro palco), conforme já descrito no pedido original.

## Critérios de aceite

Os do pedido original do usuário, na íntegra:
- Polling: novo pedido → 4 etapas avançam → para sozinho em `Entregue` com
  badge concluído → frase de resumo com números coerentes nos dois fronts.
- SSE: conectar → novo pedido → eventos com id crescente → "Simular queda"
  → estado vira `reconectando` → "Avançar agora" com conexão caída →
  reconecta → evento perdido chega marcado `(replay)`, sem buraco na
  sequência → `done` encerra o stream com mensagem explicativa. Idêntico
  nos dois fronts.
- WebSocket: chat cruzado Angular↔React com badge de origem certo,
  presença `2 conectados` cai quando uma aba fecha, painel de frames com
  setas nos dois sentidos.
- `npm run typecheck` limpo em backend, frontend-react, frontend-angular.
- Contador de requests da tela de polling bate com o Network tab.
