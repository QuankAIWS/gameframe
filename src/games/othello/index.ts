import type { GameDefinition, GameStatus, PlayerId } from "../../platform/contracts.ts";
import {
  applyOthelloMove,
  cloneOthelloState,
  createInitialOthelloState,
  getLegalOthelloMoves,
  scoreOthelloBoard,
  type OthelloPlayer,
  type OthelloState as OthelloRulesState,
} from "./othello.ts";

export type OthelloDisc = 1 | -1;
export type OthelloCell = OthelloDisc | 0;

export interface OthelloAction {
  type: "place";
  row: number;
  column: number;
}

export interface OthelloState {
  rules: OthelloRulesState;
  players: { dark: PlayerId; light: PlayerId };
}

export interface OthelloObservation {
  board: OthelloCell[][];
  yourDisc: OthelloDisc;
  nextDisc: OthelloDisc | null;
  nextPlayerId: PlayerId | null;
  move: number;
  lastMove: [number, number] | null;
  status: GameStatus;
  scores: { dark: number; light: number };
  legalActions: OthelloAction[];
}

function playerIdFor(state: OthelloState, player: OthelloPlayer): PlayerId {
  return state.players[player];
}

function discFor(player: OthelloPlayer): OthelloDisc {
  return player === "dark" ? 1 : -1;
}

function boardForObservation(state: OthelloRulesState): OthelloCell[][] {
  return state.board.map((row) => row.map((cell) => (
    cell === "dark" ? 1 : cell === "light" ? -1 : 0
  )));
}

export const othelloDefinition: GameDefinition<OthelloState, OthelloAction, OthelloObservation> = {
  gameId: "othello",

  createInitialState(playerIds) {
    if (playerIds.length !== 2 || !playerIds[0] || !playerIds[1] || playerIds[0] === playerIds[1]) {
      throw new Error("Othello requires exactly two distinct players.");
    }
    return {
      rules: createInitialOthelloState(),
      players: { dark: playerIds[0], light: playerIds[1] },
    };
  },

  getStatus(state) {
    if (state.rules.status !== "completed") {
      return { lifecycle: "active", winnerPlayerId: null, draw: false };
    }
    if (state.rules.winner === "draw") {
      return { lifecycle: "completed", winnerPlayerId: null, draw: true };
    }
    return {
      lifecycle: "completed",
      winnerPlayerId: state.rules.winner ? playerIdFor(state, state.rules.winner) : null,
      draw: false,
    };
  },

  getActivePlayerId(state) {
    return state.rules.status === "completed"
      ? null
      : playerIdFor(state, state.rules.currentPlayer);
  },

  listLegalActions(state, playerId) {
    if (this.getActivePlayerId(state) !== playerId) return [];
    return getLegalOthelloMoves(state.rules).map(({ row, column }) => ({
      type: "place" as const,
      row,
      column,
    }));
  },

  isSameAction(left, right) {
    return left.type === right.type && left.row === right.row && left.column === right.column;
  },

  applyAction(state, playerId, action) {
    if (this.getActivePlayerId(state) !== playerId) {
      throw new Error("Cannot apply an Othello action for an inactive player.");
    }
    if (!Number.isInteger(action.row) || !Number.isInteger(action.column)) {
      throw new Error("Othello coordinates must be integers.");
    }
    const rules = applyOthelloMove(state.rules, { row: action.row, column: action.column });
    return {
      state: { rules, players: { ...state.players } },
      summary: `${playerId} placed an Othello disc at ${action.row},${action.column}.`,
    };
  },

  getObservation(state, playerId) {
    const yourPlayer: OthelloPlayer = state.players.dark === playerId ? "dark" : "light";
    const scores = scoreOthelloBoard(state.rules.board);
    return {
      board: boardForObservation(state.rules),
      yourDisc: discFor(yourPlayer),
      nextDisc: state.rules.status === "completed" ? null : discFor(state.rules.currentPlayer),
      nextPlayerId: this.getActivePlayerId(state),
      move: state.rules.moveNumber,
      lastMove: state.rules.lastMove
        ? [state.rules.lastMove.row, state.rules.lastMove.column]
        : null,
      status: this.getStatus(state),
      scores,
      legalActions: [...this.listLegalActions(state, playerId)],
    };
  },

  cloneState(state) {
    return {
      rules: cloneOthelloState(state.rules),
      players: { ...state.players },
    };
  },
};
