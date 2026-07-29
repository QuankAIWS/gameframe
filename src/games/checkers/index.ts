import type { AgentPlayer } from "../../agents/agent-player.ts";
import type { GameDefinition, GameStatus, PlayerId } from "../../platform/contracts.ts";

export type CheckersColor = "black" | "red";
export type CheckersRank = "man" | "king";

export interface CheckersPiece {
  id: string;
  color: CheckersColor;
  rank: CheckersRank;
  square: number;
}

export interface CheckersAction {
  type: "move";
  pieceId: string;
  from: number;
  path: number[];
  capturedPieceIds: string[];
}

export interface CheckersState {
  pieces: CheckersPiece[];
  players: Record<CheckersColor, PlayerId>;
  activeColor: CheckersColor;
  winnerColor: CheckersColor | null;
  draw: boolean;
  noProgressPly: number;
  positionCounts: Record<string, number>;
}

export interface CheckersPieceView {
  id: string;
  color: CheckersColor;
  rank: CheckersRank;
}

export interface CheckersObservation {
  board: Array<CheckersPieceView | null>;
  yourColor: CheckersColor;
  activePlayerId: PlayerId | null;
  status: GameStatus;
  legalActions: CheckersAction[];
  mustCapture: boolean;
  noProgressPly: number;
}

export const CHECKERS_BOARD_SIZE = 8;
export const CHECKERS_NO_PROGRESS_PLY_LIMIT = 80;

