import { createServer } from "node:http";
import assert from "node:assert/strict";
import test from "node:test";

import type { RuntimeCommandDeliveryWorkerResult } from "../rpg/runtime-command-delivery-worker.ts";
import { DurableRpgServiceLifecycle } from "./durable-rpg-service-lifecycle.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolveValue) => {
    resolve = resolveValue;
  });
  return { promise, resolve };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("condition was not reached");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function runtimeAccepted(): RuntimeCommandDeliveryWorkerResult {
  return { kind: "runtime-accepted", record: {} as never };
}

function retryScheduled(): RuntimeCommandDeliveryWorkerResult {
  return {
    kind: "retry-scheduled",
    record: {} as never,
    error: new Error("retry") as never,
  };
}

test("closes ingress first and drains immediately deliverable outbox work", async () => {
  const first = deferred<RuntimeCommandDeliveryWorkerResult>();
  let calls = 0;
  let resourcesClosed = 0;
  const server = createServer((_request, response) => response.end("ok"));
  const lifecycle = new DurableRpgServiceLifecycle({
    server,
    pollIntervalMs: 10,
    worker: {
      async runOnce() {
        calls += 1;
        return calls === 1 ? await first.promise : { kind: "idle" };
      },
    },
    closeResources() {
      resourcesClosed += 1;
    },
  });

  const address = await lifecycle.start();
  await waitFor(() => calls === 1);
  assert.equal(
    await fetch(`http://127.0.0.1:${address.port}`).then((response) => response.text()),
    "ok",
  );

  const retirement = lifecycle.retire();
  assert.equal(lifecycle.state, "retiring");
  first.resolve(runtimeAccepted());
  await retirement;

  assert.equal(calls, 2);
  assert.equal(lifecycle.state, "stopped");
  assert.equal(server.listening, false);
  assert.equal(resourcesClosed, 1);
  await assert.rejects(fetch(`http://127.0.0.1:${address.port}`));
});

test("leaves retryable outbox work for a later process during retirement", async () => {
  const first = deferred<RuntimeCommandDeliveryWorkerResult>();
  let calls = 0;
  const lifecycle = new DurableRpgServiceLifecycle({
    server: createServer((_request, response) => response.end("ok")),
    pollIntervalMs: 10,
    worker: {
      async runOnce() {
        calls += 1;
        return await first.promise;
      },
    },
  });

  await lifecycle.start();
  await waitFor(() => calls === 1);
  const retirement = lifecycle.retire();
  first.resolve(retryScheduled());
  await retirement;

  assert.equal(calls, 1);
  assert.equal(lifecycle.state, "stopped");
});

test("continues past reconciliation-required records while draining", async () => {
  const first = deferred<RuntimeCommandDeliveryWorkerResult>();
  let calls = 0;
  const lifecycle = new DurableRpgServiceLifecycle({
    server: createServer((_request, response) => response.end("ok")),
    pollIntervalMs: 10,
    worker: {
      async runOnce() {
        calls += 1;
        if (calls === 1) return await first.promise;
        return { kind: "idle" };
      },
    },
  });

  await lifecycle.start();
  await waitFor(() => calls === 1);
  const retirement = lifecycle.retire();
  first.resolve({
    kind: "reconciliation-required",
    record: {} as never,
    error: new Error("permanent") as never,
  });
  await retirement;

  assert.equal(calls, 2);
  assert.equal(lifecycle.state, "stopped");
});

test("treats outbox/storage failures as fatal and closes owned resources", async () => {
  const failure = new Error("outbox failed");
  let resourcesClosed = 0;
  const server = createServer((_request, response) => response.end("ok"));
  const lifecycle = new DurableRpgServiceLifecycle({
    server,
    pollIntervalMs: 10,
    worker: {
      async runOnce() {
        throw failure;
      },
    },
    closeResources() {
      resourcesClosed += 1;
    },
  });

  await lifecycle.start();
  await waitFor(() => lifecycle.state === "failed");

  assert.equal(lifecycle.failure, failure);
  assert.equal(server.listening, false);
  assert.equal(resourcesClosed, 1);
  await assert.rejects(lifecycle.retire(), failure);
  assert.equal(resourcesClosed, 1);
});

test("can retire before startup and closes resources exactly once", async () => {
  let resourcesClosed = 0;
  const lifecycle = new DurableRpgServiceLifecycle({
    server: createServer(),
    worker: { async runOnce() { return { kind: "idle" }; } },
    closeResources() {
      resourcesClosed += 1;
    },
  });

  await lifecycle.retire();
  await lifecycle.retire();
  assert.equal(lifecycle.state, "stopped");
  assert.equal(resourcesClosed, 1);
  await assert.rejects(lifecycle.start(), /cannot start/);
});
