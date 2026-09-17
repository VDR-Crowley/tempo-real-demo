# Frontend Angular — tempo real demo

Cada pattern mora na própria pasta em `src/app/patterns/<nome>/`: serviço
`@Injectable` (RxJS Observable/Subject, nunca toca em UI) + painel
(componente "esperto": injeta o serviço, assina no construtor/`ngOnInit`,
cancela no `ngOnDestroy`).

```
src/app/
├── types/          order.ts, ws.ts, connection.ts
├── services/        orders-api.service.ts, current-order.service.ts   # usado por todos os patterns
├── components/       status-timeline, connection-badge, metrics-bar, event-log, chat-panel — "burros", só @Input()
└── patterns/
    ├── polling/       polling-panel.component
    ├── long-polling/  long-polling.service + long-polling-panel.component
    ├── sse/           sse.service + dev.service + sse-panel.component
    └── websocket/     socket.service + socket-panel.component
```

```
npm install
npm start          # http://localhost:4300 — precisa do backend rodando em :4000
npm run build       # ng build
npm run typecheck   # tsc --noEmit -p tsconfig.app.json
```

URL do backend em `src/environments/environment.ts` (`apiUrl`/`wsUrl`) —
fallback fixo em `http://localhost:4000`, sem lib nem env var extra.
