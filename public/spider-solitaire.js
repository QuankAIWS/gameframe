import {
  applySpiderMove,
  canDealSpiderStock,
  canMoveSpiderSequence,
  cloneSpiderState,
  createSpiderState,
  dealSpiderStock,
  movableSequenceStarts,
  validSpiderDestinations,
  validateSpiderState,
} from "./spider-solitaire-engine.js";

const SAVE_KEY = "scribbles-gameframe.spider-solitaire:v1";
const HISTORY_LIMIT = 120;
const rankLabels = Object.freeze({ 1: "A", 11: "J", 12: "Q", 13: "K" });
const suitMarks = Object.freeze({ spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" });

const board = document.querySelector("#spider-board");
const difficulty = document.querySelector("#difficulty");
const newGameButton = document.querySelector("#new-game");
const restartButton = document.querySelector("#restart-game");
const undoButton = document.querySelector("#undo");
const dealButton = document.querySelector("#deal-stock");
const moveCount = document.querySelector("#move-count");
const stockCount = document.querySelector("#stock-count");
const runCount = document.querySelector("#run-count");
const stockHelp = document.querySelector("#stock-help");
const dealId = document.querySelector("#deal-id");
const status = document.querySelector("#status");
const completedRuns = document.querySelector("#completed-runs");
const winDialog = document.querySelector("#win-dialog");
const winSummary = document.querySelector("#win-summary");
const winNewGame = document.querySelector("#win-new-game");

let state;
let history = [];
let selection = null;
let dragSelection = null;

function freshSeed() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function save() {
  window.localStorage.setItem(SAVE_KEY, JSON.stringify({ state, history: history.slice(-HISTORY_LIMIT) }));
}

function load() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SAVE_KEY) || "null");
    if (!saved?.state) return false;
    validateSpiderState(saved.state);
    state = cloneSpiderState(saved.state);
    history = Array.isArray(saved.history)
      ? saved.history.filter((entry) => {
          try { return validateSpiderState(entry); } catch { return false; }
        }).slice(-HISTORY_LIMIT).map(cloneSpiderState)
      : [];
    return true;
  } catch {
    window.localStorage.removeItem(SAVE_KEY);
    return false;
  }
}

function setStatus(message, tone = "neutral") {
  status.textContent = message;
  status.dataset.tone = tone;
}

function remember() {
  history.push(cloneSpiderState(state));
  if (history.length > HISTORY_LIMIT) history.shift();
}

function commit(nextState, message) {
  remember();
  state = nextState;
  selection = null;
  dragSelection = null;
  save();
  setStatus(message, state.status === "won" ? "success" : "neutral");
  render();
}

function startNewGame(selectedDifficulty = Number(difficulty.value || state?.difficulty || 1)) {
  state = createSpiderState({ difficulty: selectedDifficulty, seed: freshSeed() });
  history = [];
  selection = null;
  dragSelection = null;
  save();
  setStatus("New deal ready. Choose a face-up card or same-suit sequence.");
  render();
}

function restartSameDeal() {
  state = createSpiderState({ difficulty: state.difficulty, seed: state.seed });
  history = [];
  selection = null;
  dragSelection = null;
  save();
  setStatus("Deal restarted from its original shuffle.");
  render();
}

function undo() {
  if (!history.length) return;
  state = history.pop();
  selection = null;
  dragSelection = null;
  save();
  setStatus("Last move undone.");
  render();
}

function rankLabel(rank) {
  return rankLabels[rank] || String(rank);
}

function selectableStart(columnIndex, cardIndex) {
  return movableSequenceStarts(state.tableau[columnIndex]).includes(cardIndex);
}

