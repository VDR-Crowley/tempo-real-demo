import express, { type Express } from "express";
import cors from "cors";
import http from "node:http";
import { cors as connectCors } from "@connectrpc/connect";
import { expressConnectMiddleware } from "@connectrpc/connect-express";
import { ordersRoute } from "./core/orders.route.js";
import { pollingRoute } from "./patterns/polling/polling.route.js";
import { longPollingRoute } from "./patterns/long-polling/long-polling.route.js";
import { sseRoute } from "./patterns/sse/sse.route.js";
import { attachWebSocket } from "./patterns/websocket/websocket.js";
import orderStreamRoutes from "./patterns/grpc-web/orderStreamRoutes.js";

// Quatro jeitos do front descobrir que um pedido mudou, um por pasta em
// src/patterns/: polling, long-polling, sse, websocket.
//
// HTTP streaming (a resposta abre e desce em pedaços, sem contrato de
// evento) não ganhou pasta própria aqui — ele mora conceitualmente entre
// long-polling e SSE: é "long-polling que, em vez de fechar e reabrir a
// cada novidade, manda o pedaço e continua aberto". SSE é HTTP streaming
// com um contrato em cima (event/id/retry + reconexão automática do
// navegador) — é por isso que todo SSE é HTTP streaming, mas nem todo HTTP
// streaming é SSE. Não tem exemplo rodando aqui porque SSE já cobre o caso
// de uso do demo (push de status); NDJSON/streaming cru valeria a pena só
// se o payload fosse grande o bastante pra importar ler aos pedaços.

const app: Express = express();
// origin/methods/allowedHeaders continuam permissivos como antes — só
// ganham os headers extras que o Connect precisa pro streaming gRPC-Web
// (exposedHeaders). Widening, não restringe nada que já funcionava.
app.use(
  cors({
    origin: true,
    methods: [...connectCors.allowedMethods],
    allowedHeaders: [...connectCors.allowedHeaders],
    exposedHeaders: [...connectCors.exposedHeaders],
  })
);
app.use("/api", ordersRoute);
app.use("/api", pollingRoute);
app.use("/api", longPollingRoute);
app.use("/api", sseRoute);
app.use(expressConnectMiddleware({ routes: orderStreamRoutes }));

const server = http.createServer(app);
attachWebSocket(server);

const PORT: number = Number(process.env.PORT) || 4000;
server.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);
  console.log("  POST /api/orders");
  console.log("  POST /api/orders/:id/advance");
  console.log("  GET  /api/orders/:id                — polling");
  console.log("  GET  /api/orders/:id/long-poll       — long polling");
  console.log("  GET  /api/orders/:id/stream          — SSE");
  console.log("  POST /api/dev/drop-sse");
  console.log("  ws   /api/orders/socket              — WebSocket");
  console.log("  grpc-web tempo.real.v1.OrderStreamService/WatchOrder");
  console.log("  grpc-web tempo.real.v1.OrderStreamService/AdvanceOrder");
});