const DIRECTIONS: Record<CheckersColor, readonly (readonly [number, number])[]> = {
  black: [[1, -1], [1, 1]],
  red: [[-1, -1], [-1, 1]],
};
const KING_DIRECTIONS = [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const;

function otherColor(color: CheckersColor): CheckersColor {
  return color === "black" ? "red" : "black";
}

export function rowOf(square: number): number {
  return Math.floor(square / CHECKERS_BOARD_SIZE);
}

export function columnOf(square: number): number {
  return square % CHECKERS_BOARD_SIZE;
}

export function squareAt(row: number, column: number): number | null {
  if (row < 0 || row >= CHECKERS_BOARD_SIZE || column < 0 || column >= CHECKERS_BOARD_SIZE) {
    return null;
  }
  return row * CHECKERS_BOARD_SIZE + column;
}

export function isPlayableSquare(square: number): boolean {
  if (!Number.isInteger(square) || square < 0 || square >= CHECKERS_BOARD_SIZE ** 2) return false;
  return (rowOf(square) + columnOf(square)) % 2 === 1;
}

function isPromotionSquare(color: CheckersColor, square: number): boolean {
  return color === "black" ? rowOf(square) === 7 : rowOf(square) === 0;
}

function directionsFor(piece: CheckersPiece): readonly (readonly [number, number])[] {
  return piece.rank === "king" ? KING_DIRECTIONS : DIRECTIONS[piece.color];
}

function clonePieces(pieces: readonly CheckersPiece[]): CheckersPiece[] {
  return pieces.map((piece) => ({ ...piece }));
}

function actionSortKey(action: CheckersAction): string {
  return [
    action.from.toString().padStart(2, "0"),
    action.path.map((square) => square.toString().padStart(2, "0")).join("-"),
    action.pieceId,
  ].join(":");
}

function sortActions(actions: CheckersAction[]): CheckersAction[] {
  return actions.sort((left, right) => actionSortKey(left).localeCompare(actionSortKey(right)));
}

export function checkersPositionKey(state: Pick<CheckersState, "pieces" | "activeColor">): string {
  const pieces = [...state.pieces]
    .sort((left, right) => left.square - right.square || left.id.localeCompare(right.id))
    .map((piece) => `${piece.square}:${piece.color[0]}:${piece.rank[0]}`)
    .join("|");
  return `${state.activeColor};${pieces}`;
}

export function createCheckersState(input: {
  playerIds: readonly [PlayerId, PlayerId];
  pieces: readonly CheckersPiece[];
  activeColor?: CheckersColor;
  winnerColor?: CheckersColor | null;
  draw?: boolean;
  noProgressPly?: number;
  positionCounts?: Readonly<Record<string, number>>;
}): CheckersState {
  const [blackPlayerId, redPlayerId] = input.playerIds.map((playerId) => playerId.trim()) as [string, string];
  if (!blackPlayerId || !redPlayerId || blackPlayerId === redPlayerId) {
    throw new Error("Checkers requires exactly two distinct player IDs.");
  }

  const pieces = clonePieces(input.pieces);
  const ids = new Set<string>();
  const squares = new Set<number>();
  for (const piece of pieces) {
    if (!piece.id.trim() || ids.has(piece.id)) throw new Error("Checkers piece IDs must be non-empty and unique.");
    if (!isPlayableSquare(piece.square) || squares.has(piece.square)) {
      throw new Error("Checkers pieces must occupy unique playable squares.");
    }
    ids.add(piece.id);
    squares.add(piece.square);
  }

  const state: CheckersState = {
    pieces,
    players: { black: blackPlayerId, red: redPlayerId },
    activeColor: input.activeColor ?? "black",
    winnerColor: input.winnerColor ?? null,
    draw: input.draw ?? false,
    noProgressPly: input.noProgressPly ?? 0,
    positionCounts: { ...(input.positionCounts ?? {}) },
  };
  const key = checkersPositionKey(state);
  if (!state.positionCounts[key]) state.positionCounts[key] = 1;
  return state;
}

function initialPieces(): CheckersPiece[] {
  const pieces: CheckersPiece[] = [];
  const counts: Record<CheckersColor, number> = { black: 0, red: 0 };
  for (let square = 0; square < 64; square += 1) {
    if (!isPlayableSquare(square)) continue;
    const row = rowOf(square);
    const color: CheckersColor | null = row <= 2 ? "black" : row >= 5 ? "red" : null;
    if (!color) continue;
    counts[color] += 1;
    pieces.push({ id: `${color}-${counts[color]}`, color, rank: "man", square });
  }
  return pieces;
}

function pieceMap(pieces: readonly CheckersPiece[]): Map<number, CheckersPiece> {
  return new Map(pieces.map((piece) => [piece.square, piece]));
}

function captureActionsForPiece(state: CheckersState, originalPiece: CheckersPiece): CheckersAction[] {
  const actions: CheckersAction[] = [];

  function walk(
    pieces: CheckersPiece[],
    movingPiece: CheckersPiece,
    path: number[],
    capturedPieceIds: string[],
  ): void {
    const occupied = pieceMap(pieces);
    let extended = false;

    for (const [rowDelta, columnDelta] of directionsFor(movingPiece)) {
      const adjacent = squareAt(rowOf(movingPiece.square) + rowDelta, columnOf(movingPiece.square) + columnDelta);
      const landing = squareAt(rowOf(movingPiece.square) + rowDelta * 2, columnOf(movingPiece.square) + columnDelta * 2);
      if (adjacent === null || landing === null || occupied.has(landing)) continue;
      const captured = occupied.get(adjacent);
      if (!captured || captured.color === movingPiece.color) continue;

      extended = true;
      const nextPieces = pieces
        .filter((piece) => piece.id !== captured.id)
        .map((piece) => piece.id === movingPiece.id ? { ...piece, square: landing } : { ...piece });
      const nextMovingPiece = nextPieces.find((piece) => piece.id === movingPiece.id)!;
      const promoted = nextMovingPiece.rank === "man" && isPromotionSquare(nextMovingPiece.color, landing);
      if (promoted) nextMovingPiece.rank = "king";
      const nextPath = [...path, landing];
      const nextCapturedPieceIds = [...capturedPieceIds, captured.id];

      if (promoted) {
        actions.push({
          type: "move",
          pieceId: originalPiece.id,
          from: originalPiece.square,
          path: nextPath,
          capturedPieceIds: nextCapturedPieceIds,
        });
      } else {
        walk(nextPieces, nextMovingPiece, nextPath, nextCapturedPieceIds);
      }
    }

    if (!extended && capturedPieceIds.length > 0) {
      actions.push({
        type: "move",
        pieceId: originalPiece.id,
        from: originalPiece.square,
        path: [...path],
        capturedPieceIds: [...capturedPieceIds],
      });
    }
  }

  walk(clonePieces(state.pieces), { ...originalPiece }, [], []);
  return actions;
}

function quietActionsForPiece(state: CheckersState, piece: CheckersPiece): CheckersAction[] {
  const occupied = pieceMap(state.pieces);
  const actions: CheckersAction[] = [];
  for (const [rowDelta, columnDelta] of directionsFor(piece)) {
    const landing = squareAt(rowOf(piece.square) + rowDelta, columnOf(piece.square) + columnDelta);
    if (landing === null || occupied.has(landing)) continue;
    actions.push({ type: "move", pieceId: piece.id, from: piece.square, path: [landing], capturedPieceIds: [] });
  }
  return actions;
}

function legalActionsForColor(state: CheckersState, color: CheckersColor): CheckersAction[] {
  const pieces = state.pieces.filter((piece) => piece.color === color);
  const captures = pieces.flatMap((piece) => captureActionsForPiece(state, piece));
  if (captures.length > 0) return sortActions(captures);
  return sortActions(pieces.flatMap((piece) => quietActionsForPiece(state, piece)));
}

function sameNumberArray(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function statusFor(state: CheckersState): GameStatus {
  if (state.winnerColor) {
    return { lifecycle: "completed", winnerPlayerId: state.players[state.winnerColor], draw: false };
  }
  if (state.draw) return { lifecycle: "completed", winnerPlayerId: null, draw: true };
  return { lifecycle: "active", winnerPlayerId: null, draw: false };
}

export const checkersDefinition: GameDefinition<CheckersState, CheckersAction, CheckersObservation> = {
  gameId: "american-checkers",

  createInitialState(playerIds) {
    if (playerIds.length !== 2) throw new Error("Checkers requires exactly two distinct players.");
    return createCheckersState({
      playerIds: [playerIds[0], playerIds[1]],
      pieces: initialPieces(),
      activeColor: "black",
    });
  },

  getStatus: statusFor,

  getActivePlayerId(state) {
    return statusFor(state).lifecycle === "active" ? state.players[state.activeColor] : null;
  },

  listLegalActions(state, playerId) {
    if (statusFor(state).lifecycle !== "active" || state.players[state.activeColor] !== playerId) return [];
    return legalActionsForColor(state, state.activeColor);
  },

  isSameAction(left, right) {
    return left.type === right.type
      && left.pieceId === right.pieceId
      && left.from === right.from
      && sameNumberArray(left.path, right.path)
      && sameStringArray(left.capturedPieceIds, right.capturedPieceIds);
  },

  applyAction(state, playerId, action) {
    const activePlayerId = this.getActivePlayerId(state);
    if (activePlayerId !== playerId) throw new Error("Cannot apply an action for an inactive checkers player.");
    const canonical = this.listLegalActions(state, playerId).find((candidate) => this.isSameAction(candidate, action));
    if (!canonical) throw new Error("Illegal American Checkers action.");

    const movingPieceBefore = state.pieces.find((piece) => piece.id === canonical.pieceId)!;
    const destination = canonical.path.at(-1)!;
    const pieces = state.pieces
      .filter((piece) => !canonical.capturedPieceIds.includes(piece.id))
      .map((piece) => piece.id === canonical.pieceId ? { ...piece, square: destination } : { ...piece });
    const movingPieceAfter = pieces.find((piece) => piece.id === canonical.pieceId)!;
    const promoted = movingPieceAfter.rank === "man" && isPromotionSquare(movingPieceAfter.color, destination);
    if (promoted) movingPieceAfter.rank = "king";

    const moverColor = state.activeColor;
    const nextColor = otherColor(moverColor);
    const next: CheckersState = {
      pieces,
      players: { ...state.players },
      activeColor: nextColor,
      winnerColor: null,
      draw: false,
      noProgressPly: canonical.capturedPieceIds.length > 0 || promoted ? 0 : state.noProgressPly + 1,
      positionCounts: { ...state.positionCounts },
    };

    const nextHasPieces = next.pieces.some((piece) => piece.color === nextColor);
    const nextHasActions = nextHasPieces && legalActionsForColor(next, nextColor).length > 0;
    if (!nextHasActions) {
      next.winnerColor = moverColor;
    } else {
      const key = checkersPositionKey(next);
      next.positionCounts[key] = (next.positionCounts[key] ?? 0) + 1;
      if (next.positionCounts[key] >= 3 || next.noProgressPly >= CHECKERS_NO_PROGRESS_PLY_LIMIT) {
        next.draw = true;
      }
    }

    const captureSummary = canonical.capturedPieceIds.length > 0
      ? ` and captured ${canonical.capturedPieceIds.join(", ")}`
      : "";
    const promotionSummary = promoted ? " and was crowned" : "";
    return {
      state: next,
      summary: `${playerId} moved ${movingPieceBefore.id} from ${canonical.from} to ${destination}${captureSummary}${promotionSummary}.`,
    };
  },

  getObservation(state, playerId) {
    const yourColor = state.players.black === playerId ? "black" : "red";
    const legalActions = [...this.listLegalActions(state, playerId)];
    const board: Array<CheckersPieceView | null> = Array(64).fill(null);
    for (const piece of state.pieces) board[piece.square] = { id: piece.id, color: piece.color, rank: piece.rank };
    return {
      board,
      yourColor,
      activePlayerId: this.getActivePlayerId(state),
      status: this.getStatus(state),
      legalActions,
      mustCapture: legalActions.some((action) => action.capturedPieceIds.length > 0),
      noProgressPly: state.noProgressPly,
    };
  },

  cloneState(state) {
    return {
      pieces: clonePieces(state.pieces),
      players: { ...state.players },
      activeColor: state.activeColor,
      winnerColor: state.winnerColor,
      draw: state.draw,
      noProgressPly: state.noProgressPly,
      positionCounts: { ...state.positionCounts },
    };
  },
};

function actionScore(action: CheckersAction, observation: CheckersObservation): number {
  const movingPiece = observation.board[action.from];
  const destination = action.path.at(-1)!;
  const destinationRow = rowOf(destination);
  const destinationColumn = columnOf(destination);
  const promotion = movingPiece?.rank === "man"
    && ((movingPiece.color === "black" && destinationRow === 7) || (movingPiece.color === "red" && destinationRow === 0));
  const centerDistance = Math.abs(3.5 - destinationRow) + Math.abs(3.5 - destinationColumn);
  return action.capturedPieceIds.length * 100 + (promotion ? 25 : 0) - centerDistance;
}

export class DeterministicCheckersPlayer implements AgentPlayer<CheckersAction, CheckersObservation> {
  readonly agentId: string;

  constructor(agentId = "theo") {
    this.agentId = agentId;
  }

  async chooseAction({ observation, legalActions }: { observation: CheckersObservation; legalActions: readonly CheckersAction[] }): Promise<CheckersAction> {
    if (observation.activePlayerId !== this.agentId || legalActions.length === 0) {
      throw new Error("The checkers agent cannot act in the supplied observation.");
    }
    return [...legalActions].sort((left, right) => {
      const scoreDifference = actionScore(right, observation) - actionScore(left, observation);
      return scoreDifference || actionSortKey(left).localeCompare(actionSortKey(right));
    })[0];
  }
}
