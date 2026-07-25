import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryTicTacToeService } from "./in-memory-match-service.ts";

test("human action is followed by an authoritative Theo action", async () => {
  const service = new InMemoryTicTacToeService();
  const created = await service.createHumanVsTheo("human");
  const updated = await service.submitHumanAction({
    matchId: created.matchId,
    playerId: "human",
    actionId: "human-1",
    expectedRevision: 0,
    action: { type: "place", cell: 0 },
  });

  assert.equal(updated.revision, 2);
  assert.equal(updated.eventCount, 2);
  assert.equal(updated.observation.board[0], "X");
  assert.equal(updated.observation.board[4], "O");
  assert.deepEqual(await service.replay(created.matchId), (await service.snapshot(created.matchId)).state);
});
