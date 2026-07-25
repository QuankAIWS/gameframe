import assert from "node:assert/strict";
import test from "node:test";
import { ticTacToeDefinition } from "../games/tic-tac-toe/index.ts";
import { MatchSession } from "./match-session.ts";

function createSession() {
  return new MatchSession({
    matchId: "match-1",
    definition: ticTacToeDefinition,
    playerIds: ["a", "b"],
    now: () => new Date("2026-07-25T12:00:00.000Z"),
  });
}

test("match session rejects stale and out-of-turn actions", () => {
  const session = createSession();
  const outOfTurn = session.submit({
    actionId: "b-1", playerId: "b", expectedRevision: 0, action: { type: "place", cell: 0 },
  });
  assert.equal(outOfTurn.accepted, false);
  if (!outOfTurn.accepted) assert.equal(outOfTurn.code, "not_your_turn");

  const accepted = session.submit({
    actionId: "a-1", playerId: "a", expectedRevision: 0, action: { type: "place", cell: 0 },
  });
  assert.equal(accepted.accepted, true);

  const stale = session.submit({
    actionId: "b-2", playerId: "b", expectedRevision: 0, action: { type: "place", cell: 1 },
  });
  assert.equal(stale.accepted, false);
  if (!stale.accepted) assert.equal(stale.code, "stale_revision");
});

test("accepted action IDs are idempotent", () => {
  const session = createSession();
  const envelope = {
    actionId: "a-1", playerId: "a", expectedRevision: 0, action: { type: "place" as const, cell: 0 },
  };
  const first = session.submit(envelope);
  const duplicate = session.submit(envelope);
  assert.equal(first.accepted, true);
  assert.equal(duplicate.accepted, true);
  if (duplicate.accepted) assert.equal(duplicate.duplicate, true);
  assert.equal(session.revision, 1);
  assert.equal(session.snapshot().events.length, 1);
});

test("event replay reconstructs authoritative state", () => {
  const session = createSession();
  session.submit({ actionId: "1", playerId: "a", expectedRevision: 0, action: { type: "place", cell: 0 } });
  session.submit({ actionId: "2", playerId: "b", expectedRevision: 1, action: { type: "place", cell: 4 } });
  session.submit({ actionId: "3", playerId: "a", expectedRevision: 2, action: { type: "place", cell: 1 } });
  assert.deepEqual(session.replay(), session.snapshot().state);
});
