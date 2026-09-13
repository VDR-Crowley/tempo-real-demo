# Tempo Real Demo

Projeto de demonstração comparando três estratégias de dados em tempo real — **Polling**, **Server-Sent Events (SSE)** e **WebSocket** — usando um único backend Node/Express e dois frontends independentes (React e Angular) que consomem os mesmos endpoints. Backend e frontend React em **TypeScript** com tipagem estrita (`strict: true`, sem `any` implícito); frontend Angular já nasceu em TypeScript.

O objetivo é didático: mostrar, lado a lado, como cada abordagem se comporta (quem inicia a comunicação, latência, direção do fluxo) e como estruturar a camada de serviço separada da camada de UI em cada framework.

## Estrutura do repositório

```
tempo-real-demo/
├── backend/               # API Node/Express + WebSocket, em TypeScript (fonte única de dados)
│   └── src/
│       ├── types/         # order.ts — shape do payload (status, updatedAt, orderId opcional)
│       ├── routes/        # polling.route.ts, sse.route.ts
│       ├── websocket.ts   # servidor WebSocket
│       └── services/      # ordersService.ts — estado dos pedidos, emite mudanças
├── frontend-react/        # Cliente React (Vite + TypeScript)
│   └── src/
│       ├── types/         # order.ts — mesmo shape do payload do backend
│       ├── services/      # api.ts, pollingService.ts, sseService.ts, socketService.ts
│       ├── hooks/         # usePolling, useSSE, useSocket — ligam serviço aos componentes
│       └── components/    # PollingPanel, SSEPanel, SocketPanel, StatusCard, UpdateLog (.tsx)
└── frontend-angular/      # Cliente Angular standalone (TypeScript)
    └── src/app/
        ├── services/      # polling.service.ts, sse.service.ts, socket.service.ts (@Injectable)
        └── components/    # polling-panel, sse-panel, socket-panel, status-card, update-log
```

Todos os três consomem a mesma fonte de verdade no backend (`ordersService`), então dá pra abrir os dois frontends ao mesmo tempo e ver as três estratégias reagindo às mesmas mudanças de pedido.

## Como rodar

Precisa de 3 terminais (backend + um ou dois frontends).

**Terminal 1 — Backend**
```bash
cd backend
npm install
npm run dev       # tsx watch — recompila TS a cada mudança
```
Sobe em `http://localhost:4000`. `npm run build` gera `dist/` (tsc) e `npm start` roda o build.

**Terminal 2 — Frontend React**
```bash
cd frontend-react
npm install
npm run dev
```
Sobe em `http://localhost:5173` (padrão Vite). `npm run build` roda `tsc -b` (typecheck) e depois `vite build`.

**Terminal 3 — Frontend Angular**
```bash
cd frontend-angular
npm install
npm start
```
Sobe em `http://localhost:4200` (padrão Angular CLI).

Rode qualquer um dos dois frontends isoladamente, ou os dois juntos para comparar as implementações.

## Endpoints do backend

| Estratégia | Endpoint | Descrição |
|---|---|---|
| **Polling** | `GET /api/orders/:id` | Cliente pergunta, servidor responde só o estado atual — sem push. |
| **SSE** | `GET /api/orders/stream` | Conexão HTTP mantida aberta; servidor empurra (`text/event-stream`) toda mudança de estado. |
| **WebSocket** | `ws://.../api/orders/socket` | Conexão bidirecional; servidor empurra mudanças e o cliente também pode enviar mensagens (ex.: `subscribe`). |

Os três endpoints leem do mesmo `ordersService` — não há três fontes de dados, só três formas de expor a mesma informação.

## Separação serviço/interface nos frontends

Os dois frontends seguem o mesmo princípio: **componentes de UI nunca falam direto com `fetch`/`WebSocket`/`EventSource`** — sempre passam por uma camada de serviço dedicada.

- **React**: a lógica de comunicação vive em `src/services/*.ts` (um arquivo por estratégia) e é exposta aos componentes via hooks customizados (`usePolling`, `useSSE`, `useSocket`, em `src/hooks/`). Os componentes em `src/components/` só consomem o hook e renderizam o estado — não sabem como o dado chegou. O tipo `OrderStatus` (`src/types/order.ts`) atravessa serviço → hook → componente sem nenhum `any`.
- **Angular**: cada estratégia tem seu próprio serviço `@Injectable` (`polling.service.ts`, `sse.service.ts`, `socket.service.ts`) que expõe o estado via RxJS. Os componentes standalone em `src/app/components/` apenas injetam o serviço correspondente e fazem bind no template.

Essa separação deixa claro, nos dois frameworks, onde termina "como buscar o dado" e onde começa "como exibir o dado" — README de cada subpasta detalha mais.
