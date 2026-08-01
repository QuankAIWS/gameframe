import "./checkers-premium.js";
import "./checkers-premium-layout.js";

const board = document.querySelector("#board");
const boardWrap = board?.closest(".board-wrap");
const status = document.querySelector("#status");
const details = document.querySelector("#details");
const newMatch = document.querySelector("#new-match");
const challengeTheo = document.querySelector("#challenge-theo");
const createHumanMatch = document.querySelector("#create-human-match");

let checkersSnapshot = new Map();
let animationQueue = Promise.resolve();
let updateScheduled = false;

function readDiagnostics() {
  try {
    return JSON.parse(details?.textContent || "{}");
  } catch {
    return {};
  }
}

function ensureOutcomeOverlay() {
  if (!boardWrap) return null;
  let overlay = boardWrap.querySelector("#game-outcome-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("section");
  overlay.id = "game-outcome-overlay";
  overlay.className = "game-outcome-overlay";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "false");
  overlay.setAttribute("aria-labelledby", "game-outcome-title");
  overlay.innerHTML = `
    <div class="game-outcome-card">
      <p class="game-outcome-kicker">MATCH COMPLETE</p>
      <h3 id="game-outcome-title"></h3>
      <p id="game-outcome-copy"></p>
      <div class="game-outcome-actions">
        <button id="game-outcome-rematch" type="button">Rematch</button>
        <button id="game-outcome-setup" class="secondary-button" type="button">Match setup</button>
      </div>
    </div>
  `;
  boardWrap.append(overlay);

  overlay.querySelector("#game-outcome-setup").addEventListener("click", () => newMatch?.click());
  overlay.querySelector("#game-outcome-rematch").addEventListener("click", () => {
    const diagnostics = readDiagnostics();
    const versusTheo = diagnostics.playerIds?.includes("theo")
      || document.querySelector("#player-o-name")?.textContent === "Theo";
    newMatch?.click();
    requestAnimationFrame(() => {
      if (versusTheo) challengeTheo?.click();
      else createHumanMatch?.click();
    });
  });
  return overlay;
}

function updateOutcomeOverlay() {
  const overlay = ensureOutcomeOverlay();
  if (!overlay || !board?.classList.contains("board-tic-tac-toe")) {
    if (overlay) overlay.hidden = true;
    return;
  }

  const message = status?.textContent?.trim() ?? "";
  const terminal = /match complete|draw\. the board is locked/i.test(message);
  if (!terminal) {
    overlay.hidden = true;
    return;
  }

  const title = overlay.querySelector("#game-outcome-title");
  const copy = overlay.querySelector("#game-outcome-copy");
  if (/^you won/i.test(message)) {
    title.textContent = "You won";
    copy.textContent = "The line is complete. Run it back without leaving the board.";
  } else if (/^draw/i.test(message)) {
    title.textContent = "Draw game";
    copy.textContent = "No open line remains. Start another round immediately.";
  } else {
    const winner = message.match(/^(.+?) won/i)?.[1] ?? "Opponent";
    title.textContent = `${winner} wins`;
    copy.textContent = "The match is complete. Rematch from the same seat or return to setup.";
  }
  overlay.hidden = false;
}

function squareCoordinate(square) {
  return { row: Math.floor(square / 8), column: square % 8 };
}

function squareFromCoordinate(row, column) {
  return row * 8 + column;
}

function snapshotCheckersBoard() {
  const snapshot = new Map();
  if (!board?.classList.contains("board-checkers")) return snapshot;
  for (const cell of board.querySelectorAll(".checkers-cell[data-piece-id]")) {
    const pieceId = cell.dataset.pieceId;
    if (!pieceId) continue;
    snapshot.set(pieceId, {
      square: Number(cell.dataset.cell),
      piece: cell.querySelector(".checkers-piece"),
    });
  }
  return snapshot;
}

