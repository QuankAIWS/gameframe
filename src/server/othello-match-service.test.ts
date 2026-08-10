import assert from "node:assert/strict";
import test from "node:test";
import type { OthelloAction, OthelloState } from "../games/othello/index.ts";
import { InMemoryMatchSnapshotStore } from "../platform/match-store.ts";
import { OthelloMatchService } from "./othello-match-service.ts";

function service() {
  return new OthelloMatchService({
    store: new InMemoryMatchSnapshotStore<OthelloState, OthelloAction>(),
  });
}

test("authoritative Othello service persists alternating human turns", async () => {
  const matches = service();
  const created = await matches.createMatch(["alice", "bob"], "othello-human");
  assert.equal(created.revision, 0);
  assert.equal(created.observation.yourDisc, 1);
  assert.equal(created.observation.nextPlayerId, "alice");
  assert.equal(created.observation.legalActions.length, 4);

  const afterAlice = await matches.submitAction({
    matchId: created.matchId,
    playerId: "alice",
    actionId: "alice-1",
    expectedRevision: 0,
    action: created.observation.legalActions[0],
  });
  assert.equal(afterAlice.revision, 1);
  assert.equal(afterAlice.observation.nextPlayerId, "bob");
  assert.equal(afterAlice.observation.scores.dark, 4);
  assert.equal(afterAlice.observation.scores.light, 1);

  const bob = await matches.view(created.matchId, "bob");
  assert.equal(bob.observation.yourDisc, -1);
  assert.ok(bob.observation.legalActions.length > 0);
  assert.deepEqual(await matches.replay(created.matchId), (await matches.snapshot(created.matchId)).state);
});

test("Othello service rejects a stale asynchronous move", async () => {
  const matches = service();
  const created = await matches.createMatch(["alice", "bob"], "othello-stale");
  await assert.rejects(
    matches.submitAction({
      matchId: created.matchId,
      playerId: "alice",
      actionId: "alice-stale",
      expectedRevision: 99,
      action: created.observation.legalActions[0],
    }),
    (error: Error & { code?: string; revision?: number }) => {
      assert.equal(error.code, "stale_revision");
      assert.equal(error.revision, 0);
      return true;
    },
  );
});
