const TIC_TAC_TOE = "tic-tac-toe";
const CHECKERS = "american-checkers";
const CHECKERS_DRAW_PLY_LIMIT = 80;

function clone(value) {
  return structuredClone(value);
}

function completedStatus(winnerPlayerId = null, draw = false) {
  return { lifecycle: "completed", winnerPlayerId, draw };
}

function activeStatus() {
  return { lifecycle: "active", winnerPlayerId: null, draw: false };
}

function createTicTacToeController() {
  const playerIds = ["local:x", "local:o"];
  let board = Array(9).fill(null);
  let nextIndex = 0;
  let revision = 0;
  let status = activeStatus();

  function winner() {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];
    for (const [a, b, c] of lines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    return null;
  }

  function observation() {
    const activePlayerId = status.lifecycle === "active" ? playerIds[nextIndex] : null;
    return {
      board: [...board],
      nextPlayerId: activePlayerId,
      status: clone(status),
      legalActions: status.lifecycle === "active"
        ? board.flatMap((mark, cell) => mark === null ? [{ type: "place", cell }] : [])
        : [],
    };
  }

  function view() {
    return {
      gameId: TIC_TAC_TOE,
      matchId: "local:tic-tac-toe",
      playerIds: [...playerIds],
      revision,
      eventCount: revision,
      observation: observation(),
    };
  }

  function submit(action) {
    if (status.lifecycle !== "active" || action?.type !== "place") return view();
    const cell = Number(action.cell);
    if (!Number.isInteger(cell) || cell < 0 || cell >= board.length || board[cell] !== null) return view();
    board[cell] = nextIndex === 0 ? "X" : "O";
    revision += 1;
    const mark = winner();
    if (mark) status = completedStatus(mark === "X" ? playerIds[0] : playerIds[1], false);
    else if (board.every(Boolean)) status = completedStatus(null, true);
    else nextIndex = nextIndex === 0 ? 1 : 0;
    return view();
  }

  return Object.freeze({ gameId: TIC_TAC_TOE, view, submit });
}

function rowOf(square) {
  return Math.floor(square / 8);
}

function columnOf(square) {
  return square % 8;
}

function squareAt(row, column) {
  if (row < 0 || row >= 8 || column < 0 || column >= 8) return null;
  return row * 8 + column;
}

function playable(square) {
  return Number.isInteger(square) && square >= 0 && square < 64 && (rowOf(square) + columnOf(square)) % 2 === 1;
}

function otherColor(color) {
  return color === "black" ? "red" : "black";
}

function promotionSquare(color, square) {
  return color === "black" ? rowOf(square) === 7 : rowOf(square) === 0;
}

const MAN_DIRECTIONS = {
  black: [[1, -1], [1, 1]],
  red: [[-1, -1], [-1, 1]],
};
const KING_DIRECTIONS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

function directionsFor(piece) {
  return piece.rank === "king" ? KING_DIRECTIONS : MAN_DIRECTIONS[piece.color];
}

function initialCheckersPieces() {
  const counts = { black: 0, red: 0 };
  const pieces = [];
  for (let square = 0; square < 64; square += 1) {
    if (!playable(square)) continue;
    const row = rowOf(square);
    const color = row <= 2 ? "black" : row >= 5 ? "red" : null;
    if (!color) continue;
    counts[color] += 1;
    pieces.push({ id: `${color}-${counts[color]}`, color, rank: "man", square });
  }
  return pieces;
}

function pieceMap(pieces) {
  return new Map(pieces.map((piece) => [piece.square, piece]));
}

function actionSortKey(action) {
  return [
    String(action.from).padStart(2, "0"),
    action.path.map((square) => String(square).padStart(2, "0")).join("-"),
    action.pieceId,
  ].join(":");
}

function captureActionsForPiece(pieces, originalPiece) {
  const actions = [];

  function walk(nextPieces, movingPiece, path, capturedPieceIds) {
    const occupied = pieceMap(nextPieces);
    let extended = false;
    for (const [rowDelta, columnDelta] of directionsFor(movingPiece)) {
      const adjacent = squareAt(rowOf(movingPiece.square) + rowDelta, columnOf(movingPiece.square) + columnDelta);
      const landing = squareAt(rowOf(movingPiece.square) + rowDelta * 2, columnOf(movingPiece.square) + columnDelta * 2);
      if (adjacent === null || landing === null || occupied.has(landing)) continue;
      const captured = occupied.get(adjacent);
      if (!captured || captured.color === movingPiece.color) continue;

      extended = true;
      const after = nextPieces
        .filter((piece) => piece.id !== captured.id)
        .map((piece) => piece.id === movingPiece.id ? { ...piece, square: landing } : { ...piece });
      const moved = after.find((piece) => piece.id === movingPiece.id);
      const promoted = moved.rank === "man" && promotionSquare(moved.color, landing);
      if (promoted) moved.rank = "king";
      const nextPath = [...path, landing];
      const captures = [...capturedPieceIds, captured.id];
      if (promoted) {
        actions.push({ type: "move", pieceId: originalPiece.id, from: originalPiece.square, path: nextPath, capturedPieceIds: captures });
      } else {
        walk(after, moved, nextPath, captures);
      }
    }
    if (!extended && capturedPieceIds.length) {
      actions.push({ type: "move", pieceId: originalPiece.id, from: originalPiece.square, path: [...path], capturedPieceIds: [...capturedPieceIds] });
    }
  }

  walk(pieces.map((piece) => ({ ...piece })), { ...originalPiece }, [], []);
  return actions;
}

