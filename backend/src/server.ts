import express, { type Express } from "express";
import cors from "cors";
import http from "node:http";
import { pollingRoute } from "./routes/polling.route.js";
import { sseRoute } from "./routes/sse.route.js";
import { attachWebSocket } from "./websocket.js";

const app: Express = express();
app.use(cors());
app.use("/api", pollingRoute);
app.use("/api", sseRoute);

const server = http.createServer(app);
attachWebSocket(server);

const PORT: number = Number(process.env.PORT) || 4000;
server.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);
  console.log("  Polling    -> GET  /api/orders/:id");
  console.log("  SSE        -> GET  /api/orders/stream");
  console.log("  WebSocket  -> ws   /api/orders/socket");
});
