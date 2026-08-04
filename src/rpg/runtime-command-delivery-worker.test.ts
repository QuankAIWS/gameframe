import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  RuntimeCommandDeliveryHttpTransport,
  RuntimeCommandDeliveryTransportError,
  RuntimeCommandDeliveryWorker,
  type RuntimeCommandDeliveryTransport,
} from "./runtime-command-delivery-worker.ts";
import {
  SqliteRuntimeCommandOutbox,
  type RuntimeCommandDeliveryV1,
} from "./runtime-command-outbox.ts";

const directories: string[] = [];

test.afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-rpg-worker-"));
  directories.push(directory);
  return join(directory, "gameframe.sqlite");
}

function delivery(): RuntimeCommandDeliveryV1 {
  return {
    protocolVersion: 1,
    deliveryId: "delivery:campaign-one:command-one",
    campaignId: "campaign-one",
    commandId: "command-one",
    authenticatedPlayerId: "discord:1234",
    sourceGameframeCoordinationRevision: 5,
    acceptedGameframeCoordinationRevision: 6,
    sourcePresentationSequence: 8,
    acceptedPresentationSequence: 9,
    issuedAt: "2026-08-04T22:50:00.000Z",
    command: {
      kind: "campaign.submit_action",
      visibility: "public",
      text: "Inspect the academy gate.",
    },
  };
}

function clock(...values: string[]) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)]!;
}

test("worker marks a durably queued command runtime-accepted", async () => {
  const outbox = new SqliteRuntimeCommandOutbox({ filePath: databasePath() });
  outbox.enqueue(delivery());
  const transport: RuntimeCommandDeliveryTransport = {
    async deliver(command) {
      return {
        protocolVersion: 1,
        kind: "runtime.command_accepted",
        deliveryId: command.deliveryId,
        campaignId: command.campaignId,
        commandId: command.commandId,
        acceptedAt: "2026-08-04T22:51:00.500Z",
      };
    },
  };
  const worker = new RuntimeCommandDeliveryWorker({
    outbox,
    transport,
    clock: clock("2026-08-04T22:51:00.000Z", "2026-08-04T22:51:01.000Z"),
  });

  const result = await worker.runOnce();
  assert.equal(result.kind, "runtime-accepted");
  if (result.kind === "runtime-accepted") {
    assert.equal(result.record.status, "runtime-accepted");
  }
  assert.deepEqual(await worker.runOnce(), { kind: "idle" });
  outbox.close();
});

test("worker requeues retryable failures and resolves a lost response by exact retry", async () => {
  const outbox = new SqliteRuntimeCommandOutbox({ filePath: databasePath() });
  outbox.enqueue(delivery());
  let runtimeAccepted = false;
  let calls = 0;
  const transport: RuntimeCommandDeliveryTransport = {
    async deliver(command) {
      calls += 1;
      if (!runtimeAccepted) {
        runtimeAccepted = true;
        throw new RuntimeCommandDeliveryTransportError({
          code: "runtime-unavailable",
          message: "response was lost after durable runtime acceptance",
          retryable: true,
        });
      }
      return {
        protocolVersion: 1,
        kind: "runtime.command_accepted",
        deliveryId: command.deliveryId,
        campaignId: command.campaignId,
        commandId: command.commandId,
        acceptedAt: "2026-08-04T22:51:00.500Z",
      };
    },
  };
  const worker = new RuntimeCommandDeliveryWorker({
    outbox,
    transport,
    clock: clock(
      "2026-08-04T22:51:00.000Z",
      "2026-08-04T22:51:01.000Z",
      "2026-08-04T22:52:00.000Z",
      "2026-08-04T22:52:01.000Z",
    ),
  });

  const first = await worker.runOnce();
  assert.equal(first.kind, "retry-scheduled");
  const second = await worker.runOnce();
  assert.equal(second.kind, "runtime-accepted");
  assert.equal(calls, 2);
  assert.equal(outbox.get(delivery().deliveryId)?.attemptCount, 2);
  outbox.close();
});

test("worker quarantines authoritative runtime rejection", async () => {
  const outbox = new SqliteRuntimeCommandOutbox({ filePath: databasePath() });
  outbox.enqueue(delivery());
  const worker = new RuntimeCommandDeliveryWorker({
    outbox,
    transport: {
      async deliver() {
        throw new RuntimeCommandDeliveryTransportError({
          code: "runtime-rejected",
          message: "command identity conflicted with durable runtime custody",
          retryable: false,
          status: 409,
        });
      },
    },
    clock: clock("2026-08-04T22:51:00.000Z", "2026-08-04T22:51:01.000Z"),
  });

  const result = await worker.runOnce();
  assert.equal(result.kind, "reconciliation-required");
  assert.equal(outbox.get(delivery().deliveryId)?.status, "reconciliation-required");
  outbox.close();
});

test("HTTP transport sends service authentication and validates exact receipt identity", async (context) => {
  const token = "t".repeat(48);
  let authorization = "";
  let received: unknown;
  const server = createServer(async (request, response) => {
    authorization = request.headers.authorization ?? "";
    let body = "";
    for await (const chunk of request) body += chunk;
    received = JSON.parse(body);
    response.writeHead(202, { "content-type": "application/json" });
    response.end(JSON.stringify({
      protocolVersion: 1,
      kind: "runtime.command_accepted",
      deliveryId: delivery().deliveryId,
      campaignId: delivery().campaignId,
      commandId: delivery().commandId,
      acceptedAt: "2026-08-04T22:51:00.500Z",
    }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const transport = new RuntimeCommandDeliveryHttpTransport({
    baseUrl: `http://127.0.0.1:${address.port}`,
    serviceToken: token,
  });
  const receipt = await transport.deliver(delivery());
  assert.equal(authorization, `Bearer ${token}`);
  assert.deepEqual(received, delivery());
  assert.equal(receipt.commandId, delivery().commandId);
});

test("HTTP transport rejects substituted receipt identity", async (context) => {
  const server = createServer((_request, response) => {
    response.writeHead(202, { "content-type": "application/json" });
    response.end(JSON.stringify({
      protocolVersion: 1,
      kind: "runtime.command_accepted",
      deliveryId: delivery().deliveryId,
      campaignId: delivery().campaignId,
      commandId: "different-command",
      acceptedAt: "2026-08-04T22:51:00.500Z",
    }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const transport = new RuntimeCommandDeliveryHttpTransport({
    baseUrl: `http://127.0.0.1:${address.port}`,
    serviceToken: "t".repeat(48),
  });
  await assert.rejects(
    () => transport.deliver(delivery()),
    (error: unknown) =>
      error instanceof RuntimeCommandDeliveryTransportError
      && error.code === "invalid-runtime-response"
      && error.retryable === false,
  );
});
