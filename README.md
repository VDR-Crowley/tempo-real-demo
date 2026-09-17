# Tempo Real Demo

Projeto de demonstração pra palestra sobre como o front descobre que algo
mudou: **Polling**, **Long Polling**, **Server-Sent Events (SSE)** e
**WebSocket** — lado a lado, no mesmo backend Node/Express, com dois
frontends independentes (React e Angular) consumindo os mesmos endpoints.
Todos os pacotes em **TypeScript** com tipagem estrita (`strict: true`, sem
`any`).

Cada pedido tem começo, meio e fim — `Recebido → Em separação → Em
transporte → Entregue` — e para sozinho ao chegar em `Entregue`. Não avança
sozinho no tempo: só muda quando alguém chama o endpoint de avanço (botão
"Avançar agora", hoje só na aba SSE) ou quando um teste/curl chama a API
direto — assim o apresentador controla o ritmo, sem o pedido "terminar
sozinho" enquanto ele ainda está falando.

## Regra de ouro

Angular e React chegam ao mesmo resultado final: mesmas abas, controles,
rótulos, contadores, estados, comportamento em falha. Única diferença
permitida entre os dois é o título (`Tempo real — Angular` / `Tempo real —
React`) e a cor de destaque (`--accent`: Angular `#ea5e5e`, React
`#5ec8ea`) — serve só pra plateia saber qual tela é qual.

## Onde entram HTTP Streaming e os outros

O demo implementa 4 dos 6+ jeitos discutidos na palestra. Os que faltam,
de propósito:

- **HTTP Streaming** não ganhou aba própria — ele mora conceitualmente
  entre Long Polling e SSE: é "long polling que, em vez de fechar e reabrir
  a cada novidade, manda o pedaço e continua aberto". SSE é HTTP streaming
  com um contrato em cima (`event`/`id`/`retry` + reconexão automática do
  navegador) — todo SSE é HTTP streaming, mas nem todo HTTP streaming é
  SSE. Ver o comentário em `backend/src/server.ts`.
- **gRPC-Web** e **WebTransport** ficam só na teoria da palestra — exigem
  proxy/HTTP3 e não mudam a demo prática deste repo.

## Estrutura do repositório

Cada pacote agrupa os 4 patterns em pastas próprias — abrir
`patterns/<nome>/` mostra tudo daquele jeito de atualização junto (rota +
serviço + componente), em vez de espalhado por `routes/`, `services/` e
`components/` soltos.

```
tempo-real-demo/
├── backend/                        # API Node/Express + WebSocket, em TypeScript
│   └── src/
│       ├── types/                  # order.ts (status/seq/done), ws.ts (protocolo do chat)
│       ├── core/                   # orders.route.ts (criar/avançar) + ordersService.ts — usado por todos os patterns
│       ├── patterns/
│       │   ├── polling/            # GET /api/orders/:id
│       │   ├── long-polling/       # GET /api/orders/:id/long-poll
│       │   ├── sse/                # GET /api/orders/:id/stream + POST /api/dev/drop-sse
│       │   └── websocket/          # ws /api/orders/socket (status + chat)
│       └── server.ts
├── frontend-react/                 # Cliente React (Vite + TypeScript)
│   └── src/
│       ├── types/                  # order.ts, ws.ts — mesmo shape do backend
│       ├── config.ts                # única constante de URL do backend
│       ├── services/, hooks/        # orderService, useCurrentOrder — compartilhados por todos os patterns
│       ├── components/              # StatusTimeline, ConnectionBadge, MetricsBar, EventLog, ChatPanel — dumb, reusados
│       └── patterns/
│           ├── polling/             # usePolling.ts + PollingPanel.tsx
│           ├── long-polling/        # longPollingService.ts + useLongPolling.ts + LongPollingPanel.tsx
│           ├── sse/                 # sseService.ts + devService.ts + useSSE.ts + SSEPanel.tsx
│           └── websocket/           # socketService.ts + useSocket.ts + SocketPanel.tsx
└── frontend-angular/                # Cliente Angular standalone (TypeScript)
    └── src/app/
        ├── types/                   # order.ts, ws.ts, connection.ts
        ├── services/                 # orders-api, current-order (@Injectable) — compartilhados por todos os patterns
        ├── components/                # status-timeline, connection-badge, metrics-bar, event-log, chat-panel — dumb, reusados
        └── patterns/
            ├── polling/               # polling-panel.component
            ├── long-polling/          # long-polling.service + long-polling-panel.component
            ├── sse/                   # sse.service + dev.service + sse-panel.component
            └── websocket/             # socket.service + socket-panel.component
```

