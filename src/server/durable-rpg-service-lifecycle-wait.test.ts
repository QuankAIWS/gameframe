import { createServer } from "node:http";
import assert from "node:assert/strict";
import test from "node:test";

import { DurableRpgServiceLifecycle } from "./durable-rpg-service-lifecycle.ts";

test("waitUntilTerminated resolves after concurrent retirement", async () => {
  const lifecycle = new DurableRpgServiceLifecycle({
    server: createServer((_request, response) => response.end("ok")),
    pollIntervalMs: 10,
    worker: { async runOnce() { return { kind: "idle" }; } },
  });

  await lifecycle.start();
  const terminated = lifecycle.waitUntilTerminated();
  await lifecycle.retire();
  await terminated;
  assert.equal(lifecycle.state, "stopped");
});

test("waitUntilTerminated rejects with the fatal worker failure", async () => {
  const failure = new Error("outbox failed");
  const lifecycle = new DurableRpgServiceLifecycle({
    server: createServer((_request, response) => response.end("ok")),
    worker: { async runOnce() { throw failure; } },
  });

  await lifecycle.start();
  await assert.rejects(lifecycle.waitUntilTerminated(), failure);
  assert.equal(lifecycle.state, "failed");
});

test("waitUntilTerminated rejects before startup", async () => {
  const lifecycle = new DurableRpgServiceLifecycle({
    server: createServer(),
    worker: { async runOnce() { return { kind: "idle" }; } },
  });

  await assert.rejects(lifecycle.waitUntilTerminated(), /cannot be awaited from created/);
  await lifecycle.retire();
});