function reconstructJumpPath(start, end, removedSquares) {
  const removed = new Set(removedSquares);
  const seen = new Set();
  const directions = [[-2, -2], [-2, 2], [2, -2], [2, 2]];

  function visit(square, path) {
    if (square === end) return path;
    if (path.length > 13) return null;
    const { row, column } = squareCoordinate(square);
    for (const [rowDelta, columnDelta] of directions) {
      const nextRow = row + rowDelta;
      const nextColumn = column + columnDelta;
      if (nextRow < 0 || nextRow > 7 || nextColumn < 0 || nextColumn > 7) continue;
      const middle = squareFromCoordinate(row + rowDelta / 2, column + columnDelta / 2);
      if (!removed.has(middle) || seen.has(middle)) continue;
      const next = squareFromCoordinate(nextRow, nextColumn);
      seen.add(middle);
      const result = visit(next, [...path, next]);
      if (result) return result;
      seen.delete(middle);
    }
    return null;
  }

  return visit(start, [start]);
}

function inferCheckersPath(previous, next, pieceId) {
  const from = previous.get(pieceId)?.square;
  const to = next.get(pieceId)?.square;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) return null;

  const removedSquares = [...previous.entries()]
    .filter(([id]) => !next.has(id))
    .map(([, value]) => value.square);
  const jumpPath = reconstructJumpPath(from, to, removedSquares);
  return jumpPath ?? [from, to];
}

function animateCheckersPiece(pieceId, path, nextSnapshot) {
  const destination = nextSnapshot.get(pieceId);
  const piece = destination?.piece;
  if (!piece || path.length < 2) return Promise.resolve();

  const destinationCoordinate = squareCoordinate(destination.square);
  const hops = path.length - 1;
  board.dataset.lastAnimationSteps = String(hops);
  board.dispatchEvent(new CustomEvent("gameframe:checkers-animation", {
    bubbles: true,
    detail: { pieceId, path: [...path], hops },
  }));

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();

  const cell = piece.closest(".checkers-cell");
  const cellSize = cell?.getBoundingClientRect().width || 1;
  const keyframes = [];
  for (let index = 0; index < path.length; index += 1) {
    const coordinate = squareCoordinate(path[index]);
    const x = (coordinate.column - destinationCoordinate.column) * cellSize;
    const y = (coordinate.row - destinationCoordinate.row) * cellSize;
    const offset = index / hops;
    keyframes.push({ transform: `translate(${x}px, ${y}px) scale(1)`, offset });
    if (index < hops) {
      const nextCoordinate = squareCoordinate(path[index + 1]);
      const nextX = (nextCoordinate.column - destinationCoordinate.column) * cellSize;
      const nextY = (nextCoordinate.row - destinationCoordinate.row) * cellSize;
      keyframes.push({
        transform: `translate(${(x + nextX) / 2}px, ${(y + nextY) / 2 - cellSize * 0.2}px) scale(1.08)`,
        offset: Math.min(1, offset + 0.5 / hops),
      });
    }
  }

  board.classList.add("is-animating");
  const animation = piece.animate(keyframes, {
    duration: Math.min(1500, Math.max(260, hops * 260)),
    easing: "cubic-bezier(.22,.76,.25,1)",
  });
  return animation.finished.catch(() => {}).finally(() => board.classList.remove("is-animating"));
}

function queueCheckersAnimations(previous, next) {
  const moved = [...next.keys()]
    .map((pieceId) => ({ pieceId, path: inferCheckersPath(previous, next, pieceId) }))
    .filter(({ path }) => path?.length > 1);
  if (!moved.length) return;

  animationQueue = animationQueue.then(async () => {
    for (const movement of moved) {
      await animateCheckersPiece(movement.pieceId, movement.path, next);
    }
  });
}

function updatePresentation() {
  updateScheduled = false;
  updateOutcomeOverlay();

  if (!board?.classList.contains("board-checkers")) {
    checkersSnapshot = new Map();
    return;
  }

  const next = snapshotCheckersBoard();
  if (checkersSnapshot.size) queueCheckersAnimations(checkersSnapshot, next);
  checkersSnapshot = next;
}

function schedulePresentationUpdate() {
  if (updateScheduled) return;
  updateScheduled = true;
  requestAnimationFrame(updatePresentation);
}

if (board && status) {
  const observer = new MutationObserver(schedulePresentationUpdate);
  observer.observe(board, { childList: true, subtree: true });
  observer.observe(status, { childList: true, characterData: true, subtree: true });
  schedulePresentationUpdate();
}
