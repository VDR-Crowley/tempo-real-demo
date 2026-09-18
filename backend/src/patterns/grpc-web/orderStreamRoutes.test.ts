import { describe, it } from "node:test";
import assert from "node:assert";
import { createClient, createRouterTransport, ConnectError } from "@connectrpc/connect";
import { OrderStreamService } from "../../generated/order_stream_pb.js";
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
