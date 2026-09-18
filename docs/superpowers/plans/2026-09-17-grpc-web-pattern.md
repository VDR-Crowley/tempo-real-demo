# gRPC-Web Pattern Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 5th real-time pattern (gRPC-Web) to the demo, mirrored across backend, React and Angular, demonstrating server-streaming order-status push plus a unary "advance" RPC.

**Architecture:** Connect (`@connectrpc/connect*`, from Buf) runs inside the existing Express app on the same HTTP/1.1 port — no Envoy proxy, no protocol upgrade. A single `.proto` file at the repo root is the source of truth; `protoc-gen-es` v2 (via `buf generate`) generates both message types and the service descriptor in one file per app (backend, frontend-react, frontend-angular), each app keeping its own generated copy under `src/generated/`, matching the existing "each app is self-contained" convention. Generated code is committed — regeneration is a manual, explicit step (`npm run proto:gen`), never part of `dev`/`build`.

**Tech Stack:** `@bufbuild/buf` + `@bufbuild/protoc-gen-es` (codegen, dev-only), `@bufbuild/protobuf` (runtime), `@connectrpc/connect` + `@connectrpc/connect-express` + `@connectrpc/connect-node` (backend), `@connectrpc/connect` + `@connectrpc/connect-web` (frontends, using `createGrpcWebTransport` specifically — not Connect's own protocol).

## Global Constraints

- Server stays HTTP/1.1, same `http.createServer(app)` instance — do not introduce HTTP/2.
- Connect middleware must not touch the `/api/*` route prefix used by the other 4 patterns.
- CORS changes must be additive only (widen, never narrow) — verified by running the other 4 patterns after the change.
- Generated code (`src/generated/`) is committed to git in every app — never gitignored, never generated automatically inside `dev`/`build` scripts.
- `.proto` lives at repo root in `proto/order_stream.proto` — single source, not duplicated.
- Client transport must be `createGrpcWebTransport` (from `@connectrpc/connect-web`), not `createConnectTransport` — the whole point is speaking the gRPC-Web wire protocol.
- New panel (React `GrpcWebPanel`, Angular `GrpcWebPanelComponent`) mirrors the SSE panel's controls: "Conectar/Desconectar", "Novo pedido", "Avançar agora" (unary RPC), plus auto-advance every 5000ms while `connectionState === "conectado"`.
- No chat, no client-streaming, no bidi-streaming — browsers don't support those gRPC-Web modes.

---

### Task 1: Proto contract + backend codegen toolchain

**Files:**
- Create: `proto/order_stream.proto`
- Create: `backend/buf.gen.yaml`
- Modify: `backend/package.json`

**Interfaces:**
- Produces: `OrderStreamService` (service descriptor), `OrderSnapshot`/`WatchOrderRequest`/`AdvanceOrderRequest` (message types + `*Schema` consts) generated at `backend/src/generated/tempo/real/v1/order_stream_pb.ts` — consumed by Task 2.

- [ ] **Step 1: Create the proto file**

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

- [ ] **Step 2: Add codegen + runtime dependencies to backend/package.json**

Edit `backend/package.json` — add to `"scripts"`:

```json
    "proto:gen": "buf generate",
```

(insert as a new line inside the existing `"scripts"` object, after `"typecheck"`)

Add to `"dependencies"`:

```json
    "@bufbuild/protobuf": "^2.15.0",
    "@connectrpc/connect": "^2.2.0",
    "@connectrpc/connect-express": "^2.2.0",
    "@connectrpc/connect-node": "^2.2.0",
```

Add to `"devDependencies"`:

```json
    "@bufbuild/buf": "^1.73.0",
    "@bufbuild/protoc-gen-es": "^2.15.0",
```

- [ ] **Step 3: Install**

Run: `cd backend && npm install`
Expected: installs cleanly, no peer dependency errors.

- [ ] **Step 4: Create backend/buf.gen.yaml**

```yaml
version: v2
clean: true
inputs:
  - directory: ../proto
plugins:
  - local: protoc-gen-es
    out: src/generated
    opt:
      - target=ts
      - import_extension=js
```

(`import_extension=js` is required here — and only here — because `backend/tsconfig.json` uses `"module": "NodeNext"`, which needs explicit `.js` extensions on relative imports. The frontends use bundler resolution and don't need this option.)

- [ ] **Step 5: Generate and verify**

Run: `cd backend && npm run proto:gen`
Expected: creates `backend/src/generated/tempo/real/v1/order_stream_pb.ts` with no errors.

Run: `cd backend && npm run typecheck`
Expected: passes (generated file type-checks cleanly on its own; nothing imports it yet).

- [ ] **Step 6: Commit**

```bash
git add proto/order_stream.proto backend/buf.gen.yaml backend/package.json backend/package-lock.json backend/src/generated
git commit -m "feat: adiciona contrato proto e codegen do gRPC-Web no backend"
```

---

### Task 2: Backend OrderStreamService implementation (TDD)

**Files:**
- Create: `backend/src/patterns/grpc-web/orderStreamRoutes.ts`
- Test: `backend/src/patterns/grpc-web/orderStreamRoutes.test.ts`
- Modify: `backend/package.json` (test script)

**Interfaces:**
- Consumes: `ordersService.getState(orderId)`, `ordersService.advance(orderId)`, `ordersService.on("change", handler)` / `.off("change", handler)` (all already exist in `backend/src/core/ordersService.ts`, unmodified). `OrderStreamService`, `WatchOrderRequest`, `AdvanceOrderRequest` from Task 1's generated file.
- Produces: `export default (router: ConnectRouter) => ConnectRouter` — consumed by Task 3's `server.ts` wiring.

- [ ] **Step 1: Add a test script (no test runner exists yet in this backend)**

Edit `backend/package.json` — add to `"scripts"`:

```json
    "test": "tsx --test src/**/*.test.ts",
```

- [ ] **Step 2: Write the failing test**

`backend/src/patterns/grpc-web/orderStreamRoutes.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert";
import { createClient, createRouterTransport, ConnectError } from "@connectrpc/connect";
import { OrderStreamService } from "../../generated/tempo/real/v1/order_stream_pb.js";
import { ordersService } from "../../core/ordersService.js";
import routes from "./orderStreamRoutes.js";

describe("OrderStreamService", () => {
  it("advanceOrder avança o pedido e retorna o novo snapshot", async () => {
    const order = ordersService.createOrder();
    const transport = createRouterTransport(routes);
    const client = createClient(OrderStreamService, transport);

    const result = await client.advanceOrder({ orderId: order.orderId });

    assert.strictEqual(result.status, "Em separação");
    assert.strictEqual(result.seq, 2);
    assert.strictEqual(result.done, false);
  });

  it("advanceOrder lança NotFound pra pedido inexistente", async () => {
    const transport = createRouterTransport(routes);
    const client = createClient(OrderStreamService, transport);

    await assert.rejects(
      () => client.advanceOrder({ orderId: "não-existe" }),
      (err: unknown) => err instanceof ConnectError,
    );
  });

  it("watchOrder emite o snapshot atual e depois cada mudança até done", async () => {
    const order = ordersService.createOrder();
    const transport = createRouterTransport(routes);
    const client = createClient(OrderStreamService, transport);

    const received: string[] = [];
    const stream = client.watchOrder({ orderId: order.orderId });

    const collector = (async () => {
      for await (const snapshot of stream) {
        received.push(snapshot.status);
        if (snapshot.done) {
          break;
        }
      }
    })();

    await new Promise((resolve) => setTimeout(resolve, 10));
    ordersService.advance(order.orderId);
    ordersService.advance(order.orderId);
    ordersService.advance(order.orderId);

    await collector;

    assert.deepStrictEqual(received, ["Recebido", "Em separação", "Em transporte", "Entregue"]);
  });
});
```

- [ ] **Step 3: Run test, verify it fails**

Run: `cd backend && npm test`
Expected: FAIL — `Cannot find module './orderStreamRoutes.js'` (file doesn't exist yet).

- [ ] **Step 4: Implement the service**

`backend/src/patterns/grpc-web/orderStreamRoutes.ts`:

```ts
import { ConnectError, Code, type ConnectRouter, type HandlerContext } from "@connectrpc/connect";
import { ordersService } from "../../core/ordersService.js";
import { OrderStreamService } from "../../generated/tempo/real/v1/order_stream_pb.js";
import type { WatchOrderRequest, AdvanceOrderRequest } from "../../generated/tempo/real/v1/order_stream_pb.js";
import type { OrderEvent } from "../../types/order.js";

// Ponte entre o EventEmitter("change") do ordersService (já usado pelo
// long-polling) e um async generator — sem timeout, fica aberto até o
// pedido terminar ou o cliente abortar (aba fechada / desconectar).
async function* watchOrderChanges(orderId: string, signal: AbortSignal): AsyncGenerator<OrderEvent> {
  let resolveNext: ((event: OrderEvent | null) => void) | null = null;
  const queue: OrderEvent[] = [];

  const onChange = (event: OrderEvent): void => {
    if (event.orderId !== orderId) {
      return;
    }
    if (resolveNext) {
      const resolve = resolveNext;
      resolveNext = null;
      resolve(event);
    } else {
      queue.push(event);
    }
  };

  const onAbort = (): void => {
    if (resolveNext) {
      const resolve = resolveNext;
      resolveNext = null;
      resolve(null);
    }
  };

  ordersService.on("change", onChange);
  signal.addEventListener("abort", onAbort);

  try {
    while (!signal.aborted) {
      const event =
        queue.length > 0
          ? queue.shift()!
          : await new Promise<OrderEvent | null>((resolve) => {
              resolveNext = resolve;
            });
      if (event === null) {
        return;
      }
      yield event;
      if (event.done) {
        return;
      }
    }
  } finally {
    ordersService.off("change", onChange);
    signal.removeEventListener("abort", onAbort);
  }
}

export default (router: ConnectRouter) =>
  router.service(OrderStreamService, {
    async *watchOrder(req: WatchOrderRequest, context: HandlerContext) {
      const current = ordersService.getState(req.orderId);
      if (!current) {
        throw new ConnectError("pedido não encontrado", Code.NotFound);
      }
      yield current;
      if (current.done) {
        return;
      }
      yield* watchOrderChanges(req.orderId, context.signal);
    },
    async advanceOrder(req: AdvanceOrderRequest) {
      const snapshot = ordersService.advance(req.orderId);
      if (!snapshot) {
        throw new ConnectError("pedido não encontrado", Code.NotFound);
      }
      return snapshot;
    },
  });
```

Note: handler return values are plain objects matching `OrderSnapshot`'s shape (`orderId`, `status`, `seq`, `updatedAt`, `done`) — Connect's `ServiceImpl` type accepts plain init-shape objects for returns, no `create()`/`$typeName` needed. `ordersService.getState`/`.advance` already return exactly this shape (`backend/src/types/order.ts`), so no mapping is needed on the backend side.

- [ ] **Step 5: Run test, verify it passes**

Run: `cd backend && npm test`
Expected: PASS — 3 tests green.

- [ ] **Step 6: Commit**

```bash
git add backend/src/patterns/grpc-web backend/package.json
git commit -m "feat: implementa OrderStreamService (watch + advance) com teste em memoria"
```

---

### Task 3: Wire Connect into the Express server

**Files:**
- Modify: `backend/src/server.ts`

**Interfaces:**
- Consumes: default export from `backend/src/patterns/grpc-web/orderStreamRoutes.ts` (Task 2).

- [ ] **Step 1: Add the middleware and widen CORS**

Edit `backend/src/server.ts`. Current top:

```ts
import express, { type Express } from "express";
import cors from "cors";
import http from "node:http";
import { ordersRoute } from "./core/orders.route.js";
import { pollingRoute } from "./patterns/polling/polling.route.js";
import { longPollingRoute } from "./patterns/long-polling/long-polling.route.js";
import { sseRoute } from "./patterns/sse/sse.route.js";
import { attachWebSocket } from "./patterns/websocket/websocket.js";
```

becomes:

```ts
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
```

Current:

```ts
const app: Express = express();
app.use(cors());
app.use("/api", ordersRoute);
app.use("/api", pollingRoute);
app.use("/api", longPollingRoute);
app.use("/api", sseRoute);
```

becomes:

```ts
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
```

And add a log line where the others are listed (after the `ws` line):

```ts
  console.log("  grpc-web tempo.real.v1.OrderStreamService/WatchOrder");
  console.log("  grpc-web tempo.real.v1.OrderStreamService/AdvanceOrder");
```

- [ ] **Step 2: Typecheck and smoke-test**

Run: `cd backend && npm run typecheck`
Expected: passes.

Run: `cd backend && npm run dev` (leave running), in another terminal:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:4000/api/orders
```
Expected: `200` (existing REST route still works — proves the CORS/middleware change didn't break the other patterns).

Then create an order and call the new RPC via `curl` using the Connect protocol's JSON codec (simplest manual smoke test — full gRPC-Web binary framing is exercised for real by the frontend client in Task 5/9, this step is just "server didn't fall over"):
```bash
ORDER_ID=$(curl -s -X POST http://localhost:4000/api/orders | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).orderId))")
curl -s -X POST http://localhost:4000/tempo.real.v1.OrderStreamService/AdvanceOrder \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"$ORDER_ID\"}"
```
Expected: JSON body like `{"orderId":"...","status":"Em separação","seq":2,"updatedAt":"...","done":false}`.

Stop the dev server (Ctrl+C) after verifying.

- [ ] **Step 3: Commit**

```bash
git add backend/src/server.ts
git commit -m "feat: monta Connect (gRPC-Web) no Express, CORS ganha headers extras"
```

---

### Task 4: React — codegen toolchain

**Files:**
- Create: `frontend-react/buf.gen.yaml`
- Modify: `frontend-react/package.json`

**Interfaces:**
- Produces: `OrderStreamService`, `OrderSnapshot`/`WatchOrderRequest`/`AdvanceOrderRequest` at `frontend-react/src/generated/tempo/real/v1/order_stream_pb.ts` — consumed by Task 5.

- [ ] **Step 1: Add dependencies and script**

Edit `frontend-react/package.json` — add to `"scripts"`:

```json
    "proto:gen": "buf generate",
```

Add to `"dependencies"`:

```json
    "@bufbuild/protobuf": "^2.15.0",
    "@connectrpc/connect": "^2.2.0",
    "@connectrpc/connect-web": "^2.2.0",
```

Add to `"devDependencies"`:

```json
    "@bufbuild/buf": "^1.73.0",
    "@bufbuild/protoc-gen-es": "^2.15.0",
```

- [ ] **Step 2: Install**

Run: `cd frontend-react && npm install`
Expected: installs cleanly.

- [ ] **Step 3: Create frontend-react/buf.gen.yaml**

```yaml
version: v2
clean: true
inputs:
  - directory: ../proto
plugins:
  - local: protoc-gen-es
    out: src/generated
    opt:
      - target=ts
```

(no `import_extension` here — Vite's bundler resolution doesn't need explicit `.js` extensions)

- [ ] **Step 4: Generate and verify**

Run: `cd frontend-react && npm run proto:gen`
Expected: creates `frontend-react/src/generated/tempo/real/v1/order_stream_pb.ts`.

Run: `cd frontend-react && npx tsc --noEmit`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add frontend-react/buf.gen.yaml frontend-react/package.json frontend-react/package-lock.json frontend-react/src/generated
git commit -m "feat: adiciona codegen do gRPC-Web no frontend-react"
```

---

### Task 5: React — grpcWebService.ts wrapper

**Files:**
- Create: `frontend-react/src/patterns/grpc-web/grpcWebService.ts`

**Interfaces:**
- Consumes: `OrderStreamService` from Task 4's generated file; `API_URL` from `frontend-react/src/config.ts`; `OrderEvent`/`OrderStatusValue` from `frontend-react/src/types/order.ts`.
- Produces: `openOrderStream(orderId, handlers): GrpcWebConnection` and `advanceOrder(orderId): Promise<void>` — same callback shape as `sseService.ts`'s `openOrderStream`, consumed by Task 6's hook and Task 7's panel.

- [ ] **Step 1: Write the file**

`frontend-react/src/patterns/grpc-web/grpcWebService.ts`:

```ts
import { createClient } from "@connectrpc/connect";
import { createGrpcWebTransport } from "@connectrpc/connect-web";
import { API_URL } from "../../config";
import { OrderStreamService } from "../../generated/tempo/real/v1/order_stream_pb";
import type { OrderSnapshot as GrpcOrderSnapshot } from "../../generated/tempo/real/v1/order_stream_pb";
import type { OrderEvent, OrderStatusValue } from "../../types/order";

interface GrpcWebHandlers {
  onOpen: () => void;
  onError: () => void;
  onStatus: (event: OrderEvent) => void;
  onDone: (event: OrderEvent) => void;
}

export interface GrpcWebConnection {
  close: () => void;
}

const transport = createGrpcWebTransport({ baseUrl: API_URL });
const client = createClient(OrderStreamService, transport);

function toOrderEvent(snapshot: GrpcOrderSnapshot): OrderEvent {
  return {
    orderId: snapshot.orderId,
    status: snapshot.status as OrderStatusValue,
    seq: snapshot.seq,
    updatedAt: snapshot.updatedAt,
    done: snapshot.done,
  };
}

// Sem reconexão automática do navegador (isso é uma coisa do EventSource) —
// quem chama decide o que fazer no onError; ver useGrpcWeb.
export function openOrderStream(orderId: string, handlers: GrpcWebHandlers): GrpcWebConnection {
  const controller = new AbortController();

  (async () => {
    try {
      handlers.onOpen();
      for await (const snapshot of client.watchOrder({ orderId }, { signal: controller.signal })) {
        const event = toOrderEvent(snapshot);
        if (snapshot.done) {
          handlers.onDone(event);
          return;
        }
        handlers.onStatus(event);
      }
    } catch {
      if (controller.signal.aborted) {
        return;
      }
      handlers.onError();
    }
  })();

  return {
    close: () => controller.abort(),
  };
}

export function advanceOrder(orderId: string): Promise<void> {
  return client.advanceOrder({ orderId }).then(() => undefined);
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend-react && npx tsc --noEmit`
Expected: passes (file isn't imported anywhere yet, but must compile standalone).

- [ ] **Step 3: Commit**

```bash
git add frontend-react/src/patterns/grpc-web/grpcWebService.ts
git commit -m "feat: adiciona client gRPC-Web (React) com wrapper de callback"
```

---

### Task 6: React — useGrpcWeb hook

**Files:**
- Create: `frontend-react/src/patterns/grpc-web/useGrpcWeb.ts`

**Interfaces:**
- Consumes: `openOrderStream` from Task 5.
- Produces: `useGrpcWeb(orderId): { status, done, connectionState, attempt, retryInSeconds, rows, running, toggle }` — consumed by Task 7's panel. Same shape as `useSSE`'s result, minus `lastEventId` (gRPC-Web streams don't have an SSE-style event id).

- [ ] **Step 1: Write the file**

`frontend-react/src/patterns/grpc-web/useGrpcWeb.ts`:

```ts
import { useEffect, useRef, useState } from "react";
import { openOrderStream } from "./grpcWebService";
import type { OrderStatusValue } from "../../types/order";
import type { LogRow } from "../../components/EventLog";
import type { ConnectionState } from "../../components/ConnectionBadge";

interface UseGrpcWebResult {
  status: OrderStatusValue | null;
  done: boolean;
  connectionState: ConnectionState;
  attempt: number;
  retryInSeconds: number;
  rows: LogRow[];
  running: boolean;
  toggle: () => void;
}

const MAX_ROWS = 8;
const RETRY_SECONDS = 3;

export function useGrpcWeb(orderId: string | null): UseGrpcWebResult {
  const [status, setStatus] = useState<OrderStatusValue | null>(null);
  const [done, setDone] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("desconectado");
  const [attempt, setAttempt] = useState(0);
  const [retryInSeconds, setRetryInSeconds] = useState(RETRY_SECONDS);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [running, setRunning] = useState(false);

  const attemptRef = useRef(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addRow = (row: LogRow): void => {
    setRows((prev) => [row, ...prev].slice(0, MAX_ROWS));
  };

  const stopCountdown = (): void => {
    if (countdownRef.current !== null) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  const startCountdown = (onFinish: () => void): void => {
    stopCountdown();
    let remaining = RETRY_SECONDS;
    setRetryInSeconds(remaining);
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setRetryInSeconds(Math.max(remaining, 0));
      if (remaining <= 0) {
        stopCountdown();
        onFinish();
      }
    }, 1000);
  };

  useEffect(() => {
    setStatus(null);
    setDone(false);
    setConnectionState("desconectado");
    setAttempt(0);
    setRows([]);
    attemptRef.current = 0;
    stopCountdown();
  }, [orderId]);

  useEffect(() => {
    if (!running || !orderId) {
      return;
    }

    let cancelled = false;
    let connection: ReturnType<typeof openOrderStream> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    setConnectionState("conectando");
    attemptRef.current = 0;

    // Stream gRPC-Web não reconecta sozinho (diferente do EventSource do
    // SSE) — no erro, agenda uma nova tentativa depois do countdown.
    const connect = (): void => {
      if (cancelled) {
        return;
      }
      connection = openOrderStream(orderId, {
        onOpen: () => {
          stopCountdown();
          attemptRef.current = 0;
          setAttempt(0);
          setConnectionState("conectado");
        },
        onError: () => {
          attemptRef.current += 1;
          if (attemptRef.current === 1) {
            addRow({ key: `drop-${Date.now()}`, primary: "⚡ conexão caiu", tone: "marker" });
          }
          setAttempt(attemptRef.current);
          setConnectionState("reconectando");
          startCountdown(() => {
            reconnectTimer = setTimeout(connect, 0);
          });
        },
        onStatus: (event) => {
          setStatus(event.status);
          addRow({
            key: `${event.seq}-${Date.now()}`,
            primary: event.status,
            secondary: `seq ${event.seq}`,
            tone: "changed",
          });
        },
        onDone: (event) => {
          setStatus(event.status);
          setDone(true);
          setConnectionState("desconectado");
          setRunning(false);
          addRow({ key: `done-${Date.now()}`, primary: "stream encerrado pelo servidor", tone: "marker" });
        },
      });
    };

    connect();

    return () => {
      cancelled = true;
      stopCountdown();
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
      }
      connection?.close();
    };
  }, [orderId, running]);

  const toggle = () => setRunning((r) => !r);

  return { status, done, connectionState, attempt, retryInSeconds, rows, running, toggle };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend-react && npx tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add frontend-react/src/patterns/grpc-web/useGrpcWeb.ts
git commit -m "feat: adiciona useGrpcWeb (React) com reconexao manual"
```

---

### Task 7: React — GrpcWebPanel + wire tab

**Files:**
- Create: `frontend-react/src/patterns/grpc-web/GrpcWebPanel.tsx`
- Modify: `frontend-react/src/App.tsx`

**Interfaces:**
- Consumes: `useGrpcWeb` (Task 6), `advanceOrder` (Task 5), `StatusTimeline`/`ConnectionBadge`/`EventLog` (existing shared components — unchanged), `useCurrentOrderId`/`startNewOrder` (existing shared hook — unchanged).

- [ ] **Step 1: Write the panel**

`frontend-react/src/patterns/grpc-web/GrpcWebPanel.tsx`:

```tsx
import { useEffect } from "react";
import { useCurrentOrderId, startNewOrder } from "../../hooks/useCurrentOrder";
import { useGrpcWeb } from "./useGrpcWeb";
import { advanceOrder } from "./grpcWebService";
import StatusTimeline from "../../components/StatusTimeline";
import ConnectionBadge from "../../components/ConnectionBadge";
import EventLog from "../../components/EventLog";

const AUTO_ADVANCE_MS = 5000;

export default function GrpcWebPanel() {
  const orderId = useCurrentOrderId();
  const { status, done, connectionState, attempt, retryInSeconds, rows, running, toggle } = useGrpcWeb(orderId);

  useEffect(() => {
    if (!orderId || done || connectionState !== "conectado") {
      return;
    }
    const timer = setInterval(() => {
      advanceOrder(orderId);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [orderId, done, connectionState]);

  return (
    <section>
      <div className="panel-controls">
        <button onClick={toggle} disabled={done || !orderId}>
          {running ? "Desconectar" : "Conectar"}
        </button>
        <button onClick={() => startNewOrder()}>Novo pedido</button>
        <button onClick={() => orderId && advanceOrder(orderId)} disabled={!orderId || done}>
          Avançar agora
        </button>
      </div>
      <ConnectionBadge state={connectionState} attempt={attempt} retryInSeconds={retryInSeconds} />
      <StatusTimeline currentStatus={status} done={done} />
      <EventLog rows={rows} />
    </section>
  );
}
```

- [ ] **Step 2: Wire the tab**

Edit `frontend-react/src/App.tsx`. Current:

```tsx
import { useEffect, useState, type ComponentType } from "react";
import PollingPanel from "./patterns/polling/PollingPanel";
import LongPollingPanel from "./patterns/long-polling/LongPollingPanel";
import SSEPanel from "./patterns/sse/SSEPanel";
import SocketPanel from "./patterns/websocket/SocketPanel";
import { startNewOrder } from "./hooks/useCurrentOrder";

interface Tab {
  id: string;
  label: string;
  Panel: ComponentType;
}

const TABS: Tab[] = [
  { id: "polling", label: "Polling", Panel: PollingPanel },
  { id: "long-polling", label: "Long Polling", Panel: LongPollingPanel },
  { id: "sse", label: "SSE", Panel: SSEPanel },
  { id: "socket", label: "WebSocket", Panel: SocketPanel },
];
```

becomes:

```tsx
import { useEffect, useState, type ComponentType } from "react";
import PollingPanel from "./patterns/polling/PollingPanel";
import LongPollingPanel from "./patterns/long-polling/LongPollingPanel";
import SSEPanel from "./patterns/sse/SSEPanel";
import SocketPanel from "./patterns/websocket/SocketPanel";
import GrpcWebPanel from "./patterns/grpc-web/GrpcWebPanel";
import { startNewOrder } from "./hooks/useCurrentOrder";

interface Tab {
  id: string;
  label: string;
  Panel: ComponentType;
}

const TABS: Tab[] = [
  { id: "polling", label: "Polling", Panel: PollingPanel },
  { id: "long-polling", label: "Long Polling", Panel: LongPollingPanel },
  { id: "sse", label: "SSE", Panel: SSEPanel },
  { id: "socket", label: "WebSocket", Panel: SocketPanel },
  { id: "grpc-web", label: "gRPC-Web", Panel: GrpcWebPanel },
];
```

- [ ] **Step 3: Verify in the browser**

Run: `cd backend && npm run dev` (leave running), then `cd frontend-react && npm run dev` (leave running).
Open `http://localhost:5173`, click "gRPC-Web" tab, click "Conectar".
Expected: badge goes `conectando` → `conectado`, timeline starts advancing every 5s on its own, "Avançar agora" advances immediately. Check the browser Network tab: requests to `tempo.real.v1.OrderStreamService/WatchOrder` show `content-type: application/grpc-web+proto` (or `+json` if the transport falls back — confirm it's one of the two `grpc-web` variants, not `application/connect+...`).

- [ ] **Step 4: Commit**

```bash
git add frontend-react/src/patterns/grpc-web/GrpcWebPanel.tsx frontend-react/src/App.tsx
git commit -m "feat: adiciona painel gRPC-Web (React) e aba nova"
```

---

### Task 8: Angular — codegen toolchain

**Files:**
- Create: `frontend-angular/buf.gen.yaml`
- Modify: `frontend-angular/package.json`

**Interfaces:**
- Produces: `OrderStreamService`, `OrderSnapshot`/`WatchOrderRequest`/`AdvanceOrderRequest` at `frontend-angular/src/generated/tempo/real/v1/order_stream_pb.ts` — consumed by Task 9.

- [ ] **Step 1: Add dependencies and script**

Edit `frontend-angular/package.json` — add to `"scripts"`:

```json
    "proto:gen": "buf generate",
```

Add to `"dependencies"`:

```json
    "@bufbuild/protobuf": "^2.15.0",
    "@connectrpc/connect": "^2.2.0",
    "@connectrpc/connect-web": "^2.2.0",
```

Add to `"devDependencies"`:

```json
    "@bufbuild/buf": "^1.73.0",
    "@bufbuild/protoc-gen-es": "^2.15.0",
```

- [ ] **Step 2: Install**

Run: `cd frontend-angular && npm install`
Expected: installs cleanly.

- [ ] **Step 3: Create frontend-angular/buf.gen.yaml**

```yaml
version: v2
clean: true
inputs:
  - directory: ../proto
plugins:
  - local: protoc-gen-es
    out: src/generated
    opt:
      - target=ts
```

- [ ] **Step 4: Generate and verify**

Run: `cd frontend-angular && npm run proto:gen`
Expected: creates `frontend-angular/src/generated/tempo/real/v1/order_stream_pb.ts`.

Run: `cd frontend-angular && npm run typecheck`
Expected: passes. (This is the one point where Angular's pinned `typescript: ~5.4.5` meets code generated against a newer `@bufbuild/protobuf` — if this fails with a TS version incompatibility, bump `typescript` in this package.json to `~5.5.3` to match frontend-react, re-run `npm install`, and re-check.)

- [ ] **Step 5: Commit**

```bash
git add frontend-angular/buf.gen.yaml frontend-angular/package.json frontend-angular/package-lock.json frontend-angular/src/generated
git commit -m "feat: adiciona codegen do gRPC-Web no frontend-angular"
```

---

### Task 9: Angular — GrpcWebService wrapper

**Files:**
- Create: `frontend-angular/src/app/patterns/grpc-web/grpc-web.service.ts`

**Interfaces:**
- Consumes: `OrderStreamService` from Task 8's generated file; `environment.apiUrl`; `OrderEvent`/`OrderStatusValue` from `frontend-angular/src/app/types/order.ts`.
- Produces: `GrpcWebService.watch(orderId): Observable<GrpcWebUpdate>` and `.advance(orderId): Promise<void>` — same `{kind: "open"|"error"|"status"|"done"}` shape as `SseService`, consumed by Task 10's component.

- [ ] **Step 1: Write the file**

`frontend-angular/src/app/patterns/grpc-web/grpc-web.service.ts`:

```ts
import { Injectable, NgZone } from "@angular/core";
import { Observable } from "rxjs";
import { createClient } from "@connectrpc/connect";
import { createGrpcWebTransport } from "@connectrpc/connect-web";
import { environment } from "../../../environments/environment";
import { OrderStreamService } from "../../../generated/tempo/real/v1/order_stream_pb";
import type { OrderSnapshot as GrpcOrderSnapshot } from "../../../generated/tempo/real/v1/order_stream_pb";
import { OrderEvent, OrderStatusValue } from "../../types/order";

export type GrpcWebUpdate =
  | { kind: "open" }
  | { kind: "error" }
  | { kind: "status"; event: OrderEvent }
  | { kind: "done"; event: OrderEvent };

function toOrderEvent(snapshot: GrpcOrderSnapshot): OrderEvent {
  return {
    orderId: snapshot.orderId,
    status: snapshot.status as OrderStatusValue,
    seq: snapshot.seq,
    updatedAt: snapshot.updatedAt,
    done: snapshot.done,
  };
}

@Injectable({ providedIn: "root" })
export class GrpcWebService {
  private readonly client = createClient(
    OrderStreamService,
    createGrpcWebTransport({ baseUrl: environment.apiUrl })
  );

  constructor(private zone: NgZone) {}

  // Sem reconexão automática (isso é coisa do EventSource/SSE) — quem
  // assina decide o que fazer no "error", igual ao componente do gRPC-Web.
  watch(orderId: string): Observable<GrpcWebUpdate> {
    return new Observable<GrpcWebUpdate>((subscriber) => {
      const controller = new AbortController();

      (async () => {
        try {
          this.zone.run(() => subscriber.next({ kind: "open" }));
          for await (const snapshot of this.client.watchOrder({ orderId }, { signal: controller.signal })) {
            const event = toOrderEvent(snapshot);
            if (snapshot.done) {
              this.zone.run(() => subscriber.next({ kind: "done", event }));
              return;
            }
            this.zone.run(() => subscriber.next({ kind: "status", event }));
          }
        } catch {
          if (controller.signal.aborted) {
            return;
          }
          this.zone.run(() => subscriber.next({ kind: "error" }));
        }
      })();

      return () => controller.abort();
    });
  }

  advance(orderId: string): Promise<void> {
    return this.client.advanceOrder({ orderId }).then(() => undefined);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend-angular && npm run typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add frontend-angular/src/app/patterns/grpc-web/grpc-web.service.ts
git commit -m "feat: adiciona GrpcWebService (Angular) com Observable"
```

---

### Task 10: Angular — GrpcWebPanelComponent + wire tab

**Files:**
- Create: `frontend-angular/src/app/patterns/grpc-web/grpc-web-panel.component.ts`
- Create: `frontend-angular/src/app/patterns/grpc-web/grpc-web-panel.component.html`
- Modify: `frontend-angular/src/app/app.component.ts`
- Modify: `frontend-angular/src/app/app.component.html`

**Interfaces:**
- Consumes: `GrpcWebService` (Task 9), `CurrentOrderService`, `StatusTimelineComponent`/`ConnectionBadgeComponent`/`EventLogComponent` (existing, unchanged).

- [ ] **Step 1: Write the component**

`frontend-angular/src/app/patterns/grpc-web/grpc-web-panel.component.ts`:

```ts
import { Component, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Subscription } from "rxjs";
import { GrpcWebService } from "./grpc-web.service";
import { CurrentOrderService } from "../../services/current-order.service";
import { OrderStatusValue } from "../../types/order";
import { ConnectionState } from "../../types/connection";
import { StatusTimelineComponent } from "../../components/status-timeline/status-timeline.component";
import { ConnectionBadgeComponent } from "../../components/connection-badge/connection-badge.component";
import { EventLogComponent, LogRow } from "../../components/event-log/event-log.component";

const MAX_ROWS = 8;
const RETRY_SECONDS = 3;
const AUTO_ADVANCE_MS = 5000;

@Component({
  selector: "app-grpc-web-panel",
  standalone: true,
  imports: [CommonModule, StatusTimelineComponent, ConnectionBadgeComponent, EventLogComponent],
  templateUrl: "./grpc-web-panel.component.html",
})
export class GrpcWebPanelComponent implements OnDestroy {
  orderId: string | null = null;
  status: OrderStatusValue | null = null;
  done = false;
  connectionState: ConnectionState = "desconectado";
  attempt = 0;
  retryInSeconds = RETRY_SECONDS;
  rows: LogRow[] = [];
  running = false;

  private orderSub: Subscription;
  private streamSub?: Subscription;
  private countdownTimer?: ReturnType<typeof setInterval>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private autoAdvanceTimer?: ReturnType<typeof setInterval>;

  constructor(
    private grpcWebService: GrpcWebService,
    private currentOrder: CurrentOrderService
  ) {
    this.orderSub = this.currentOrder.orderId$.subscribe((orderId) => {
      this.orderId = orderId;
      this.resetRun();
    });
  }

  ngOnDestroy(): void {
    this.orderSub.unsubscribe();
    this.streamSub?.unsubscribe();
    this.stopCountdown();
    this.stopAutoAdvance();
    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
    }
  }

  toggle(): void {
    if (this.running) {
      this.stop();
    } else {
      this.start();
    }
  }

  newOrder(): void {
    void this.currentOrder.startNewOrder();
  }

  advanceNow(): void {
    if (this.orderId) {
      void this.grpcWebService.advance(this.orderId);
    }
  }

  private resetRun(): void {
    this.streamSub?.unsubscribe();
    this.stopCountdown();
    this.stopAutoAdvance();
    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.running = false;
    this.status = null;
    this.done = false;
    this.connectionState = "desconectado";
    this.attempt = 0;
    this.rows = [];
  }

  private addRow(row: LogRow): void {
    this.rows = [row, ...this.rows].slice(0, MAX_ROWS);
  }

  private stopCountdown(): void {
    if (this.countdownTimer !== undefined) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = undefined;
    }
  }

  private startCountdown(onFinish: () => void): void {
    this.stopCountdown();
    let remaining = RETRY_SECONDS;
    this.retryInSeconds = remaining;
    this.countdownTimer = setInterval(() => {
      remaining -= 1;
      this.retryInSeconds = Math.max(remaining, 0);
      if (remaining <= 0) {
        this.stopCountdown();
        onFinish();
      }
    }, 1000);
  }

  private stopAutoAdvance(): void {
    if (this.autoAdvanceTimer !== undefined) {
      clearInterval(this.autoAdvanceTimer);
      this.autoAdvanceTimer = undefined;
    }
  }

  private startAutoAdvance(): void {
    this.stopAutoAdvance();
    this.autoAdvanceTimer = setInterval(() => {
      if (this.orderId) {
        void this.grpcWebService.advance(this.orderId);
      }
    }, AUTO_ADVANCE_MS);
  }

  private start(): void {
    if (!this.orderId) {
      return;
    }
    this.running = true;
    this.connectionState = "conectando";
    this.connect();
  }

  private connect(): void {
    if (!this.orderId) {
      return;
    }
    this.streamSub = this.grpcWebService.watch(this.orderId).subscribe((update) => {
      if (update.kind === "open") {
        this.stopCountdown();
        this.attempt = 0;
        this.connectionState = "conectado";
        this.startAutoAdvance();
        return;
      }
      if (update.kind === "error") {
        this.stopAutoAdvance();
        this.attempt += 1;
        if (this.attempt === 1) {
          this.addRow({ key: `drop-${Date.now()}`, primary: "⚡ conexão caiu", tone: "marker" });
        }
        this.connectionState = "reconectando";
        this.startCountdown(() => {
          this.reconnectTimer = setTimeout(() => this.connect(), 0);
        });
        return;
      }
      if (update.kind === "status") {
        this.status = update.event.status;
        this.addRow({
          key: `${update.event.seq}-${Date.now()}`,
          primary: update.event.status,
          secondary: `seq ${update.event.seq}`,
          tone: "changed",
        });
        return;
      }
      this.status = update.event.status;
      this.done = true;
      this.connectionState = "desconectado";
      this.stop();
      this.addRow({ key: `done-${Date.now()}`, primary: "stream encerrado pelo servidor", tone: "marker" });
    });
  }

  private stop(): void {
    this.running = false;
    this.streamSub?.unsubscribe();
    this.stopCountdown();
    this.stopAutoAdvance();
    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }
}
```

`frontend-angular/src/app/patterns/grpc-web/grpc-web-panel.component.html`:

```html
<section>
  <div class="panel-controls">
    <button (click)="toggle()" [disabled]="done || !orderId">{{ running ? 'Desconectar' : 'Conectar' }}</button>
    <button (click)="newOrder()">Novo pedido</button>
    <button (click)="advanceNow()" [disabled]="!orderId || done">Avançar agora</button>
  </div>
  <app-connection-badge [state]="connectionState" [attempt]="attempt" [retryInSeconds]="retryInSeconds"></app-connection-badge>
  <app-status-timeline [currentStatus]="status" [done]="done"></app-status-timeline>
  <app-event-log [rows]="rows"></app-event-log>
</section>
```

- [ ] **Step 2: Wire the tab**

Edit `frontend-angular/src/app/app.component.ts`. Current:

```ts
import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { PollingPanelComponent } from "./patterns/polling/polling-panel.component";
import { LongPollingPanelComponent } from "./patterns/long-polling/long-polling-panel.component";
import { SsePanelComponent } from "./patterns/sse/sse-panel.component";
import { SocketPanelComponent } from "./patterns/websocket/socket-panel.component";
import { CurrentOrderService } from "./services/current-order.service";

type TabId = "polling" | "long-polling" | "sse" | "socket";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    CommonModule,
    PollingPanelComponent,
    LongPollingPanelComponent,
    SsePanelComponent,
    SocketPanelComponent,
  ],
  templateUrl: "./app.component.html",
})
```

becomes:

```ts
import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { PollingPanelComponent } from "./patterns/polling/polling-panel.component";
import { LongPollingPanelComponent } from "./patterns/long-polling/long-polling-panel.component";
import { SsePanelComponent } from "./patterns/sse/sse-panel.component";
import { SocketPanelComponent } from "./patterns/websocket/socket-panel.component";
import { GrpcWebPanelComponent } from "./patterns/grpc-web/grpc-web-panel.component";
import { CurrentOrderService } from "./services/current-order.service";

type TabId = "polling" | "long-polling" | "sse" | "socket" | "grpc-web";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    CommonModule,
    PollingPanelComponent,
    LongPollingPanelComponent,
    SsePanelComponent,
    SocketPanelComponent,
    GrpcWebPanelComponent,
  ],
  templateUrl: "./app.component.html",
})
```

Edit `frontend-angular/src/app/app.component.html`. Current:

```html
<div class="app">
  <h1>Tempo real — Angular</h1>
  <nav class="tabs">
    <button [class.active]="active === 'polling'" (click)="setActive('polling')">Polling</button>
    <button [class.active]="active === 'long-polling'" (click)="setActive('long-polling')">Long Polling</button>
    <button [class.active]="active === 'sse'" (click)="setActive('sse')">SSE</button>
    <button [class.active]="active === 'socket'" (click)="setActive('socket')">WebSocket</button>
  </nav>

  <app-polling-panel *ngIf="active === 'polling'"></app-polling-panel>
  <app-long-polling-panel *ngIf="active === 'long-polling'"></app-long-polling-panel>
  <app-sse-panel *ngIf="active === 'sse'"></app-sse-panel>
  <app-socket-panel *ngIf="active === 'socket'"></app-socket-panel>
</div>
```

becomes:

```html
<div class="app">
  <h1>Tempo real — Angular</h1>
  <nav class="tabs">
    <button [class.active]="active === 'polling'" (click)="setActive('polling')">Polling</button>
    <button [class.active]="active === 'long-polling'" (click)="setActive('long-polling')">Long Polling</button>
    <button [class.active]="active === 'sse'" (click)="setActive('sse')">SSE</button>
    <button [class.active]="active === 'socket'" (click)="setActive('socket')">WebSocket</button>
    <button [class.active]="active === 'grpc-web'" (click)="setActive('grpc-web')">gRPC-Web</button>
  </nav>

  <app-polling-panel *ngIf="active === 'polling'"></app-polling-panel>
  <app-long-polling-panel *ngIf="active === 'long-polling'"></app-long-polling-panel>
  <app-sse-panel *ngIf="active === 'sse'"></app-sse-panel>
  <app-socket-panel *ngIf="active === 'socket'"></app-socket-panel>
  <app-grpc-web-panel *ngIf="active === 'grpc-web'"></app-grpc-web-panel>
</div>
```

- [ ] **Step 3: Verify in the browser**

Run: `cd backend && npm run dev` (leave running, if not already), then `cd frontend-angular && npm start` (leave running).
Open the Angular dev URL, click "gRPC-Web" tab (accent should render red, matching this app's identity), click "Conectar".
Expected: same behaviour as the React panel — badge `conectando` → `conectado`, timeline auto-advances every 5s, "Avançar agora" works immediately.

- [ ] **Step 4: Commit**

```bash
git add frontend-angular/src/app/patterns/grpc-web frontend-angular/src/app/app.component.ts frontend-angular/src/app/app.component.html
git commit -m "feat: adiciona painel gRPC-Web (Angular) e aba nova"
```

---

### Task 11: End-to-end regression check

**Files:** none (verification only)

- [ ] **Step 1: Run everything together**

In three terminals:
```bash
cd backend && npm run dev
cd frontend-react && npm run dev
cd frontend-angular && npm start
```

- [ ] **Step 2: Regression-check the 4 existing patterns in both frontends**

For each of Polling, Long Polling, SSE, WebSocket, in both React and Angular:
- Click "Novo pedido", click "Iniciar"/"Conectar".
- Confirm status advances (auto and/or via "Avançar agora" where present) exactly as before this change.
- Confirm no console errors related to CORS (the widened CORS config in Task 3 is the one shared-code change with any regression risk).

- [ ] **Step 3: Exercise the new gRPC-Web panel end to end**

In both frontends:
- "Novo pedido" → "Conectar" on the gRPC-Web tab.
- Let it auto-advance to "Entregue" (4 statuses × 5s ≈ 20s) without touching anything.
- Confirm the stream ends cleanly (badge goes back to `desconectado`, no uncaught error in the console).
- Start a new order, connect, and click "Avançar agora" repeatedly to confirm the unary RPC also works standalone.
- In the Network tab, confirm the `WatchOrder` request's response `content-type` starts with `application/grpc-web` (not `application/connect+...`) — this is the concrete proof the wire protocol is actually gRPC-Web.

- [ ] **Step 4: Full typecheck sweep**

```bash
cd backend && npm run typecheck && npm test
cd frontend-react && npx tsc --noEmit
cd frontend-angular && npm run typecheck
```
Expected: all green.

- [ ] **Step 5: Final commit (if anything was fixed during this task)**

```bash
git add -A
git commit -m "chore: ajustes finais de regressao pro padrao gRPC-Web"
```
(Skip this step entirely if Steps 1–4 needed no fixes — don't create an empty commit.)