function select(columnIndex, cardIndex) {
  if (!selectableStart(columnIndex, cardIndex)) {
    setStatus("Only a face-up card or descending same-suit sequence can move.", "error");
    return false;
  }
  if (selection?.columnIndex === columnIndex && selection?.cardIndex === cardIndex) {
    selection = null;
    setStatus("Selection cleared.");
  } else {
    selection = { columnIndex, cardIndex };
    const count = state.tableau[columnIndex].length - cardIndex;
    const destinations = validSpiderDestinations(state, columnIndex, cardIndex).length;
    setStatus(`${count === 1 ? "Card" : `${count} cards`} selected · ${destinations} legal destination${destinations === 1 ? "" : "s"}.`);
  }
  render();
  return true;
}

function moveSelected(toColumn) {
  if (!selection) return false;
  const { columnIndex: fromColumn, cardIndex: startIndex } = selection;
  if (!canMoveSpiderSequence(state, fromColumn, startIndex, toColumn)) return false;
  const movingCount = state.tableau[fromColumn].length - startIndex;
  const beforeRuns = state.completedRuns.length;
  const next = applySpiderMove(state, { type: "move", fromColumn, startIndex, toColumn });
  const completed = next.completedRuns.length - beforeRuns;
  commit(next, completed > 0
    ? `Run completed. ${next.completedRuns.length} of 8 collected.`
    : `${movingCount === 1 ? "Card" : `${movingCount} cards`} moved to column ${toColumn + 1}.`);
  return true;
}

function onCardClick(columnIndex, cardIndex) {
  if (state.status !== "playing") return;
  if (selection && selection.columnIndex !== columnIndex && moveSelected(columnIndex)) return;
  select(columnIndex, cardIndex);
}

function onColumnClick(columnIndex, event) {
  if (event.target.closest(".spider-card")) return;
  if (selection && moveSelected(columnIndex)) return;
  if (state.tableau[columnIndex].length === 0) setStatus("Select a movable card or sequence, then tap this empty column.");
}

function renderCompletedRuns() {
  completedRuns.replaceChildren();
  for (let index = 0; index < 8; index += 1) {
    const slot = document.createElement("span");
    slot.className = "completed-slot";
    const suit = state.completedRuns[index];
    if (suit) {
      slot.classList.add("is-filled");
      if (suit === "hearts" || suit === "diamonds") slot.classList.add("is-red");
      slot.textContent = suitMarks[suit];
      slot.title = `Completed ${suit} run`;
    } else {
      slot.textContent = "·";
      slot.setAttribute("aria-hidden", "true");
    }
    completedRuns.append(slot);
  }
}

