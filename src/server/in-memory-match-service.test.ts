import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryTicTacToeService } from "./in-memory-match-service.ts";

test("human action is followed by an authoritative Theo action", async () => {
  const service = new InMemoryTicTacToeService();
  const created = await service.createMatch(["human", "theo"]);
  const updated = await service.submitAction({
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

test("human-versus-human matches wait for the second player's action", async () => {
  const service = new InMemoryTicTacToeService();
  const created = await service.createMatch(["alice", "bob"]);

  const afterAlice = await service.submitAction({
    matchId: created.matchId,
    playerId: "alice",
    actionId: "alice-1",
    expectedRevision: 0,
    action: { type: "place", cell: 0 },
  });

  assert.equal(afterAlice.revision, 1);
  assert.equal(afterAlice.eventCount, 1);
  assert.deepEqual(afterAlice.playerIds, ["alice", "bob"]);
  assert.equal(afterAlice.observation.nextPlayerId, "bob");

  const bobView = await service.view(created.matchId, "bob");
  assert.equal(bobView.observation.yourMark, "O");
  assert.ok(bobView.observation.legalActions.some((action) => action.cell === 4));

  const afterBob = await service.submitAction({
    matchId: created.matchId,
    playerId: "bob",
    actionId: "bob-1",
    expectedRevision: 1,
    action: { type: "place", cell: 4 },
  });

  assert.equal(afterBob.revision, 2);
  assert.equal(afterBob.observation.nextPlayerId, "alice");
  assert.equal(afterBob.observation.board[4], "O");
});

test("match creation rejects empty, duplicate, or incomplete player identities", async () => {
  const service = new InMemoryTicTacToeService();

  await assert.rejects(() => service.createMatch(["alice"]), /exactly two distinct/);
  await assert.rejects(() => service.createMatch(["alice", "alice"]), /exactly two distinct/);
  await assert.rejects(() => service.createMatch(["alice", " "]), /exactly two distinct/);
});

test("a match with Theo in the first seat commits his opening move during creation", async () => {
  const service = new InMemoryTicTacToeService();
  const created = await service.createMatch(["theo", "human"]);

  assert.equal(created.revision, 1);
  assert.equal(created.eventCount, 1);
  assert.equal(created.observation.yourMark, "O");
  assert.equal(created.observation.nextPlayerId, "human");
  assert.equal(created.observation.board.filter((cell) => cell === "X").length, 1);
});
