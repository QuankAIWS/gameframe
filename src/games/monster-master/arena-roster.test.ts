import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryMatchSnapshotStore } from "../../platform/match-store.ts";
import { MonsterMasterMatchService } from "../../server/monster-master-match-service.ts";
import { MONSTER_MASTER_ARENA_MONSTER_CONTENT_IDS, MONSTER_MASTER_ARENA_TRAINER_CONTENT_IDS } from "./arena-roster.ts";
import type { MonsterMasterAction, MonsterMasterState } from "./index.ts";

test("match service owns selected Arena rosters and generates the bot team", async () => {
  const store = new InMemoryMatchSnapshotStore<MonsterMasterState, MonsterMasterAction>();
  const service = new MonsterMasterMatchService({ store });
  await service.createMatch(["alpha", "gameframe-bot"], "arena-roster-authority", undefined, {
    playerId: "alpha",
    roster: {
      trainerContentId: "medic-trainer-v1",
      monsterContentIds: ["rootmaw-brute-v1", "voidshard-reaver-v1", "stormcrest-skitter-v1"],
    },
  });

  const snapshot = await service.snapshot("arena-roster-authority");
  assert.deepEqual(snapshot.state.rosters.alpha.map((unit) => unit.contentId), [
    "medic-trainer-v1",
    "rootmaw-brute-v1",
    "voidshard-reaver-v1",
    "stormcrest-skitter-v1",
  ]);
  const bot = snapshot.state.rosters["gameframe-bot"];
  assert.equal(bot.length, 4);
  assert.ok(MONSTER_MASTER_ARENA_TRAINER_CONTENT_IDS.includes(bot[0].contentId));
  assert.equal(new Set(bot.slice(1).map((unit) => unit.contentId)).size, 3);
  assert.ok(bot.slice(1).every((unit) => MONSTER_MASTER_ARENA_MONSTER_CONTENT_IDS.includes(unit.contentId)));
});

test("match service rejects duplicate or unknown client roster content", async () => {
  const store = new InMemoryMatchSnapshotStore<MonsterMasterState, MonsterMasterAction>();
  const service = new MonsterMasterMatchService({ store });
  await assert.rejects(
    () => service.createMatch(["alpha", "beta"], "invalid-arena-roster", undefined, {
      playerId: "alpha",
      roster: {
        trainerContentId: "caller-trainer-v1",
        monsterContentIds: ["rootmaw-brute-v1", "rootmaw-brute-v1", "not-a-monster"],
      },
    }),
    /exactly three distinct/i,
  );
});