function renderCard(card, columnIndex, cardIndex, topOffset) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `spider-card ${card.faceUp ? "is-face-up" : "is-face-down"}`;
  button.style.top = `${topOffset}px`;
  button.style.zIndex = String(20 + cardIndex);
  button.dataset.cardId = card.id;
  button.dataset.column = String(columnIndex);
  button.dataset.index = String(cardIndex);

  if (!card.faceUp) {
    button.disabled = true;
    button.setAttribute("aria-label", `Face-down card in column ${columnIndex + 1}`);
    return button;
  }

  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  if (isRed) button.classList.add("is-red");
  const movable = selectableStart(columnIndex, cardIndex);
  if (movable) button.classList.add("is-movable");
  if (selection?.columnIndex === columnIndex && cardIndex >= selection.cardIndex) button.classList.add("is-selected");
  button.draggable = movable;
  button.setAttribute("aria-label", `${rankLabel(card.rank)} of ${card.suit}, column ${columnIndex + 1}${movable ? ", movable" : ""}`);
  button.innerHTML = `<span class="card-corner"><span class="card-rank">${rankLabel(card.rank)}</span><span class="card-suit">${suitMarks[card.suit]}</span></span><span class="card-center" aria-hidden="true">${suitMarks[card.suit]}</span>`;
  button.addEventListener("click", () => onCardClick(columnIndex, cardIndex));
  button.addEventListener("dragstart", (event) => {
    if (!movable) { event.preventDefault(); return; }
    selection = { columnIndex, cardIndex };
    dragSelection = { columnIndex, cardIndex };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${columnIndex}:${cardIndex}`);
    queueMicrotask(render);
  });
  button.addEventListener("dragend", () => {
    dragSelection = null;
    render();
  });
  return button;
}

function renderBoard() {
  board.replaceChildren();
  const validDestinations = selection
    ? new Set(validSpiderDestinations(state, selection.columnIndex, selection.cardIndex))
    : new Set();

  state.tableau.forEach((cards, columnIndex) => {
    const column = document.createElement("div");
    column.className = "spider-column";
    column.dataset.columnLabel = `COL ${columnIndex + 1}`;
    column.dataset.column = String(columnIndex);
    column.setAttribute("role", "group");
    column.setAttribute("aria-label", `Tableau column ${columnIndex + 1}, ${cards.length} cards`);
    if (validDestinations.has(columnIndex)) column.classList.add("is-valid-destination");
    column.addEventListener("click", (event) => onColumnClick(columnIndex, event));
    column.addEventListener("dragover", (event) => {
      const active = dragSelection || selection;
      if (!active || !canMoveSpiderSequence(state, active.columnIndex, active.cardIndex, columnIndex)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      column.classList.add("is-drop-target");
    });
    column.addEventListener("dragleave", () => column.classList.remove("is-drop-target"));
    column.addEventListener("drop", (event) => {
      event.preventDefault();
      column.classList.remove("is-drop-target");
      moveSelected(columnIndex);
    });

    if (cards.length === 0) {
      const empty = document.createElement("button");
      empty.type = "button";
      empty.className = "spider-empty-target";
      empty.textContent = "EMPTY";
      empty.setAttribute("aria-label", `Empty tableau column ${columnIndex + 1}`);
      empty.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!moveSelected(columnIndex)) setStatus("Select a movable card or sequence first.");
      });
      column.append(empty);
    }

    let top = 34;
    cards.forEach((card, cardIndex) => {
      column.append(renderCard(card, columnIndex, cardIndex, top));
      const isLast = cardIndex === cards.length - 1;
      if (!isLast) top += card.faceUp ? 28 : 14;
    });
    column.style.minHeight = `${Math.max(500, top + 130)}px`;
    board.append(column);
  });
}

function render() {
  difficulty.value = String(state.difficulty);
  moveCount.textContent = String(state.moveCount);
  const deals = state.stock.length / 10;
  stockCount.textContent = String(deals);
  runCount.textContent = `${state.completedRuns.length} / 8`;
  stockHelp.textContent = `${deals} deal${deals === 1 ? "" : "s"} remaining`;
  dealId.textContent = state.seed.replaceAll("-", "").slice(0, 10).toUpperCase();
  undoButton.disabled = history.length === 0;
  dealButton.disabled = !canDealSpiderStock(state);
  renderCompletedRuns();
  renderBoard();

  winDialog.hidden = state.status !== "won";
  if (state.status === "won") {
    winSummary.textContent = `Eight runs completed in ${state.moveCount} moves.`;
    setStatus(`Table cleared in ${state.moveCount} moves.`, "success");
  }
  window.gameFrameDestinationBar?.sync?.();
}

newGameButton.addEventListener("click", () => startNewGame(Number(difficulty.value)));
restartButton.addEventListener("click", restartSameDeal);
undoButton.addEventListener("click", undo);
dealButton.addEventListener("click", () => {
  try {
    commit(dealSpiderStock(state), "Stock dealt: one face-up card added to each column.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Stock cannot be dealt.", "error");
  }
});
winNewGame.addEventListener("click", () => startNewGame(state.difficulty));
difficulty.addEventListener("change", () => {
  setStatus(`Difficulty set to ${difficulty.value} suit${difficulty.value === "1" ? "" : "s"}. Press New deal to reshuffle.`);
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undo();
  }
  if (event.key === "Escape" && selection) {
    selection = null;
    setStatus("Selection cleared.");
    render();
  }
});

if (!load()) {
  state = createSpiderState({ difficulty: 1, seed: freshSeed() });
  save();
  setStatus("New deal ready. Choose a face-up card or same-suit sequence.");
} else {
  setStatus("Saved deal resumed.");
}
render();
