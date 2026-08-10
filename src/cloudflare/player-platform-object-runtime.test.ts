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
