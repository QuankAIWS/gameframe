import type { GameDefinition, GameStatus, PlayerId } from "../../platform/contracts.ts";

export type OthelloDisc = 1 | -1;
export type OthelloCell = OthelloDisc | 0;

export interface OthelloAction {
  type: "place";
  row: number;
  column: number;
}

export interface OthelloState {
  board: OthelloCell[][];
  players: { dark: PlayerId; light: PlayerId };
  nextDisc: OthelloDisc;
  move: number;
  complete: boolean;
  lastMove: [number, number] | null;
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

const SIZE = 8;
const DIRECTIONS = [-1, 0, 1]
  .flatMap((dr) => [-1, 0, 1].map((dc) => [dr, dc] as const))
  .filter(([dr, dc]) => dr !== 0 || dc !== 0);

function inside(row: number, column: number): boolean {
  return row >= 0 && row < SIZE && column >= 0 && column < SIZE;
}

function createBoard(): OthelloCell[][] {
  const board = Array.from({ length: SIZE }, () => Array<OthelloCell>(SIZE).fill(0));
  board[3][3] = -1;
  board[3][4] = 1;
  board[4][3] = 1;
  board[4][4] = -1;
  return board;
}

function flipsFor(board: readonly (readonly OthelloCell[])[], disc: OthelloDisc, row: number, column: number): [number, number][] {
  if (!inside(row, column) || board[row][column] !== 0) return [];
  const flips: [number, number][] = [];
  for (const [dr, dc] of DIRECTIONS) {
    const line: [number, number][] = [];
    let currentRow = row + dr;
    let currentColumn = column + dc;
    while (inside(currentRow, currentColumn) && board[currentRow][currentColumn] === -disc) {
      line.push([currentRow, currentColumn]);
      currentRow += dr;
      currentColumn += dc;
    }
    if (line.length > 0 && inside(currentRow, currentColumn) && board[currentRow][currentColumn] === disc) {
      flips.push(...line);
    }
  }
  return flips;
}

function legalActions(board: OthelloCell[][], disc: OthelloDisc): OthelloAction[] {
  const result: OthelloAction[] = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let column = 0; column < SIZE; column += 1) {
      if (flipsFor(board, disc, row, column).length > 0) result.push({ type: "place", row, column });
    }
  }
  return result;
}

function score(board: readonly (readonly OthelloCell[])[]): { dark: number; light: number } {
  let dark = 0;
  let light = 0;
  for (const cell of board.flat()) {
    if (cell === 1) dark += 1;
    if (cell === -1) light += 1;
  }
  return { dark, light };
}

function playerFor(state: OthelloState, disc: OthelloDisc): PlayerId {
  return disc === 1 ? state.players.dark : state.players.light;
}

export const othelloDefinition: GameDefinition<OthelloState, OthelloAction, OthelloObservation> = {
  gameId: "othello",
  createInitialState(playerIds) {
    if (playerIds.length !== 2 || !playerIds[0] || !playerIds[1] || playerIds[0] === playerIds[1]) {
      throw new Error("Othello requires exactly two distinct players.");
    }
    return { board: createBoard(), players: { dark: playerIds[0], light: playerIds[1] }, nextDisc: 1, move: 0, complete: false, lastMove: null };
  },
  getStatus(state) {
    if (!state.complete) return { lifecycle: "active", winnerPlayerId: null, draw: false };
    const scores = score(state.board);
    if (scores.dark === scores.light) return { lifecycle: "completed", winnerPlayerId: null, draw: true };
    return { lifecycle: "completed", winnerPlayerId: scores.dark > scores.light ? state.players.dark : state.players.light, draw: false };
  },
  getActivePlayerId(state) {
    return state.complete ? null : playerFor(state, state.nextDisc);
  },
  listLegalActions(state, playerId) {
    if (this.getActivePlayerId(state) !== playerId) return [];
    return legalActions(state.board, state.nextDisc);
  },
  isSameAction(left, right) {
    return left.type === right.type && left.row === right.row && left.column === right.column;
  },
  applyAction(state, playerId, action) {
    if (this.getActivePlayerId(state) !== playerId) throw new Error("Cannot apply an Othello action for an inactive player.");
    if (!Number.isInteger(action.row) || !Number.isInteger(action.column)) throw new Error("Othello coordinates must be integers.");
    const flips = flipsFor(state.board, state.nextDisc, action.row, action.column);
    if (flips.length === 0) throw new Error("That Othello move is not legal.");
    const board = state.board.map((row) => [...row]);
    const playedDisc = state.nextDisc;
    board[action.row][action.column] = playedDisc;
    for (const [row, column] of flips) board[row][column] = playedDisc;
    let nextDisc = (playedDisc === 1 ? -1 : 1) as OthelloDisc;
    let complete = false;
    if (legalActions(board, nextDisc).length === 0) {
      nextDisc = playedDisc;
      if (legalActions(board, nextDisc).length === 0) complete = true;
    }
    return {
      state: { board, players: { ...state.players }, nextDisc, move: state.move + 1, complete, lastMove: [action.row, action.column] },
      summary: `${playerId} placed an Othello disc at ${action.row},${action.column}.`,
    };
  },
  getObservation(state, playerId) {
    const yourDisc: OthelloDisc = state.players.dark === playerId ? 1 : -1;
    return {
      board: state.board.map((row) => [...row]),
      yourDisc,
      nextDisc: state.complete ? null : state.nextDisc,
      nextPlayerId: this.getActivePlayerId(state),
      move: state.move,
      lastMove: state.lastMove ? [...state.lastMove] as [number, number] : null,
      status: this.getStatus(state),
      scores: score(state.board),
      legalActions: [...this.listLegalActions(state, playerId)],
    };
  },
  cloneState(state) {
    return {
      board: state.board.map((row) => [...row]),
      players: { ...state.players },
      nextDisc: state.nextDisc,
      move: state.move,
      complete: state.complete,
      lastMove: state.lastMove ? [...state.lastMove] as [number, number] : null,
    };
  },
};
