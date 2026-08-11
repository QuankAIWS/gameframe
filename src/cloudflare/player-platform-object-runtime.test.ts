import assert from "node:assert/strict";
import test from "node:test";
import { PlayerPlatformObjectRuntime } from "./player-platform-object-runtime.ts";
import type { DurableStorageLike } from "./runtime-contracts.ts";

class MemoryStorage implements DurableStorageLike {
  readonly values = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> { return this.values.get(key) as T | undefined; }
  async put<T>(key: string, value: T): Promise<void> { this.values.set(key, structuredClone(value)); }
}

async function body(response: Response) {
  return response.json() as Promise<any>;
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

function completedMatch(matchId: string, winnerPlayerId: string | null, draw = false) {
  return {
    matchId,
    gameId: "othello",
    playerIds: ["discord:1", "discord:2"],
    revision: 60,
    activePlayerId: null,
    status: { lifecycle: "completed", winnerPlayerId, draw },
    updatedAt: matchId === "match-1" ? 1000 : 2000,
    resumePath: `/othello.html?match=${matchId}`,
  };
}

function scored(playerId: string, score: number, eventId = "cascade-weekly-blitz-v1:2026-08-10") {
  return {
    gameId: "cascade",
    modeId: "weekly-blitz",
    eventId,
    playerId,
    score,
    metrics: { matches: 12, specials: 3, cascades: 4 },
    updatedAt: score + 1000,
  };
}

test("player directory lists other Discord players but not the viewer", async () => {
  const runtime = new PlayerPlatformObjectRuntime(new MemoryStorage());
  await runtime.fetch(request("/directory/upsert", "POST", {
    playerId: "discord:1", displayName: "Alice", source: "discord", lastSeenAt: 1000,
  }));
  await runtime.fetch(request("/directory/upsert", "POST", {
    playerId: "discord:2", displayName: "Mom", source: "discord", lastSeenAt: 2000,
  }));
  await runtime.fetch(request("/directory/upsert", "POST", {
    playerId: "browser:3", displayName: "Dev", source: "development", lastSeenAt: 3000,
  }));

  const result = await body(await runtime.fetch(request("/directory/list?playerId=discord%3A1")));
  assert.deepEqual(result.players.map((player: any) => player.playerId), ["discord:2"]);
});

test("player feed keeps the newest authoritative match summary", async () => {
  const runtime = new PlayerPlatformObjectRuntime(new MemoryStorage());
  const summary = {
    matchId: "match-1",
    gameId: "othello",
    playerIds: ["discord:1", "discord:2"],
    revision: 0,
    activePlayerId: "discord:1",
    status: { lifecycle: "active", winnerPlayerId: null, draw: false },
    updatedAt: 1000,
    resumePath: "/othello.html?match=match-1",
  };
  await runtime.fetch(request("/player/match", "POST", summary));
  await runtime.fetch(request("/player/match", "POST", {
    ...summary,
    revision: 1,
    activePlayerId: "discord:2",
    updatedAt: 2000,
  }));

  const feed = await body(await runtime.fetch(request("/player/feed")));
  assert.equal(feed.matches.length, 1);
  assert.equal(feed.matches[0].revision, 1);
  assert.equal(feed.matches[0].activePlayerId, "discord:2");
  assert.deepEqual(feed.favoriteGameIds, []);
});

test("target challenge token survives later status projections that omit it", async () => {
  const runtime = new PlayerPlatformObjectRuntime(new MemoryStorage());
  const invitation = {
    invitationId: "invite-1",
    gameId: "othello",
    status: "pending",
    inviter: { playerId: "discord:1", displayName: "Alice", avatarUrl: null },
    claimant: null,
    targetRestricted: true,
    issuedAt: 1000,
    expiresAt: 9999999999,
    matchId: null,
    updatedAt: 1000,
  };
  await runtime.fetch(request("/player/invitation", "POST", { ...invitation, claimToken: "signed-token" }));
  await runtime.fetch(request("/player/invitation", "POST", { ...invitation, updatedAt: 2000 }));
  const feed = await body(await runtime.fetch(request("/player/feed")));
  assert.equal(feed.invitations[0].claimToken, "signed-token");
});

test("favorite games persist and older feed records migrate with an empty favorite list", async () => {
  const storage = new MemoryStorage();
  storage.values.set("gameframe:player-feed:v1", {
    version: 1,
    matches: [],
    invitations: [],
  });
  const runtime = new PlayerPlatformObjectRuntime(storage);
  let feed = await body(await runtime.fetch(request("/player/feed")));
  assert.deepEqual(feed.favoriteGameIds, []);

  const saved = await body(await runtime.fetch(request("/player/preferences", "POST", {
    favoriteGameIds: ["othello", "cascade", "othello"],
  })));
  assert.deepEqual(saved.favoriteGameIds, ["othello", "cascade"]);
  feed = await body(await runtime.fetch(request("/player/feed")));
  assert.deepEqual(feed.favoriteGameIds, ["othello", "cascade"]);
});

test("leaderboard counts each completed authoritative match once and ranks by points", async () => {
  const runtime = new PlayerPlatformObjectRuntime(new MemoryStorage());
  await runtime.fetch(request("/directory/upsert", "POST", {
    playerId: "discord:1", displayName: "Alice", source: "discord", lastSeenAt: 1000,
  }));
  await runtime.fetch(request("/directory/upsert", "POST", {
    playerId: "discord:2", displayName: "Mom", source: "discord", lastSeenAt: 2000,
  }));

  await runtime.fetch(request("/directory/match", "POST", completedMatch("match-1", "discord:2")));
  await runtime.fetch(request("/directory/match", "POST", completedMatch("match-1", "discord:2")));
  await runtime.fetch(request("/directory/match", "POST", completedMatch("match-2", null, true)));

  const leaderboard = await body(await runtime.fetch(request("/directory/leaderboard")));
  assert.equal(leaderboard.games.length, 1);
  assert.equal(leaderboard.games[0].gameId, "othello");
  assert.deepEqual(leaderboard.games[0].entries.map((entry: any) => ({
    playerId: entry.playerId,
    played: entry.played,
    points: entry.points,
  })), [
    { playerId: "discord:2", played: 2, points: 4 },
    { playerId: "discord:1", played: 2, points: 1 },
  ]);
  assert.deepEqual(leaderboard.scoredGames, []);
});

test("scored leaderboards keep each player's best event result and rank by score", async () => {
  const runtime = new PlayerPlatformObjectRuntime(new MemoryStorage());
  await runtime.fetch(request("/directory/upsert", "POST", {
    playerId: "discord:1", displayName: "Alice", source: "discord", lastSeenAt: 1000,
  }));
  await runtime.fetch(request("/directory/upsert", "POST", {
    playerId: "discord:2", displayName: "Mom", source: "discord", lastSeenAt: 2000,
  }));

  const first = await body(await runtime.fetch(request("/directory/score", "POST", scored("discord:1", 12_000))));
  assert.equal(first.improved, true);
  assert.equal(first.previousBest, null);

  const lower = await body(await runtime.fetch(request("/directory/score", "POST", scored("discord:1", 9_000))));
  assert.equal(lower.improved, false);
  assert.equal(lower.entry.score, 12_000);
  assert.equal(lower.previousBest, 12_000);

  await runtime.fetch(request("/directory/score", "POST", scored("discord:2", 15_000)));
  await runtime.fetch(request("/directory/score", "POST", scored("discord:1", 8_000, "cascade-weekly-blitz-v1:2026-08-17")));

  const leaderboard = await body(await runtime.fetch(request("/directory/leaderboard")));
  assert.equal(leaderboard.scoredGames.length, 2);
  assert.equal(leaderboard.scoredGames[0].eventId, "cascade-weekly-blitz-v1:2026-08-17");
  assert.deepEqual(leaderboard.scoredGames[1].entries.map((entry: any) => ({
    playerId: entry.playerId,
    score: entry.score,
  })), [
    { playerId: "discord:2", score: 15_000 },
    { playerId: "discord:1", score: 12_000 },
  ]);
  assert.deepEqual(leaderboard.scoredGames[1].entries[1].metrics, { matches: 12, specials: 3, cascades: 4 });
});