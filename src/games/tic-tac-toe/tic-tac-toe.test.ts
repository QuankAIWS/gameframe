import assert from "node:assert/strict";
import test from "node:test";
import { PerfectTicTacToePlayer, ticTacToeDefinition, type TicTacToeState } from "./index.ts";

test("tic-tac-toe identifies a row win", () => {
  let state = ticTacToeDefinition.createInitialState(["a", "b"]);
  for (const [playerId, cell] of [["a", 0], ["b", 3], ["a", 1], ["b", 4], ["a", 2]] as const) {
    state = ticTacToeDefinition.applyAction(state, playerId, { type: "place", cell }).state;
  }
  assert.deepEqual(ticTacToeDefinition.getStatus(state), {
    lifecycle: "completed",
    winnerPlayerId: "a",
    draw: false,
  });
});

test("legal actions expose only empty cells to the active player", () => {
  let state = ticTacToeDefinition.createInitialState(["a", "b"]);
  state = ticTacToeDefinition.applyAction(state, "a", { type: "place", cell: 4 }).state;
  assert.equal(ticTacToeDefinition.listLegalActions(state, "a").length, 0);
  assert.equal(ticTacToeDefinition.listLegalActions(state, "b").length, 8);
  assert.equal(ticTacToeDefinition.listLegalActions(state, "b").some((action) => action.cell === 4), false);
});

test("perfect Scribbles player cannot lose as O against any sequence of legal human moves", async () => {
  const scribblesPlayer = new PerfectTicTacToePlayer("scribbles");

  async function explore(state: TicTacToeState): Promise<void> {
    const status = ticTacToeDefinition.getStatus(state);
    assert.notEqual(status.winnerPlayerId, "human");
    if (status.lifecycle === "completed") return;

    const active = ticTacToeDefinition.getActivePlayerId(state);
    if (active === "scribbles") {
      const observation = ticTacToeDefinition.getObservation(state, "scribbles");
      const action = await scribblesPlayer.chooseAction({
        observation,
        legalActions: observation.legalActions,
      });
      await explore(ticTacToeDefinition.applyAction(state, "scribbles", action).state);
      return;
    }

    for (const action of ticTacToeDefinition.listLegalActions(state, "human")) {
      await explore(ticTacToeDefinition.applyAction(state, "human", action).state);
    }
  }

  await explore(ticTacToeDefinition.createInitialState(["human", "scribbles"]));
});
