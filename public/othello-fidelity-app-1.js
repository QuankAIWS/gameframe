const referenceStyles = [
  "/othello-reference-core.css",
  "/othello-reference-neon.css",
  "/othello-reference-garden.css",
  "/othello-reference-responsive.css",
  "/othello-fidelity-neon.css",
  "/othello-fidelity-garden.css",
  "/othello-bake4-neon.css",
  "/othello-bake4-garden.css",
  "/othello-bake4-responsive.css",
];
for (const href of referenceStyles) {
  if (!document.head.querySelector(`link[href="${href}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.append(link);
  }
}

const emblemSvg = document.querySelector(".brand-emblem svg");
if (emblemSvg && !emblemSvg.querySelector("#neon-cyan-orb")) {
  emblemSvg.insertAdjacentHTML("afterbegin", `
    <defs>
      <radialGradient id="neon-cyan-orb" cx="32%" cy="25%" r="78%">
        <stop offset="0" stop-color="#f2ffff"/><stop offset=".12" stop-color="#68f4ff"/>
        <stop offset=".48" stop-color="#0e8194"/><stop offset=".82" stop-color="#062432"/>
        <stop offset="1" stop-color="#52e7ff"/>
      </radialGradient>
      <radialGradient id="neon-magenta-orb" cx="34%" cy="26%" r="78%">
        <stop offset="0" stop-color="#fff1fc"/><stop offset=".12" stop-color="#ff6bdd"/>
        <stop offset=".5" stop-color="#8f176f"/><stop offset=".84" stop-color="#300a2b"/>
        <stop offset="1" stop-color="#ec3cc4"/>
      </radialGradient>
    </defs>`);
}

const SIZE = 8;
const DARK = 1;
const LIGHT = -1;
const EMPTY = 0;
const directions = [-1, 0, 1]
  .flatMap((dr) => [-1, 0, 1].map((dc) => [dr, dc]))
  .filter(([dr, dc]) => dr || dc);

const canvas = document.querySelector("#othello-board");
const context = canvas.getContext("2d");
const darkScore = document.querySelector("#dark-score");
const lightScore = document.querySelector("#light-score");
const darkTurn = document.querySelector("#dark-turn");
const lightTurn = document.querySelector("#light-turn");
const turnCopy = document.querySelector("#turn-copy");
const moveNumber = document.querySelector("#move-number");
const legalCount = document.querySelector("#legal-count");
const themeTitle = document.querySelector("#theme-title");
const themeDescription = document.querySelector("#theme-description");
const announcement = document.querySelector("#board-announcement");
const hintButton = document.querySelector("#toggle-hints");
const themeColor = document.querySelector('meta[name="theme-color"]');

const themeInfo = {
  obsidian: {
    title: "Obsidian & Ivory",
    description: "Strategy. Balance. Endless depth.",
    color: "#080a0d",
    darkTurn: "Dark to move",
    lightTurn: "Light to move",
  },
  neon: {
    title: "Neon Circuit",
    description: "Signal. Polarity. Control.",
    color: "#020712",
    darkTurn: "Magenta holds the circuit",
    lightTurn: "Light answers the pattern",
  },
  garden: {
    title: "Living Garden",
    description: "A quiet game in a living pond.",
    color: "#0b1712",
    darkTurn: "North places a seed",
    lightTurn: "South places a seed",
  },
};

const query = new URLSearchParams(location.search);
const snapshotMode = query.has("snapshot");
let theme = query.get("theme") || "obsidian";
let hints = true;
let hover = null;
let flipAnimation = null;
let state = createState();

function createBoard() {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
  board[3][3] = LIGHT;
  board[3][4] = DARK;
  board[4][3] = DARK;
  board[4][4] = LIGHT;
  return board;
}

function createState() {
  return { board: createBoard(), player: DARK, move: 0, complete: false, lastMove: null };
}

function inside(row, column) {
  return row >= 0 && row < SIZE && column >= 0 && column < SIZE;
}

function flipsFor(board, player, row, column) {
  if (!inside(row, column) || board[row][column] !== EMPTY) return [];
  const result = [];
  for (const [dr, dc] of directions) {
    const line = [];
    let r = row + dr;
    let c = column + dc;
    while (inside(r, c) && board[r][c] === -player) {
      line.push([r, c]);
      r += dr;
      c += dc;
    }
    if (line.length && inside(r, c) && board[r][c] === player) result.push(...line);
  }
  return result;
}

function legalMoves(board = state.board, player = state.player) {
  const moves = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let column = 0; column < SIZE; column += 1) {
      const flips = flipsFor(board, player, row, column);
      if (flips.length) moves.push({ row, column, flips });
    }
  }
  return moves;
}

function scores() {
  let dark = 0;
  let light = 0;
  for (const cell of state.board.flat()) {
    if (cell === DARK) dark += 1;
    if (cell === LIGHT) light += 1;
  }
  return { dark, light };
}

function applyMove(move, animate = true) {
  if (!move || state.complete) return false;
  const before = state.player;
  state.board[move.row][move.column] = before;
  for (const [row, column] of move.flips) state.board[row][column] = before;
  state.lastMove = [move.row, move.column];
  state.move += 1;
  state.player = -before;

  if (legalMoves().length === 0) {
    state.player = before;
    if (legalMoves().length === 0) state.complete = true;
  }

  if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    flipAnimation = {
      started: performance.now(),
      placed: [move.row, move.column],
      flips: move.flips,
      player: before,
      duration: theme === "neon" ? 420 : 560,
    };
  }
  updateUi();
  return true;
}

function selectComputerMove() {
  const weights = [
    [120,-35,18,10,10,18,-35,120],[-35,-55,-8,-5,-5,-8,-55,-35],
    [18,-8,12,4,4,12,-8,18],[10,-5,4,2,2,4,-5,10],
    [10,-5,4,2,2,4,-5,10],[18,-8,12,4,4,12,-8,18],
    [-35,-55,-8,-5,-5,-8,-55,-35],[120,-35,18,10,10,18,-35,120],
  ];
  return legalMoves().sort((a, b) =>
    (weights[b.row][b.column] + b.flips.length * 3)
      - (weights[a.row][a.column] + a.flips.length * 3)
      || a.row - b.row
      || a.column - b.column,
  )[0];
}

function playOneMove(animate = true) {
  applyMove(selectComputerMove(), animate);
}

function setPreviewState(name) {
  state = createState();
  const numeric = Number.parseInt(name, 10);
  const moves = Number.isFinite(numeric)
    ? Math.max(0, Math.min(60, numeric))
    : name === "late" ? 48 : name === "midgame" ? 27 : 0;
  for (let index = 0; index < moves && !state.complete; index += 1) playOneMove(false);
  flipAnimation = null;
  updateUi();
}

function activeTurnCopy() {
  return state.player === DARK ? themeInfo[theme].darkTurn : themeInfo[theme].lightTurn;
}

function updateUi() {
  const score = scores();
  const legal = legalMoves();
  darkScore.textContent = String(score.dark);
  lightScore.textContent = String(score.light);
  moveNumber.textContent = `${state.move} / 60`;
  legalCount.textContent = state.complete ? "—" : String(legal.length);
  darkTurn.classList.toggle("is-active", !state.complete && state.player === DARK);
  lightTurn.classList.toggle("is-active", !state.complete && state.player === LIGHT);
  darkTurn.lastChild.textContent = !state.complete && state.player === DARK ? "ACTIVE" : "WAITING";
  lightTurn.lastChild.textContent = !state.complete && state.player === LIGHT ? "ACTIVE" : "WAITING";

  if (state.complete) {
    const result = score.dark === score.light
      ? "The board rests in balance"
      : `${score.dark > score.light ? "Dark" : "Light"} commands the final field`;
    turnCopy.textContent = result;
    announcement.textContent = result;
    announcement.hidden = false;
  } else {
    turnCopy.textContent = activeTurnCopy();
    announcement.hidden = true;
  }
}

function setTheme(nextTheme) {
  theme = themeInfo[nextTheme] ? nextTheme : "obsidian";
  document.body.dataset.theme = theme;
  document.title = `Othello · ${themeInfo[theme].title}`;
  themeColor.setAttribute("content", themeInfo[theme].color);
  themeTitle.textContent = themeInfo[theme].title;
  themeDescription.textContent = themeInfo[theme].description;
  document.querySelectorAll(".theme-button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.theme === theme));
  });
  updateUi();
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, r);
}

function hash(row, column, salt = 0) {
  const value = Math.sin(row * 91.17 + column * 37.31 + salt * 13.77) * 43758.5453;
  return value - Math.floor(value);
}

function boardMetrics() {
  if (theme === "neon") return { margin: 38, boardSize: 884, cell: 110.5 };
  if (theme === "garden") return { margin: 64, boardSize: 832, cell: 104 };
  return { margin: 72, boardSize: 816, cell: 102 };
}

function drawObsidianBackground(ctx, time) {
  const gradient = ctx.createRadialGradient(430, 380, 80, 480, 480, 720);
  gradient.addColorStop(0, "#27302c");
  gradient.addColorStop(.44, "#121816");
  gradient.addColorStop(1, "#060708");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 960, 960);

  ctx.save();
  ctx.strokeStyle = "rgba(218,185,120,.055)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 20; i += 1) {
    const y = 30 + i * 47 + Math.sin(time * .00012 + i) * 2;
    ctx.beginPath();
    ctx.moveTo(-40, y);
    ctx.bezierCurveTo(260, y - 15, 690, y + 18, 1000, y - 2);
    ctx.stroke();
  }
  ctx.restore();
}

