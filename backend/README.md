# Backend — tempo real demo

Um serviço só (`ordersService`) guardando o "estado do pedido" e emitindo um evento
`change` sempre que ele muda. As três rotas só leem/escutam esse serviço —
nenhuma delas sabe como o status é gerado.

```
npm install
npm start        # http://localhost:4000
```

- `GET /api/orders/:id` — polling
- `GET /api/orders/stream` — Server-Sent Events
- `ws://localhost:4000/api/orders/socket` — WebSocket
