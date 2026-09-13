# Frontend React — tempo real demo

`services/` — busca dado, sem JSX, sem saber de UI (`api.ts`, `pollingService.ts`, `sseService.ts`, `socketService.ts`).
`hooks/` — liga o serviço ao ciclo de vida do componente (abre no efeito, fecha no cleanup).
`components/` — só recebem dado via props e renderizam. `StatusCard` e `UpdateLog` não sabem se o dado veio de polling, SSE ou WebSocket.

Projeto em TypeScript (Vite + React + TS). O shape do payload (`status`,
`updatedAt`, `orderId` opcional) mora em `src/types/order.ts` e é usado pelos
três serviços, hooks e componentes.

```
npm install
npm run dev       # http://localhost:5173 — precisa do backend rodando em :4000
npm run build     # tsc -b (typecheck) + vite build
npm run typecheck # só o typecheck (tsc -b)
```
