import type { AgentPlayer } from "../../agents/agent-player.ts";
import type { GameDefinition, GameStatus, PlayerId } from "../../platform/contracts.ts";

export type TicTacToeMark = "X" | "O";
export type TicTacToeCell = TicTacToeMark | null;

export interface TicTacToeAction {
  type: "place";
  cell: number;
}

export interface TicTacToeState {
  board: TicTacToeCell[];
  players: Record<TicTacToeMark, PlayerId>;
  nextMark: TicTacToeMark;
  winnerMark: TicTacToeMark | null;
  draw: boolean;
}

export interface TicTacToeObservation {
  board: TicTacToeCell[];
  yourMark: TicTacToeMark;
  nextPlayerId: PlayerId | null;
  status: GameStatus;
  legalActions: TicTacToeAction[];
}

const WINNING_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

function winner(board: readonly TicTacToeCell[]): TicTacToeMark | null {
  for (const [a, b, c] of WINNING_LINES) {
    const mark = board[a];
    if (mark && mark === board[b] && mark === board[c]) {
      return mark;
    }
  }
  return null;
}

export const ticTacToeDefinition: GameDefinition<
  TicTacToeState,
  TicTacToeAction,
  TicTacToeObservation
> = {
  gameId: "tic-tac-toe",

  createInitialState(playerIds) {
    if (playerIds.length !== 2 || playerIds[0] === playerIds[1]) {
      throw new Error("Tic-tac-toe requires exactly two distinct players.");
    }
    return {
      board: Array<TicTacToeCell>(9).fill(null),
      players: { X: playerIds[0], O: playerIds[1] },
      nextMark: "X",
      winnerMark: null,
      draw: false,
    };
  },

  getStatus(state) {
    if (state.winnerMark) {
      return {
        lifecycle: "completed",
        winnerPlayerId: state.players[state.winnerMark],
        draw: false,
      };
    }
    if (state.draw) {
      return { lifecycle: "completed", winnerPlayerId: null, draw: true };
    }
    return { lifecycle: "active", winnerPlayerId: null, draw: false };
  },

  getActivePlayerId(state) {
    if (state.winnerMark || state.draw) {
      return null;
    }
    return state.players[state.nextMark];
  },

  listLegalActions(state, playerId) {
    if (this.getActivePlayerId(state) !== playerId) {
      return [];
    }
    return state.board
      .map((cell, index) => (cell === null ? { type: "place" as const, cell: index } : null))
      .filter((action): action is TicTacToeAction => action !== null);
  },

  isSameAction(left, right) {
    return left.type === right.type && left.cell === right.cell;
  },

  applyAction(state, playerId, action) {
    const activePlayerId = this.getActivePlayerId(state);
    if (activePlayerId !== playerId) {
      throw new Error("Cannot apply an action for an inactive player.");
    }
    if (!Number.isInteger(action.cell) || action.cell < 0 || action.cell > 8) {
      throw new Error("Cell must be an integer from 0 through 8.");
    }
    if (state.board[action.cell] !== null) {
      throw new Error("Cell is already occupied.");
    }

    const board = [...state.board];
    board[action.cell] = state.nextMark;
    const winnerMark = winner(board);
    const draw = winnerMark === null && board.every((cell) => cell !== null);
    const playedMark = state.nextMark;
    const nextMark: TicTacToeMark = playedMark === "X" ? "O" : "X";

    return {
      state: {
        board,
        players: { ...state.players },
        nextMark,
        winnerMark,
        draw,
      },
      summary: `${playerId} placed ${playedMark} in cell ${action.cell}.`,
    };
  },

  getObservation(state, playerId) {
    const yourMark = state.players.X === playerId ? "X" : "O";
    return {
      board: [...state.board],
      yourMark,
      nextPlayerId: this.getActivePlayerId(state),
      status: this.getStatus(state),
      legalActions: [...this.listLegalActions(state, playerId)],
    };
  },

  cloneState(state) {
    return {
      board: [...state.board],
      players: { ...state.players },
      nextMark: state.nextMark,
      winnerMark: state.winnerMark,
      draw: state.draw,
    };
  },
};

const MOVE_PRIORITY = [4, 0, 2, 6, 8, 1, 3, 5, 7] as const;

function minimax(state: TicTacToeState, maximizingMark: TicTacToeMark): number {
  if (state.winnerMark === maximizingMark) return 10;
  if (state.winnerMark) return -10;
  if (state.draw) return 0;

  const activePlayerId = ticTacToeDefinition.getActivePlayerId(state);
  if (!activePlayerId) return 0;
  const activeMark = state.players.X === activePlayerId ? "X" : "O";
  const scores = ticTacToeDefinition
    .listLegalActions(state, activePlayerId)
    .map((action) => minimax(ticTacToeDefinition.applyAction(state, activePlayerId, action).state, maximizingMark));

  return activeMark === maximizingMark ? Math.max(...scores) : Math.min(...scores);
}

export class PerfectTicTacToePlayer
  implements AgentPlayer<TicTacToeAction, TicTacToeObservation>
{
  readonly agentId: string;

  constructor(agentId = "theo") {
    this.agentId = agentId;
  }

  async chooseAction({ observation, legalActions }: { observation: TicTacToeObservation; legalActions: readonly TicTacToeAction[] }): Promise<TicTacToeAction> {
    if (observation.nextPlayerId !== this.agentId || legalActions.length === 0) {
      throw new Error("The agent cannot act in the supplied observation.");
    }

    const players: Record<TicTacToeMark, PlayerId> = observation.yourMark === "X"
      ? { X: this.agentId, O: "opponent" }
      : { X: "opponent", O: this.agentId };
    const state: TicTacToeState = {
      board: [...observation.board],
      players,
      nextMark: observation.yourMark,
      winnerMark: null,
      draw: false,
    };

    let bestAction: TicTacToeAction | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const cell of MOVE_PRIORITY) {
      const action = legalActions.find((candidate) => candidate.cell === cell);
      if (!action) continue;
      const next = ticTacToeDefinition.applyAction(state, this.agentId, action).state;
      const score = minimax(next, observation.yourMark);
      if (score > bestScore) {
        bestScore = score;
        bestAction = action;
      }
    }

    if (!bestAction) {
      throw new Error("No legal action was selected.");
    }
    return bestAction;
  }
}
