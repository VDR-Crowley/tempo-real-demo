# Backend — tempo real demo

Um serviço só (`ordersService`) guardando o "estado do pedido" e emitindo um evento
`change` sempre que ele muda. As três rotas só leem/escutam esse serviço —
nenhuma delas sabe como o status é gerado.

Escrito em TypeScript, com o shape do payload (`status`, `updatedAt`, `orderId`
opcional) definido em `src/types/order.ts` e reaproveitado pelas rotas e pelo
WebSocket.

```
npm install
npm run dev       # tsx watch — http://localhost:4000, recompila a cada mudança
npm run build     # tsc -> dist/
npm start         # roda o build (dist/server.js)
npm run typecheck # tsc --noEmit
```

- `GET /api/orders/:id` — polling
- `GET /api/orders/stream` — Server-Sent Events
- `ws://localhost:4000/api/orders/socket` — WebSocket
