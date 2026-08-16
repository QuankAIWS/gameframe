import assert from "node:assert/strict";
import test from "node:test";
import { PlayerPlatformThemeRuntime } from "./player-platform-theme-runtime.ts";
import type { PlayerEventTopic } from "./player-event-socket-hub.ts";
import type { DurableStorageLike } from "./runtime-contracts.ts";

class MemoryStorage implements DurableStorageLike {
  readonly values = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> { return this.values.get(key) as T | undefined; }
  async put<T>(key: string, value: T): Promise<void> { this.values.set(key, structuredClone(value)); }
}

function request(path: string, value: unknown): Request {
  return new Request(`https://player.internal${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  });
}

test("committed player writes emit only reconstructable invalidation topics", async () => {
  const notifications: PlayerEventTopic[][] = [];
  const runtime = new PlayerPlatformThemeRuntime(new MemoryStorage(), {
    onUpdated: (topics) => notifications.push([...topics]),
  });

  const preferences = await runtime.fetch(request("/player/preferences", {
    favoriteGameIds: ["cascade"],
    themeId: "cascade-pop",
  }));
  assert.equal(preferences.status, 200);
  assert.deepEqual(notifications, [["preferences", "feed"]]);

  const invitation = await runtime.fetch(request("/player/invitation", {
    invitationId: "invite-events",
    gameId: "othello",
    status: "pending",
    inviter: { playerId: "discord:1", displayName: "Alice", avatarUrl: null },
    claimant: null,
    targetRestricted: true,
    issuedAt: 1000,
    expiresAt: 9999999999,
    matchId: null,
    claimToken: "signed-token",
    updatedAt: 1000,
  }));
  assert.equal(invitation.status, 200);
  assert.deepEqual(notifications.at(-1), ["feed"]);

  const progression = await runtime.fetch(request("/player/progression/cascade", {
    playerId: "discord:1",
    highestCompletedLevel: 3,
    starsByLevel: { "1": 3, "3": 2 },
    updatedAt: 2000,
  }));
  assert.equal(progression.status, 200);
  assert.deepEqual(notifications.at(-1), ["progression"]);
});
