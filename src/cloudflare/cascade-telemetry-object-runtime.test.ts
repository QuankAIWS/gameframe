import assert from "node:assert/strict";
import test from "node:test";
import { buildCascadeTelemetryExport } from "./cascade-telemetry-coordinator.ts";
import { CascadeTelemetryObjectRuntime } from "./cascade-telemetry-object-runtime.ts";
import type { DurableStorageLike } from "./runtime-contracts.ts";

class MemoryStorage implements DurableStorageLike {
  readonly values = new Map<string, unknown>();
  puts = 0;
  async get<T>(key: string): Promise<T | undefined> { return this.values.get(key) as T | undefined; }
  async put<T>(key: string, value: T): Promise<void> {
    this.puts += 1;
    this.values.set(key, structuredClone(value));
  }
}

function request(path: string, method = "GET", value?: unknown) {
  return new Request(`https://player.internal${path}`, {
    method,
    ...(value === undefined ? {} : {
      headers: { "content-type": "application/json" },
      body: JSON.stringify(value),
    }),
  });
}

async function body(response: Response) {
  return response.json() as Promise<any>;
}

function event(
  id: string,
  seconds: number,
  type: string,
  payload: Record<string, unknown>,
  attemptId: string | null = null,
) {
  return {
    eventId: id,
    at: new Date(Date.UTC(2026, 7, 12, 16, 0, seconds)).toISOString(),
    type,
    sessionId: "session-1",
    attemptId,
    payload,
  };
}

test("Cascade telemetry persists events, deduplicates retries without writes, and quarantines malformed batch members", async () => {
  const storage = new MemoryStorage();
  const runtime = new CascadeTelemetryObjectRuntime(storage);
  const events = [
    event("e1", 0, "telemetry_session_start", { activeMs: 0 }),
    event("e2", 1, "level_start", { mode: "normal", level: 5, score: 0, movesRemaining: 18 }, "attempt-1"),
    event("e3", 2, "move", { mode: "normal", level: 5, score: 0, movesRemaining: 17 }, "attempt-1"),
    event("e4", 3, "booster_used", { mode: "normal", level: 5, booster: "hammer", score: 400, movesRemaining: 17 }, "attempt-1"),
    event("e5", 4, "level_failed", { mode: "normal", level: 5, score: 900, movesRemaining: 0 }, "attempt-1"),
    event("e6", 5, "level_start", { mode: "normal", level: 5, score: 0, movesRemaining: 18 }, "attempt-2"),
    event("e7", 6, "move", { mode: "normal", level: 5, score: 0, movesRemaining: 17 }, "attempt-2"),
    event("e8", 7, "level_win", { mode: "normal", level: 5, score: 3200, movesRemaining: 4, stars: 2 }, "attempt-2"),
    event("e9", 8, "telemetry_session_heartbeat", { activeMs: 90_000 }),
  ];

  const first = await body(await runtime.fetch(request("/telemetry/cascade/ingest", "POST", { events })));
  assert.equal(first.accepted, 9);
  assert.equal(first.duplicates, 0);
  assert.deepEqual(first.acceptedEventIds, events.map((value) => value.eventId));
  const putsAfterFirst = storage.puts;

  const duplicate = await body(await runtime.fetch(request("/telemetry/cascade/ingest", "POST", { events })));
  assert.equal(duplicate.accepted, 0);
  assert.equal(duplicate.duplicates, 9);
  assert.deepEqual(duplicate.duplicateEventIds, events.map((value) => value.eventId));
  assert.equal(storage.puts, putsAfterFirst, "duplicate-only retries must not spend Durable Object storage writes");

  const mixed = await body(await runtime.fetch(request("/telemetry/cascade/ingest", "POST", {
    events: [
      event("e10", 9, "move", { mode: "normal", level: 5 }, "attempt-2"),
      { eventId: "bad-event", at: "not-a-date", type: "move", payload: {} },
    ],
  })));
  assert.equal(mixed.accepted, 1);
  assert.equal(mixed.rejected.length, 1);
  assert.equal(mixed.rejected[0].eventId, "bad-event");
  assert.deepEqual(mixed.acceptedEventIds, ["e10"]);

  const exported = await body(await runtime.fetch(request("/telemetry/cascade/export")));
  assert.equal(exported.schemaVersion, 1);
  assert.equal(exported.events.length, 10);
});

