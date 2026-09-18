# Padrão gRPC-Web — React + Angular (design)

**Data:** 2026-09-17
**Status:** aprovado

## Contexto

Projeto demo educacional com 4 padrões de tempo real (Polling, Long Polling,
SSE, WebSocket), cada um com pasta espelhada em `backend/src/patterns/`,
`frontend-react/src/patterns/` e `frontend-angular/src/app/patterns/`, mais
uma aba própria em cada frontend.

Adicionar um 5º padrão: gRPC-Web. Objetivo: demonstrar server-streaming via
gRPC-Web (o único estilo de streaming que roda de fato no browser hoje —
client-streaming e bidi streaming não são suportados pela especificação
gRPC-Web no lado do cliente web).

## Objetivo

Painel gRPC-Web que:
- Recebe o status do pedido via stream server-to-client (espelha o
  papel do SSE).
- Tem botão "Avançar agora" (RPC unary) e avanço automático por timer
  (5s enquanto conectado), consistente com o padrão já usado no SSE e
  Polling.
- Usa o protocolo gRPC-Web de fato (não o protocolo proprietário do
  Connect) — verificável pelo `content-type: application/grpc-web` nas
  chamadas de rede.

## Decisões de arquitetura

**Sem proxy Envoy.** Uso Connect (`@connectrpc/connect-*`, da Buf) em vez do
par clássico `grpc-web` + Envoy. Connect fala Connect-protocol, gRPC e
gRPC-Web no mesmo endpoint HTTP/1.1 — sem infra nova, sem trocar o servidor
Node/Express existente por HTTP/2. Cliente força `createGrpcWebTransport`
explicitamente para garantir que o wire format seja gRPC-Web mesmo com o
servidor multi-protocolo.

**Isolamento dos outros 4 padrões:**
- Middleware Connect monta em path próprio (`/tempo.real.v1.OrderStreamService/*`),
  sem tocar prefixo `/api/*` dos outros padrões.
- Servidor continua HTTP/1.1 puro — WebSocket (`attachWebSocket`) e as
  outras rotas ficam intactas.
- CORS só ganha headers adicionais (aditivo, não remove nada).
- Único arquivo compartilhado que muda: `backend/src/server.ts` (uma linha
  de `app.use()` nova) e os `package.json` de cada app (deps novas).

**Codegen do `.proto`:** Buf via npm (`@bufbuild/buf` como devDependency,
sem instalar `protoc` binário separado). Fonte única em
`proto/order_stream.proto` na raiz do repo (sem workspace/monorepo tool —
cada app já é independente hoje). Cada um dos 3 apps (backend,
frontend-react, frontend-angular) tem seu próprio `buf.gen.yaml` gerando
pro seu `src/generated/`, seguindo o padrão já existente de cada app
duplicar seus próprios tipos em vez de compartilhar pacote.

**Código gerado é comitado.** Regeneração é manual (`npm run proto:gen` em
cada app) — nunca roda automático dentro de `npm run dev`/`build`, pra não
quebrar o dev dos outros 4 padrões em máquinas sem Buf configurado
corretamente.

## Contrato proto

`proto/order_stream.proto`:

```proto
syntax = "proto3";
package tempo.real.v1;

message OrderSnapshot {
  string order_id = 1;
  string status = 2;
  int32 seq = 3;
  string updated_at = 4;
  bool done = 5;
}

message WatchOrderRequest {
  string order_id = 1;
}

message AdvanceOrderRequest {
  string order_id = 1;
}

service OrderStreamService {
  rpc WatchOrder(WatchOrderRequest) returns (stream OrderSnapshot);
  rpc AdvanceOrder(AdvanceOrderRequest) returns (OrderSnapshot);
}
```

Campos espelham o `OrderSnapshot` (TS) existente em
`backend/src/types/order.ts` (`orderId`, `status`, `seq`, `updatedAt`,
`done`). `protoc-gen-es` converte `order_id` → `orderId` automaticamente
(camelCase), sem necessidade de mapeamento manual.

