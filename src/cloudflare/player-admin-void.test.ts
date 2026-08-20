import assert from "node:assert/strict";
import test from "node:test";
import { PlayerPlatformObjectRuntime } from "./player-platform-object-runtime.ts";
import { PlayerPlatformThemeRuntime } from "./player-platform-theme-runtime.ts";
import type { DurableStorageLike } from "./runtime-contracts.ts";

class MemoryStorage implements DurableStorageLike {
  readonly values = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    const value = this.values.get(key);
    return value === undefined ? undefined : structuredClone(value) as T;
  }

  async put<T>(key: string, value: T): Promise<void> {
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

async function jsonBody(response: Response) {
  return response.json() as Promise<any>;
}

function completedMatch(matchId: string, winnerPlayerId: string | null, draw = false) {
  return {
    matchId,
    gameId: "othello",
    playerIds: ["discord:1", "discord:2"],
    revision: 60,
    activePlayerId: null,
    status: { lifecycle: "completed", winnerPlayerId, draw },
    updatedAt: 1000,
    resumePath: `/othello.html?match=${matchId}`,
  };
}

function activeMatch(matchId: string, revision = 60) {
  return {
    matchId,
    gameId: "othello",
    playerIds: ["discord:1", "discord:2"],
    revision,
    activePlayerId: "discord:1",
    status: { lifecycle: "active", winnerPlayerId: null, draw: false },
    updatedAt: 900,
    resumePath: `/othello.html?match=${matchId}`,
  };
}

test("voiding a completed loss removes it from the player feed and reverses its exact XP/stat award once", async () => {
  const runtime = new PlayerPlatformObjectRuntime(new MemoryStorage());
  const match = completedMatch("test-loss", "discord:2");

  await runtime.fetch(request("/player/match", "POST", match));
  const awarded = await jsonBody(await runtime.fetch(request("/player/progression/match", "POST", {
    ...match,
    playerId: "discord:1",
  })));
  assert.equal(awarded.awarded, true);
  assert.equal(awarded.progression.gamerXp, 75);
  assert.deepEqual(awarded.progression.games.othello, { played: 1, wins: 0, losses: 1, draws: 0 });

  const firstVoid = await jsonBody(await runtime.fetch(request("/player/admin/match/void", "POST", {
    playerId: "discord:1",
    matchId: "test-loss",
  })));
  assert.equal(firstVoid.removed, true);
  assert.equal(firstVoid.reversed, true);
  assert.equal(firstVoid.progression.gamerXp, 0);
  assert.equal(firstVoid.progression.games.othello, undefined);

  const feed = await jsonBody(await runtime.fetch(request("/player/feed")));
  assert.deepEqual(feed.matches, []);

  const secondVoid = await jsonBody(await runtime.fetch(request("/player/admin/match/void", "POST", {
    playerId: "discord:1",
    matchId: "test-loss",
  })));
  assert.equal(secondVoid.removed, false);
  assert.equal(secondVoid.reversed, false);
  assert.equal(secondVoid.progression.gamerXp, 0);
});

test("voiding a completed win reverses both completion and win XP", async () => {
  const runtime = new PlayerPlatformObjectRuntime(new MemoryStorage());
  const match = completedMatch("test-win", "discord:1");

  await runtime.fetch(request("/player/match", "POST", match));
  const awarded = await jsonBody(await runtime.fetch(request("/player/progression/match", "POST", {
    ...match,
    playerId: "discord:1",
  })));
  assert.equal(awarded.progression.gamerXp, 100);
  assert.deepEqual(awarded.progression.games.othello, { played: 1, wins: 1, losses: 0, draws: 0 });

  const voided = await jsonBody(await runtime.fetch(request("/player/admin/match/void", "POST", {
    playerId: "discord:1",
    matchId: "test-win",
  })));
  assert.equal(voided.reversed, true);
  assert.equal(voided.progression.gamerXp, 0);
  assert.equal(voided.progression.games.othello, undefined);
});

test("directory admin void removes the match from leaderboard aggregation", async () => {
  const runtime = new PlayerPlatformObjectRuntime(new MemoryStorage());
  for (const [playerId, displayName] of [["discord:1", "Alice"], ["discord:2", "Bob"]]) {
    await runtime.fetch(request("/directory/upsert", "POST", {
      playerId,
      displayName,
      source: "discord",
      lastSeenAt: 1000,
    }));
  }
  await runtime.fetch(request("/directory/match", "POST", completedMatch("test-leaderboard", "discord:2")));

  let leaderboard = await jsonBody(await runtime.fetch(request("/directory/leaderboard")));
  assert.equal(leaderboard.games.length, 1);
  assert.equal(leaderboard.games[0].entries.length, 2);

  const removed = await jsonBody(await runtime.fetch(request("/directory/admin/match/void", "POST", {
    matchId: "test-leaderboard",
  })));
  assert.equal(removed.removed, true);

  leaderboard = await jsonBody(await runtime.fetch(request("/directory/leaderboard")));
  assert.equal(leaderboard.games.length, 0);
});

test("player admin void emits matches and progression invalidations", async () => {
  const notifications: string[][] = [];
  const runtime = new PlayerPlatformThemeRuntime(new MemoryStorage(), {
    onUpdated: async (topics) => { notifications.push([...topics]); },
  });
  const match = completedMatch("test-notify", "discord:2");
  await runtime.fetch(request("/player/match", "POST", match));
  await runtime.fetch(request("/player/progression/match", "POST", {
    ...match,
    playerId: "discord:1",
  }));
  notifications.length = 0;

  const response = await runtime.fetch(request("/player/admin/match/void", "POST", {
    playerId: "discord:1",
    matchId: "test-notify",
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(notifications, [["matches", "progression"]]);
});

test("match feed projection never regresses from completed back to active at the same revision", async () => {
  const runtime = new PlayerPlatformThemeRuntime(new MemoryStorage());
  const matchId = "test-projection-order";
  await runtime.fetch(request("/player/match", "POST", activeMatch(matchId, 8)));
  await runtime.fetch(request("/player/match", "POST", {
    ...completedMatch(matchId, "discord:2"),
    revision: 8,
  }));
  const stale = await jsonBody(await runtime.fetch(request("/player/match", "POST", activeMatch(matchId, 8))));
  assert.equal(stale.ignored, true);
  assert.equal(stale.stale, true);

  const feed = await jsonBody(await runtime.fetch(request("/player/feed")));
  assert.equal(feed.matches.length, 1);
  assert.equal(feed.matches[0].lifecycle, "completed");
  assert.equal(feed.matches[0].winnerPlayerId, "discord:2");
});

test("admin void tombstone blocks later match and progression re-indexing", async () => {
  const runtime = new PlayerPlatformThemeRuntime(new MemoryStorage());
  const match = completedMatch("test-void-tombstone", "discord:2");

  await runtime.fetch(request("/player/match", "POST", match));
  await runtime.fetch(request("/player/progression/match", "POST", {
    ...match,
    playerId: "discord:1",
  }));
  await runtime.fetch(request("/player/admin/match/void", "POST", {
    playerId: "discord:1",
    matchId: match.matchId,
  }));

  const lateMatch = await jsonBody(await runtime.fetch(request("/player/match", "POST", match)));
  assert.equal(lateMatch.ignored, true);
  assert.equal(lateMatch.voided, true);
  const lateProgression = await jsonBody(await runtime.fetch(request("/player/progression/match", "POST", {
    ...match,
    playerId: "discord:1",
  })));
  assert.equal(lateProgression.awarded, false);
  assert.equal(lateProgression.voided, true);
  assert.equal(lateProgression.progression.gamerXp, 0);

  const feed = await jsonBody(await runtime.fetch(request("/player/feed")));
  assert.deepEqual(feed.matches, []);
});

test("directory void tombstone prevents a late completed projection from restoring the leaderboard result", async () => {
  const runtime = new PlayerPlatformThemeRuntime(new MemoryStorage());
  for (const [playerId, displayName] of [["discord:1", "Alice"], ["discord:2", "Bob"]]) {
    await runtime.fetch(request("/directory/upsert", "POST", {
      playerId,
      displayName,
      source: "discord",
      lastSeenAt: 1000,
    }));
  }
  const match = completedMatch("test-directory-tombstone", "discord:2");
  await runtime.fetch(request("/directory/match", "POST", match));
  await runtime.fetch(request("/directory/admin/match/void", "POST", { matchId: match.matchId }));
  const late = await jsonBody(await runtime.fetch(request("/directory/match", "POST", match)));
  assert.equal(late.ignored, true);
  assert.equal(late.voided, true);

  const leaderboard = await jsonBody(await runtime.fetch(request("/directory/leaderboard")));
  assert.equal(leaderboard.games.length, 0);
});