Os quatro patterns leem do mesmo `ordersService` — não há quatro fontes de
dados, só quatro formas de expor a mesma informação.

## Como rodar

Precisa de 3 terminais (backend + um ou dois frontends).

**Terminal 1 — Backend**
```bash
cd backend
npm install
npm run dev       # tsx watch — http://localhost:4000, recompila a cada mudança
```

**Terminal 2 — Frontend React**
```bash
cd frontend-react
npm install
npm run dev       # http://localhost:5173
```

**Terminal 3 — Frontend Angular**
```bash
cd frontend-angular
npm install
npm start         # http://localhost:4300
```

Abra os dois frontends lado a lado pra comparar as implementações — é
esse o ponto da demo.

## Endpoints do backend

| Método | Rota | Pra quê |
|---|---|---|
| POST | `/api/orders` | Cria um pedido novo — botão "Novo pedido" |
| POST | `/api/orders/:id/advance` | Força a próxima transição agora — botão "Avançar agora" |
| GET | `/api/orders/:id` | Snapshot atual — **polling** |
| GET | `/api/orders/:id/long-poll?sinceSeq=N` | Segura a resposta até seq > N ou timeout — **long polling** |
| GET | `/api/orders/:id/stream` | SSE com protocolo completo (replay via `Last-Event-ID`) |
| POST | `/api/dev/drop-sse` | Derruba toda conexão SSE aberta sem avisar — botão "Simular queda" |
| ws | `/api/orders/socket` | Push de status + chat bidirecional entre clientes |

Detalhe do protocolo SSE e do chat WebSocket: `backend/README.md`.

## Roteiro de demonstração

**Polling** — clicar "Novo pedido" → "Iniciar" → sem nenhuma mudança
ainda, o log já mostra requests "sem mudança" (apagados) se ficar rodando
sem ninguém avançar o pedido. Avançar pela aba SSE (mesmo pedido,
compartilhado entre abas do mesmo app) faz o Polling pegar a mudança no
próximo tick — e mostrar, request a request, quantas vezes "não mudou
nada" contra quantas vezes mudou. Ao chegar em `Entregue`, o polling para
sozinho e aparece o resumo: "N requests para capturar M mudanças — X%
foram desperdício. Atraso médio: Ys."

**Long Polling** — "Novo pedido" → "Iniciar". Sem seletor de intervalo:
o cliente reabre a conexão assim que a anterior responde, e o servidor
segura cada resposta até ter novidade (ou até o timeout dele). Avançar
pela aba SSE faz a resposta presa voltar na hora — contraste direto com
o polling: quase 1 request por mudança, em vez de dezenas esperando.

**SSE** — "Conectar" nos dois → "Novo pedido" → chegam os eventos com
`id` crescente (visível no Last-Event-ID) → clicar "Simular queda" → o
badge vira "reconectando (tentativa N, em Xs)" → clicar "Avançar agora"
enquanto a conexão está caída → o navegador reconecta sozinho e o evento
perdido chega marcado `(replay)`, sem buraco na sequência de `id` → ao
chegar em `Entregue`, o stream fecha e aparece a mensagem "stream
encerrado pelo servidor — e fechado pelo cliente, senão o navegador
reconectaria pra sempre".

**WebSocket** — "Conectar" nos dois lados (um Angular, um React) →
digitar num lado aparece "digitando..." no outro → enviar mensagem cruza
pra outra tela com o badge do app de origem → fechar uma aba faz a
presença cair na hora na outra → o painel de frames mostra setas ↑/↓ nos
dois sentidos, provando que é bidirecional (o que os outros três não
mostram).