test("Cascade telemetry export separates active attempt time from suspended wall-clock time", async () => {
  const runtime = new CascadeTelemetryObjectRuntime(new MemoryStorage());
  const events = [
    event("e1", 0, "telemetry_session_start", { activeMs: 0 }),
    event("e2", 1, "level_start", { mode: "normal", level: 5, score: 0, movesRemaining: 18, activeAttemptMs: 0 }, "attempt-1"),
    event("e3", 2, "move", { mode: "normal", level: 5, score: 0, movesRemaining: 17, activeAttemptMs: 1_000 }, "attempt-1"),
    event("e4", 4, "level_failed", { mode: "normal", level: 5, score: 900, movesRemaining: 0, activeAttemptMs: 3_000 }, "attempt-1"),
    event("e5", 5, "level_start", { mode: "normal", level: 5, score: 0, movesRemaining: 18, activeAttemptMs: 0 }, "attempt-2"),
    event("e6", 6, "move", { mode: "normal", level: 5, score: 0, movesRemaining: 17, activeAttemptMs: 1_000 }, "attempt-2"),
    event("e7", 65, "level_win", { mode: "normal", level: 5, score: 3200, movesRemaining: 4, stars: 2, activeAttemptMs: 2_000 }, "attempt-2"),
    event("e8", 66, "telemetry_session_heartbeat", { activeMs: 90_000 }),
  ];
  await runtime.fetch(request("/telemetry/cascade/ingest", "POST", { events }));
  const telemetry = await body(await runtime.fetch(request("/telemetry/cascade/export")));

  const exported = buildCascadeTelemetryExport(Date.UTC(2026, 7, 12, 17), [{
    playerId: "discord:2",
    displayName: "Mom",
    source: "discord",
    telemetry,
  }]);

  assert.equal(exported.schemaVersion, 2);
  assert.equal(exported.totals.players, 1);
  assert.equal(exported.totals.playBlocks, 1);
  assert.equal(exported.totals.activePlayMs, 90_000);
  assert.equal(exported.totals.attempts, 2);
  assert.equal(exported.totals.retries, 1);
  assert.equal(exported.players[0].summary.averageActiveAttemptMs, 2_500);
  assert.equal(exported.players[0].summary.averageWallClockAttemptMs, 31_500);
  assert.deepEqual(exported.players[0].attempts.map((attempt) => attempt.outcome), ["failed", "win"]);
  assert.deepEqual(exported.players[0].attempts.map((attempt) => attempt.activeAttemptMs), [3_000, 2_000]);
});

test("Cascade telemetry export closes Blitz and Quick Recall runs and summarizes resource flows", async () => {
  const runtime = new CascadeTelemetryObjectRuntime(new MemoryStorage());
  const events = [
    event("b1", 0, "blitz_offer", { mode: "normal", level: 12 }, "blitz-1"),
    event("b2", 1, "blitz_start", { mode: "blitz", level: 12, activeAttemptMs: 0 }, "blitz-1"),
    event("b3", 31, "blitz_complete", { mode: "blitz", level: 12, score: 7200, stars: 2, activeAttemptMs: 30_000 }, "blitz-1"),
    event("r1", 32, "quick_recall_offer", { mode: "bonus", afterLevel: 24 }, "recall-1"),
    event("r2", 33, "quick_recall_start", { mode: "bonus", afterLevel: 24, activeAttemptMs: 0 }, "recall-1"),
    event("r3", 38, "quick_recall_round_complete", { mode: "bonus", afterLevel: 24, round: 1, correct: 3, total: 3, activeAttemptMs: 5_000 }, "recall-1"),
    event("r4", 48, "quick_recall_complete", { mode: "bonus", afterLevel: 24, accuracy: 0.9, stars: 3, activeAttemptMs: 15_000 }, "recall-1"),
    event("x1", 49, "resource_change", { mode: "normal", resource: "hammer", direction: "source", amount: 1 }),
    event("x2", 50, "resource_change", { mode: "normal", resource: "hammer", direction: "sink", amount: 1 }),
    event("x3", 51, "resource_change", { mode: "normal", resource: "life", direction: "source", amount: 2 }),
  ];
  await runtime.fetch(request("/telemetry/cascade/ingest", "POST", { events }));
  const telemetry = await body(await runtime.fetch(request("/telemetry/cascade/export")));
  const exported = buildCascadeTelemetryExport(Date.UTC(2026, 7, 12, 17), [{
    playerId: "discord:2",
    displayName: "Mom",
    source: "discord",
    telemetry,
  }]);

  assert.deepEqual(exported.players[0].attempts.map((attempt) => attempt.outcome), ["complete", "complete"]);
  assert.equal(exported.players[0].summary.bonus.blitzCompletes, 1);
  assert.equal(exported.players[0].summary.bonus.quickRecallRounds, 1);
  assert.equal(exported.players[0].summary.bonus.quickRecallCompletes, 1);
  assert.equal(exported.players[0].summary.resources.hammerSources, 1);
  assert.equal(exported.players[0].summary.resources.hammerSinks, 1);
  assert.equal(exported.players[0].summary.resources.lifeSources, 2);
});

test("Cascade telemetry chunks large histories and accepts 24-event upload batches", async () => {
  const runtime = new CascadeTelemetryObjectRuntime(new MemoryStorage());
  const values = Array.from({ length: 130 }, (_, index) => event(
    `chunk-${index}`,
    index,
    "move",
    { mode: "normal", level: 1, score: index, movesRemaining: 18 - (index % 18) },
    "attempt-chunk",
  ));

  let latest = null;
  for (let offset = 0; offset < values.length; offset += 24) {
    latest = await body(await runtime.fetch(request("/telemetry/cascade/ingest", "POST", {
      events: values.slice(offset, offset + 24),
    })));
  }
  assert.equal(latest.accepted, 10);
  assert.equal(latest.storedChunks, 2);
  const exported = await body(await runtime.fetch(request("/telemetry/cascade/export")));
  assert.equal(exported.events.length, 130);
});
