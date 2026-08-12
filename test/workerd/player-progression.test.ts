import { describe, expect, it } from "vitest";
import {
  GAMER_XP_RULES,
  applyCascadeProgression,
  applyCompletedMatch,
  applyScoredProgression,
  emptyPlayerProgression,
  gamerLevelSummary,
  xpRequiredForLevel,
} from "../../src/cloudflare/player-progression.ts";
import { PlayerPlatformObjectRuntime } from "../../src/cloudflare/player-platform-object-runtime.ts";
import type { DurableStorageLike } from "../../src/cloudflare/runtime-contracts.ts";

class MemoryStorage implements DurableStorageLike {
  readonly values = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return structuredClone(this.values.get(key)) as T | undefined;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.values.set(key, structuredClone(value));
  }
}

function jsonRequest(path: string, body: Record<string, unknown>): Request {
  return new Request(`https://player.internal${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Gamer Level progression", () => {
  it("uses a nonlinear level curve with a fast first level", () => {
    expect(xpRequiredForLevel(1)).toBe(0);
    expect(xpRequiredForLevel(2)).toBe(100);
    expect(xpRequiredForLevel(10)).toBeGreaterThan(xpRequiredForLevel(9));
    expect(gamerLevelSummary(0).gamerLevel).toBe(1);
    expect(gamerLevelSummary(100).gamerLevel).toBe(2);
  });

  it("awards shared-match activity and win XP into lifetime game records", () => {
    const base = emptyPlayerProgression("player-a", 1_000);
    const next = applyCompletedMatch(base, {
      playerId: "player-a",
      gameId: "othello",
      winnerPlayerId: "player-a",
      draw: false,
      updatedAt: 2_000,
    });
    expect(next.gamerXp).toBe(GAMER_XP_RULES.completedMatch + GAMER_XP_RULES.wonMatch);
    expect(next.games.othello).toEqual({ played: 1, wins: 1, losses: 0, draws: 0 });
    expect(next.xpUpdatedAt).toBe(2_000);
  });

  it("merges Cascade progress monotonically and awards only new clears and best stars", () => {
    const base = emptyPlayerProgression("mom", 1_000);
    const imported = applyCascadeProgression(base, {
      highestCompletedLevel: 10,
      starsByLevel: { "1": 3, "2": 2, "3": 1 },
      updatedAt: 2_000,
    });
    expect(imported.gamerXp).toBe(10 * GAMER_XP_RULES.cascadeLevelClear + 6 * GAMER_XP_RULES.cascadeBestStar);
    expect(imported.cascade.highestCompletedLevel).toBe(10);
    expect(imported.cascade.totalBestStars).toBe(6);

    const duplicate = applyCascadeProgression(imported, {
      highestCompletedLevel: 10,
      starsByLevel: { "1": 3, "2": 2, "3": 1 },
      updatedAt: 3_000,
    });
    expect(duplicate.gamerXp).toBe(imported.gamerXp);
    expect(duplicate.xpUpdatedAt).toBe(imported.xpUpdatedAt);

    const improved = applyCascadeProgression(duplicate, {
      highestCompletedLevel: 11,
      starsByLevel: { "2": 3 },
      updatedAt: 4_000,
    });
    expect(improved.gamerXp - duplicate.gamerXp).toBe(
      GAMER_XP_RULES.cascadeLevelClear + GAMER_XP_RULES.cascadeBestStar,
    );
    expect(improved.cascade.highestCompletedLevel).toBe(11);
    expect(improved.cascade.totalBestStars).toBe(7);
  });

  it("awards Weekly Blitz participation once while still tracking later personal bests", () => {
    const base = emptyPlayerProgression("player-a", 1_000);
    const first = applyScoredProgression(base, {
      gameId: "cascade",
      modeId: "weekly-blitz",
      score: 12_000,
      firstParticipation: true,
      updatedAt: 2_000,
    });
    expect(first.gamerXp).toBe(GAMER_XP_RULES.weeklyBlitzParticipation);
    expect(first.cascade.weeklyBlitzEntries).toBe(1);
    expect(first.cascade.weeklyBlitzBestScore).toBe(12_000);

    const improved = applyScoredProgression(first, {
      gameId: "cascade",
      modeId: "weekly-blitz",
      score: 15_500,
      firstParticipation: false,
      updatedAt: 3_000,
    });
    expect(improved.gamerXp).toBe(first.gamerXp);
    expect(improved.xpUpdatedAt).toBe(first.xpUpdatedAt);
    expect(improved.cascade.weeklyBlitzEntries).toBe(1);
    expect(improved.cascade.weeklyBlitzBestScore).toBe(15_500);
  });

  it("does not pay a completed match twice when the same match is re-indexed", async () => {
    const runtime = new PlayerPlatformObjectRuntime(new MemoryStorage());
    const body = {
      playerId: "player-a",
      matchId: "match-1",
      gameId: "othello",
      playerIds: ["player-a", "player-b"],
      revision: 55,
      activePlayerId: null,
      status: { lifecycle: "completed", winnerPlayerId: "player-a", draw: false },
      updatedAt: 10_000,
      resumePath: "/othello.html?match=match-1",
    };

    const firstResponse = await runtime.fetch(jsonRequest("/player/progression/match", body));
    expect(firstResponse.status).toBe(200);
    const first = await firstResponse.json() as { awarded: boolean; progression: { gamerXp: number; games: Record<string, unknown> } };
    expect(first.awarded).toBe(true);
    expect(first.progression.gamerXp).toBe(100);

    const secondResponse = await runtime.fetch(jsonRequest("/player/progression/match", body));
    expect(secondResponse.status).toBe(200);
    const second = await secondResponse.json() as { awarded: boolean; progression: { gamerXp: number; games: Record<string, { played: number }> } };
    expect(second.awarded).toBe(false);
    expect(second.progression.gamerXp).toBe(100);
    expect(second.progression.games.othello.played).toBe(1);
  });
});