function quietActionsForPiece(pieces, piece) {
  const occupied = pieceMap(pieces);
  const actions = [];
  for (const [rowDelta, columnDelta] of directionsFor(piece)) {
    const landing = squareAt(rowOf(piece.square) + rowDelta, columnOf(piece.square) + columnDelta);
    if (landing === null || occupied.has(landing)) continue;
    actions.push({ type: "move", pieceId: piece.id, from: piece.square, path: [landing], capturedPieceIds: [] });
  }
  return actions;
}

function legalCheckersActions(pieces, color) {
  const movers = pieces.filter((piece) => piece.color === color);
  const captures = movers.flatMap((piece) => captureActionsForPiece(pieces, piece));
  const actions = captures.length ? captures : movers.flatMap((piece) => quietActionsForPiece(pieces, piece));
  return actions.sort((left, right) => actionSortKey(left).localeCompare(actionSortKey(right)));
}

function checkersPositionKey(pieces, activeColor) {
  const position = [...pieces]
    .sort((left, right) => left.square - right.square || left.id.localeCompare(right.id))
    .map((piece) => `${piece.square}:${piece.color[0]}:${piece.rank[0]}`)
    .join("|");
  return `${activeColor};${position}`;
}

function sameAction(left, right) {
  return left?.type === "move"
    && right?.type === "move"
    && left.pieceId === right.pieceId
    && left.from === right.from
    && left.path.length === right.path.length
    && left.path.every((square, index) => square === right.path[index])
    && left.capturedPieceIds.length === right.capturedPieceIds.length
    && left.capturedPieceIds.every((id, index) => id === right.capturedPieceIds[index]);
}

function createCheckersController() {
  const playerIds = ["local:black", "local:red"];
  let pieces = initialCheckersPieces();
  let activeColor = "black";
  let winnerColor = null;
  let draw = false;
  let noProgressPly = 0;
  let revision = 0;
  const positionCounts = { [checkersPositionKey(pieces, activeColor)]: 1 };

  function status() {
    if (winnerColor) return completedStatus(winnerColor === "black" ? playerIds[0] : playerIds[1], false);
    if (draw) return completedStatus(null, true);
    return activeStatus();
  }

  function observation() {
    const gameStatus = status();
    const actions = gameStatus.lifecycle === "active" ? legalCheckersActions(pieces, activeColor) : [];
    const board = Array(64).fill(null);
    for (const piece of pieces) board[piece.square] = { id: piece.id, color: piece.color, rank: piece.rank };
    return {
      board,
      yourColor: activeColor,
      activePlayerId: gameStatus.lifecycle === "active" ? (activeColor === "black" ? playerIds[0] : playerIds[1]) : null,
      status: gameStatus,
      legalActions: actions.map(clone),
      mustCapture: actions.some((action) => action.capturedPieceIds.length > 0),
      noProgressPly,
    };
  }

  function view() {
    return {
      gameId: CHECKERS,
      matchId: "local:american-checkers",
      playerIds: [...playerIds],
      revision,
      eventCount: revision,
      observation: observation(),
    };
  }

  function submit(action) {
    if (winnerColor || draw) return view();
    const legal = legalCheckersActions(pieces, activeColor);
    const canonical = legal.find((candidate) => sameAction(candidate, action));
    if (!canonical) return view();

    const destination = canonical.path.at(-1);
    const before = pieces.find((piece) => piece.id === canonical.pieceId);
    pieces = pieces
      .filter((piece) => !canonical.capturedPieceIds.includes(piece.id))
      .map((piece) => piece.id === canonical.pieceId ? { ...piece, square: destination } : { ...piece });
    const moved = pieces.find((piece) => piece.id === canonical.pieceId);
    const promoted = moved.rank === "man" && promotionSquare(moved.color, destination);
    if (promoted) moved.rank = "king";

    const moverColor = activeColor;
    activeColor = otherColor(activeColor);
    noProgressPly = canonical.capturedPieceIds.length || promoted ? 0 : noProgressPly + 1;
    revision += 1;

    const nextHasPieces = pieces.some((piece) => piece.color === activeColor);
    const nextHasActions = nextHasPieces && legalCheckersActions(pieces, activeColor).length > 0;
    if (!nextHasActions) {
      winnerColor = moverColor;
    } else {
      const key = checkersPositionKey(pieces, activeColor);
      positionCounts[key] = (positionCounts[key] || 0) + 1;
      if (positionCounts[key] >= 3 || noProgressPly >= CHECKERS_DRAW_PLY_LIMIT) draw = true;
    }
    void before;
    return view();
  }

  return Object.freeze({ gameId: CHECKERS, view, submit });
}

export function createLocalBoardMatch(gameId) {
  if (gameId === TIC_TAC_TOE) return createTicTacToeController();
  if (gameId === CHECKERS) return createCheckersController();
  throw new Error(`Unsupported local board game: ${gameId}`);
}