## Backend

Nova pasta `backend/src/patterns/grpc-web/`:

- `orderStream.service.ts` — implementação do `OrderStreamService`:
  - `WatchOrder(req)`: async generator. Emite o snapshot atual
    imediatamente (via `ordersService.getState`), depois escuta o mesmo
    `EventEmitter("change")` que `ordersService.waitForChange` já usa —
    mas sem timeout, continua até o cliente abortar (`context.signal`) ou
    o pedido chegar em `done`.
  - `AdvanceOrder(req)`: chama `ordersService.advance(orderId)`, retorna o
    snapshot ou lança `ConnectError` com `Code.NotFound` se o pedido não
    existir.
- `server.ts`: adiciona `app.use(expressConnectMiddleware({ routes }))` de
  `@connectrpc/connect-express`, registrando o `OrderStreamService`. Uma
  linha nova, nenhuma linha existente alterada.

Novas dependências no `backend/package.json`: `@connectrpc/connect`,
`@connectrpc/connect-express`, `@connectrpc/connect-node`,
`@bufbuild/protobuf`. Dev-only: `@bufbuild/buf`, `@bufbuild/protoc-gen-es`
(v2 — gera mensagens e definição de serviço no mesmo arquivo, não precisa
mais de `protoc-gen-connect-es` separado).

## Frontend (React + Angular, espelhado)

Nova pasta `frontend-react/src/patterns/grpc-web/` e
`frontend-angular/src/app/patterns/grpc-web/`:

- Cliente gerado (`src/generated/`) + `createGrpcWebTransport` de
  `@connectrpc/connect-web`, apontando pro backend.
- `grpcWebService.ts` / `.service.ts`: consome
  `for await (const snapshot of client.watchOrder({orderId}, { signal }))`
  dentro de um wrapper com `AbortController`, exposto com a mesma forma de
  callback (`onOpen` / `onStatus` / `onDone` / `onError`) que
  `sseService.ts` já usa hoje — permite reaproveitar `useSSE`-like hook
  shape e os componentes `ConnectionBadge`, `StatusTimeline`, `EventLog`
  sem mudar assinatura.
- Reconexão manual com contagem (`attempt` / `retryInSeconds`), copiada da
  lógica já existente em `useSSE` — stream gRPC-Web não reconecta sozinho
  como `EventSource`.
- Botão "Avançar agora" chama `client.advanceOrder({orderId})` (unary).
  Timer automático a cada 5s enquanto `connectionState === "conectado"`,
  mesmo padrão do `SSEPanel`/`sse-panel.component.ts`.
- Nova aba "gRPC-Web" adicionada ao array `TABS` (`App.tsx`) e à lista de
  tabs do Angular.

Novas dependências em cada `package.json` de frontend:
`@connectrpc/connect`, `@connectrpc/connect-web`, `@bufbuild/protobuf`.
Dev-only: `@bufbuild/buf`, `@bufbuild/protoc-gen-es`.

## Fora de escopo

- Proxy Envoy / grpc-web clássico.
- Migrar "Novo pedido" pra gRPC (continua `POST /api/orders`, é estado
  global compartilhado entre as 5 abas via `useCurrentOrderId`).
- Client-streaming ou bidi streaming (não suportado no browser).
- Codegen automático dentro de `npm run dev`/`build`.

## Verificação

- `npm run proto:gen` nos 3 apps gera código sem erro.
- `npm run dev` no backend e nos 2 frontends (mais os 4 padrões antigos,
  pra confirmar zero regressão).
- Abrir aba gRPC-Web, "Conectar", confirmar timeline avançando sozinha
  (timer 5s) e via botão "Avançar agora".
- Checar aba Network do browser: `content-type: application/grpc-web`
  (ou `+proto`) nas chamadas ao `OrderStreamService`.
- Repetir teste no painel Angular (accent vermelho) pra confirmar paridade.
