import assert from "node:assert/strict";
import test from "node:test";
import { MatchSession } from "../../platform/match-session.ts";
import {
  DeterministicCheckersPlayer,
  checkersDefinition,
  createCheckersState,
  isPlayableSquare,
  type CheckersPiece,
} from "./index.ts";

const players = ["black-player", "red-player"] as const;
const piece = (
  id: string,
  color: "black" | "red",
  square: number,
  rank: "man" | "king" = "man",
): CheckersPiece => ({ id, color, square, rank });

test("complete capture actions survive authoritative event replay and snapshot restoration", () => {
  const scenario = createCheckersState({
    playerIds: players,
    pieces: [
      piece("black-man", "black", 17),
      piece("red-a", "red", 26),
      piece("red-b", "red", 44),
    ],
  });
  const scenarioDefinition = {
    ...checkersDefinition,
    createInitialState() {
      return checkersDefinition.cloneState(scenario);
    },
  };
  const session = new MatchSession({
    matchId: "checkers-replay",
    definition: scenarioDefinition,
    playerIds: players,
    now: () => new Date("2026-07-29T00:00:00.000Z"),
  });
  const action = session.observe(players[0]).legalActions[0];
  const result = session.submit({
    actionId: "checkers-action-1",
    playerId: players[0],
    expectedRevision: 0,
    action,
  });
  assert.equal(result.accepted, true);
  assert.deepEqual(session.replay(), session.snapshot().state);
  assert.deepEqual(session.snapshot().events[0].action, action);

  const restored = new MatchSession({
    matchId: "checkers-replay",
    definition: scenarioDefinition,
    playerIds: players,
    snapshot: session.snapshot(),
  });
  assert.deepEqual(restored.snapshot().state, session.snapshot().state);
  assert.equal(restored.revision, 1);
});

test("legal-action generation is deterministic and does not mutate state during representative play", async () => {
  const black = new DeterministicCheckersPlayer("black-player");
  const red = new DeterministicCheckersPlayer("red-player");
  let current = checkersDefinition.createInitialState(players);
  for (let ply = 0; ply < 60 && checkersDefinition.getStatus(current).lifecycle === "active"; ply += 1) {
    const before = checkersDefinition.cloneState(current);
    const playerId = checkersDefinition.getActivePlayerId(current)!;
    const first = checkersDefinition.listLegalActions(current, playerId);
    const second = checkersDefinition.listLegalActions(current, playerId);
    assert.deepEqual(first, second);
    assert.deepEqual(current, before);
    assert.ok(first.length > 0);
    for (const action of first) {
      assert.ok(action.path.length > 0);
      assert.ok(action.path.every(isPlayableSquare));
      assert.equal(new Set(action.capturedPieceIds).size, action.capturedPieceIds.length);
    }
    const observation = checkersDefinition.getObservation(current, playerId);
    const action = await (playerId === players[0] ? black : red).chooseAction({
      observation,
      legalActions: observation.legalActions,
    });
    current = checkersDefinition.applyAction(current, playerId, action).state;
  }
});
