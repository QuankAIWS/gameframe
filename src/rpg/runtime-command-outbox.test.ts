import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  RuntimeCommandOutboxError,
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
  const directory = mkdtempSync(join(tmpdir(), "gameframe-rpg-outbox-"));
  directories.push(directory);
  return join(directory, "gameframe.sqlite");
}

function delivery(overrides: Partial<RuntimeCommandDeliveryV1> = {}): RuntimeCommandDeliveryV1 {
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
    ...overrides,
  };
}

test("persists accepted commands and returns the original record for exact retry", () => {
  const filePath = databasePath();
  const first = new SqliteRuntimeCommandOutbox({ filePath });
  const inserted = first.enqueue(delivery());
  assert.equal(inserted.kind, "enqueued");
  assert.equal(inserted.record.status, "pending");
  first.close();

  const reopened = new SqliteRuntimeCommandOutbox({ filePath });
  const duplicate = reopened.enqueue(delivery());
  assert.equal(duplicate.kind, "duplicate");
  assert.deepEqual(duplicate.record, inserted.record);
  reopened.close();
});

test("rejects changed command content under an accepted command identity", () => {
  const store = new SqliteRuntimeCommandOutbox({ filePath: databasePath() });
  store.enqueue(delivery());
  assert.throws(
    () =>
      store.enqueue(
        delivery({
          command: {
            kind: "campaign.submit_action",
            visibility: "public",
            text: "Open the academy gate.",
          },
        }),
      ),
    (error: unknown) =>
      error instanceof RuntimeCommandOutboxError && error.code === "command-conflict",
  );
  store.close();
});

test("leases the oldest pending command and durably records runtime acceptance", () => {
  const filePath = databasePath();
  const store = new SqliteRuntimeCommandOutbox({ filePath });
  store.enqueue(delivery(), { acceptedAt: "2026-08-04T22:50:01.000Z" });
  store.enqueue(
    delivery({
      deliveryId: "delivery:campaign-one:command-two",
      commandId: "command-two",
      issuedAt: "2026-08-04T22:50:02.000Z",
    }),
    { acceptedAt: "2026-08-04T22:50:02.000Z" },
  );

  const claim = store.claimNext({
    now: "2026-08-04T22:51:00.000Z",
    leaseDurationMs: 30_000,
  });
  assert.ok(claim);
  assert.equal(claim.record.delivery.commandId, "command-one");
  assert.equal(claim.record.status, "delivering");
  assert.equal(claim.record.attemptCount, 1);

  const accepted = store.markRuntimeAccepted({
    deliveryId: claim.record.delivery.deliveryId,
    leaseToken: claim.leaseToken,
    receipt: {
      protocolVersion: 1,
      kind: "runtime.command_accepted",
      deliveryId: claim.record.delivery.deliveryId,
      campaignId: "campaign-one",
      commandId: "command-one",
      acceptedAt: "2026-08-04T22:51:01.000Z",
    },
    now: "2026-08-04T22:51:01.000Z",
  });
  assert.equal(accepted.status, "runtime-accepted");
  assert.equal(accepted.runtimeReceipt?.commandId, "command-one");
  assert.equal(store.listPending().length, 1);
  store.close();

  const reopened = new SqliteRuntimeCommandOutbox({ filePath });
  assert.equal(
    reopened.get("delivery:campaign-one:command-one")?.status,
    "runtime-accepted",
  );
  assert.equal(reopened.listPending()[0]?.delivery.commandId, "command-two");
  reopened.close();
});

test("releases expired leases and rejects a stale worker token", () => {
  const store = new SqliteRuntimeCommandOutbox({ filePath: databasePath() });
  store.enqueue(delivery());
  const first = store.claimNext({
    now: "2026-08-04T22:51:00.000Z",
    leaseDurationMs: 1_000,
  });
  assert.ok(first);

  const second = store.claimNext({
    now: "2026-08-04T22:51:02.000Z",
    leaseDurationMs: 1_000,
  });
  assert.ok(second);
  assert.notEqual(second.leaseToken, first.leaseToken);
  assert.equal(second.record.attemptCount, 2);

  assert.throws(
    () =>
      store.markRetryableFailure({
        deliveryId: first.record.delivery.deliveryId,
        leaseToken: first.leaseToken,
        code: "timeout",
        message: "old worker timed out",
        now: "2026-08-04T22:51:02.100Z",
      }),
    (error: unknown) =>
      error instanceof RuntimeCommandOutboxError && error.code === "lease-conflict",
  );
  store.close();
});

test("requeues retryable failures and preserves bounded failure evidence", () => {
  const store = new SqliteRuntimeCommandOutbox({ filePath: databasePath() });
  store.enqueue(delivery());
  const claim = store.claimNext({
    now: "2026-08-04T22:51:00.000Z",
    leaseDurationMs: 30_000,
  });
  assert.ok(claim);

  const pending = store.markRetryableFailure({
    deliveryId: claim.record.delivery.deliveryId,
    leaseToken: claim.leaseToken,
    code: "runtime-unavailable",
    message: "GM service did not answer.",
    now: "2026-08-04T22:51:05.000Z",
  });
  assert.equal(pending.status, "pending");
  assert.deepEqual(pending.lastFailure, {
    code: "runtime-unavailable",
    message: "GM service did not answer.",
    at: "2026-08-04T22:51:05.000Z",
  });

  const retry = store.claimNext({
    now: "2026-08-04T22:52:00.000Z",
    leaseDurationMs: 30_000,
  });
  assert.ok(retry);
  assert.equal(retry.record.attemptCount, 2);
  store.close();
});

test("fails closed when persisted payload identity is corrupted", () => {
  const filePath = databasePath();
  const store = new SqliteRuntimeCommandOutbox({ filePath });
  store.enqueue(delivery());
  store.close();

  const database = new DatabaseSync(filePath);
  database.prepare(
    "UPDATE rpg_runtime_command_outbox_v1 SET payload_json = ? WHERE delivery_id = ?",
  ).run(
    JSON.stringify({ ...delivery(), campaignId: "other-campaign" }),
    delivery().deliveryId,
  );
  database.close();

  const reopened = new SqliteRuntimeCommandOutbox({ filePath });
  assert.throws(
    () => reopened.get(delivery().deliveryId),
    (error: unknown) =>
      error instanceof RuntimeCommandOutboxError && error.code === "corrupt-store",
  );
  reopened.close();
});
