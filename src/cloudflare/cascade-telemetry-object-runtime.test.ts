import assert from "node:assert/strict";
import test from "node:test";
import { buildCascadeTelemetryExport } from "./cascade-telemetry-coordinator.ts";
import { CascadeTelemetryObjectRuntime } from "./cascade-telemetry-object-runtime.ts";
import type { DurableStorageLike } from "./runtime-contracts.ts";

class MemoryStorage implements DurableStorageLike {
  readonly values = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> { return this.values.get(key) as T | undefined; }
  async put<T>(key: string, value: T): Promise<void> { this.values.set(key, structuredClone(value)); }
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

test("Cascade telemetry persists authenticated-player events and deduplicates retries", async () => {
  const runtime = new CascadeTelemetryObjectRuntime(new MemoryStorage());
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

  const duplicate = await body(await runtime.fetch(request("/telemetry/cascade/ingest", "POST", { events })));
  assert.equal(duplicate.accepted, 0);
  assert.equal(duplicate.duplicates, 9);

  const exported = await body(await runtime.fetch(request("/telemetry/cascade/export")));
  assert.equal(exported.schemaVersion, 1);
  assert.equal(exported.events.length, 9);
  assert.deepEqual(exported.events.map((value: any) => value.eventId), events.map((value) => value.eventId));
});

test("Cascade telemetry export derives play blocks, attempts, retries, hammer use, and active time", async () => {
  const runtime = new CascadeTelemetryObjectRuntime(new MemoryStorage());
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
  await runtime.fetch(request("/telemetry/cascade/ingest", "POST", { events }));
  const telemetry = await body(await runtime.fetch(request("/telemetry/cascade/export")));

  const exported = buildCascadeTelemetryExport(Date.UTC(2026, 7, 12, 17), [{
    playerId: "discord:2",
    displayName: "Mom",
    source: "discord",
    telemetry,
  }]);

  assert.equal(exported.totals.players, 1);
  assert.equal(exported.totals.playBlocks, 1);
  assert.equal(exported.totals.activePlayMs, 90_000);
  assert.equal(exported.totals.attempts, 2);
  assert.equal(exported.totals.retries, 1);
  assert.equal(exported.totals.hammersUsed, 1);
  assert.deepEqual(exported.players[0].summary, {
    eventCount: 9,
    playBlocks: 1,
    activePlayMs: 90_000,
    activePlayMinutes: 1.5,
    attempts: 2,
    retries: 1,
    levelWins: 1,
    levelFailures: 1,
    hammersUsed: 1,
    moves: 2,
    invalidSwaps: 0,
    highestLevelStarted: 5,
    highestLevelCompleted: 5,
    averageCompletedAttemptMs: 2500,
  });
  assert.deepEqual(exported.players[0].attempts.map((attempt) => attempt.outcome), ["failed", "win"]);
});

test("Cascade telemetry chunks larger histories instead of growing one Durable Object value without bound", async () => {
  const runtime = new CascadeTelemetryObjectRuntime(new MemoryStorage());
  const values = Array.from({ length: 130 }, (_, index) => event(
    `chunk-${index}`,
    index % 60,
    "move",
    { mode: "normal", level: 1, score: index, movesRemaining: 18 - (index % 18) },
    "attempt-chunk",
  ));
  const first = await body(await runtime.fetch(request("/telemetry/cascade/ingest", "POST", { events: values.slice(0, 100) })));
  const second = await body(await runtime.fetch(request("/telemetry/cascade/ingest", "POST", { events: values.slice(100) })));
  assert.equal(first.accepted, 100);
  assert.equal(second.accepted, 30);
  assert.equal(second.storedChunks, 2);
  const exported = await body(await runtime.fetch(request("/telemetry/cascade/export")));
  assert.equal(exported.events.length, 130);
});
