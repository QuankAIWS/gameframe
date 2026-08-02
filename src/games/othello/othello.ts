export const OTHELLO_SIZE = 8;

export type OthelloPlayer = "dark" | "light";
export type OthelloCell = OthelloPlayer | null;
export type OthelloBoard = OthelloCell[][];

export interface OthelloPosition {
  row: number;
  column: number;
}

export interface OthelloMove extends OthelloPosition {
  flips: OthelloPosition[];
}

export interface OthelloState {
  board: OthelloBoard;
  currentPlayer: OthelloPlayer;
  consecutivePasses: number;
  moveNumber: number;
  status: "active" | "completed";
  winner: OthelloPlayer | "draw" | null;
  lastMove: OthelloPosition | null;
}

const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],            [0, 1],
  [1, -1],  [1, 0],   [1, 1],
] as const;

export function opponent(player: OthelloPlayer): OthelloPlayer {
  return player === "dark" ? "light" : "dark";
}

function isInside(row: number, column: number): boolean {
  return row >= 0 && row < OTHELLO_SIZE && column >= 0 && column < OTHELLO_SIZE;
}

export function createInitialOthelloState(): OthelloState {
  const board = Array.from({ length: OTHELLO_SIZE }, () =>
    Array<OthelloCell>(OTHELLO_SIZE).fill(null),
  );
  board[3][3] = "light";
  board[3][4] = "dark";
  board[4][3] = "dark";
  board[4][4] = "light";
  return {
    board,
    currentPlayer: "dark",
    consecutivePasses: 0,
    moveNumber: 0,
    status: "active",
    winner: null,
    lastMove: null,
  };
}

export function cloneOthelloState(state: OthelloState): OthelloState {
  return {
    ...state,
    board: state.board.map((row) => [...row]),
    lastMove: state.lastMove ? { ...state.lastMove } : null,
  };
}

export function flipsForMove(
  board: OthelloBoard,
  player: OthelloPlayer,
  row: number,
  column: number,
): OthelloPosition[] {
  if (!isInside(row, column) || board[row][column] !== null) return [];
  const enemy = opponent(player);
  const flips: OthelloPosition[] = [];

  for (const [rowStep, columnStep] of DIRECTIONS) {
    const line: OthelloPosition[] = [];
    let scanRow = row + rowStep;
    let scanColumn = column + columnStep;

    while (isInside(scanRow, scanColumn) && board[scanRow][scanColumn] === enemy) {
      line.push({ row: scanRow, column: scanColumn });
      scanRow += rowStep;
      scanColumn += columnStep;
    }

    if (
      line.length > 0
      && isInside(scanRow, scanColumn)
      && board[scanRow][scanColumn] === player
    ) {
      flips.push(...line);
    }
  }

  return flips;
}

export function getLegalOthelloMoves(
  state: Pick<OthelloState, "board" | "currentPlayer" | "status">,
): OthelloMove[] {
  if (state.status !== "active") return [];
  const moves: OthelloMove[] = [];
  for (let row = 0; row < OTHELLO_SIZE; row += 1) {
    for (let column = 0; column < OTHELLO_SIZE; column += 1) {
      const flips = flipsForMove(state.board, state.currentPlayer, row, column);
      if (flips.length > 0) moves.push({ row, column, flips });
    }
  }
  return moves;
}

export function scoreOthelloBoard(board: OthelloBoard): Record<OthelloPlayer, number> {
  let dark = 0;
  let light = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell === "dark") dark += 1;
      if (cell === "light") light += 1;
    }
  }
  return { dark, light };
}

function completeState(state: OthelloState): OthelloState {
  const score = scoreOthelloBoard(state.board);
  return {
    ...state,
    status: "completed",
    winner: score.dark === score.light ? "draw" : score.dark > score.light ? "dark" : "light",
  };
}

export function applyOthelloMove(
  state: OthelloState,
  position: OthelloPosition,
): OthelloState {
  if (state.status !== "active") throw new Error("The Othello match is already complete.");
  const flips = flipsForMove(state.board, state.currentPlayer, position.row, position.column);
  if (flips.length === 0) throw new Error("Illegal Othello move.");

  const next = cloneOthelloState(state);
  next.board[position.row][position.column] = state.currentPlayer;
  for (const flip of flips) next.board[flip.row][flip.column] = state.currentPlayer;
  next.moveNumber += 1;
  next.lastMove = { ...position };
  next.currentPlayer = opponent(state.currentPlayer);
  next.consecutivePasses = 0;

  if (getLegalOthelloMoves(next).length > 0) return next;

  next.currentPlayer = state.currentPlayer;
  next.consecutivePasses = 1;
  if (getLegalOthelloMoves(next).length > 0) return next;

  next.consecutivePasses = 2;
  return completeState(next);
}

export function chooseDeterministicOthelloMove(state: OthelloState): OthelloMove | null {
  const moves = getLegalOthelloMoves(state);
  if (moves.length === 0) return null;
  const positional = [
    [120, -35, 18, 10, 10, 18, -35, 120],
    [-35, -55, -8, -5, -5, -8, -55, -35],
    [18, -8, 12, 4, 4, 12, -8, 18],
    [10, -5, 4, 2, 2, 4, -5, 10],
    [10, -5, 4, 2, 2, 4, -5, 10],
    [18, -8, 12, 4, 4, 12, -8, 18],
    [-35, -55, -8, -5, -5, -8, -55, -35],
    [120, -35, 18, 10, 10, 18, -35, 120],
  ];

  return [...moves].sort((left, right) => {
    const leftScore = positional[left.row][left.column] + left.flips.length * 3;
    const rightScore = positional[right.row][right.column] + right.flips.length * 3;
    return rightScore - leftScore || left.row - right.row || left.column - right.column;
  })[0];
}
