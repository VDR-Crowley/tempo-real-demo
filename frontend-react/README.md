# Frontend React — tempo real demo

`services/` — busca dado, sem JSX, sem saber de UI (api.js, pollingService.js, sseService.js, socketService.js).
`hooks/` — liga o serviço ao ciclo de vida do componente (abre no efeito, fecha no cleanup).
`components/` — só recebem dado via props e renderizam. `StatusCard` e `UpdateLog` não sabem se o dado veio de polling, SSE ou WebSocket.

```
npm install
npm run dev       # http://localhost:5173 — precisa do backend rodando em :4000
```
