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
    darkTurn: "Magenta has the circuit",
    lightTurn: "Cyan has the circuit",
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
  const moves = name === "late" ? 48 : name === "midgame" ? 27 : 0;
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
  if (theme === "neon") return { margin: 92, boardSize: 776, cell: 97 };
  return { margin: 76, boardSize: 808, cell: 101 };
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

function drawNeonBackground(ctx, time) {
  const gradient = ctx.createRadialGradient(470, 420, 90, 480, 480, 720);
  gradient.addColorStop(0, "#0c2a43");
  gradient.addColorStop(.5, "#061426");
  gradient.addColorStop(1, "#01050c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 960, 960);

  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(77,225,255,.1)";
  for (let x = 28; x < 960; x += 62) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 960); ctx.stroke();
  }
  for (let y = 28; y < 960; y += 62) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(960, y); ctx.stroke();
  }

  const sweep = (time * .14) % 1180 - 120;
  const sweepGradient = ctx.createLinearGradient(0, sweep - 70, 0, sweep + 70);
  sweepGradient.addColorStop(0, "rgba(80,231,255,0)");
  sweepGradient.addColorStop(.5, "rgba(80,231,255,.12)");
  sweepGradient.addColorStop(1, "rgba(80,231,255,0)");
  ctx.fillStyle = sweepGradient;
  ctx.fillRect(0, sweep - 70, 960, 140);

  ctx.strokeStyle = "rgba(255,62,207,.14)";
  ctx.beginPath();
  ctx.moveTo(0, 160); ctx.lineTo(160, 160); ctx.lineTo(220, 100); ctx.lineTo(360, 100);
  ctx.stroke();
  ctx.strokeStyle = "rgba(80,231,255,.14)";
  ctx.beginPath();
  ctx.moveTo(960, 800); ctx.lineTo(820, 800); ctx.lineTo(760, 860); ctx.lineTo(620, 860);
  ctx.stroke();
  ctx.restore();
}

function drawGardenBackground(ctx, time) {
  const gradient = ctx.createRadialGradient(690, 210, 70, 480, 480, 760);
  gradient.addColorStop(0, "#566b56");
  gradient.addColorStop(.42, "#263f31");
  gradient.addColorStop(1, "#09150f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 960, 960);

  ctx.save();
  ctx.strokeStyle = "rgba(210,187,123,.07)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 7; i += 1) {
    const x = 80 + hash(i, 3) * 800;
    const y = 80 + hash(i, 4) * 800;
    const radius = 30 + hash(i, 5) * 74 + Math.sin(time * .0005 + i) * 2;
    ctx.beginPath(); ctx.ellipse(x, y, radius * 1.3, radius, 0, 0, Math.PI * 2); ctx.stroke();
  }
  for (let i = 0; i < 34; i += 1) {
    const x = hash(i, 1) * 960;
    const y = (hash(i, 2) * 960 + time * (2.4 + hash(i, 4) * 3.5) * .01) % 1030 - 35;
    const size = 1 + hash(i, 3) * 2.5;
    ctx.fillStyle = `rgba(234,207,145,${.06 + hash(i, 7) * .14})`;
    ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function frameGradient(ctx, margin, boardSize) {
  const gradient = ctx.createLinearGradient(margin - 30, margin - 30, margin + boardSize + 30, margin + boardSize + 30);
  if (theme === "obsidian") {
    gradient.addColorStop(0, "#b79a62");
    gradient.addColorStop(.08, "#433622");
    gradient.addColorStop(.42, "#151412");
    gradient.addColorStop(.82, "#2e2519");
    gradient.addColorStop(1, "#8f7448");
  } else if (theme === "neon") {
    gradient.addColorStop(0, "#ff4bd3");
    gradient.addColorStop(.08, "#173d56");
    gradient.addColorStop(.48, "#061629");
    gradient.addColorStop(.92, "#12445c");
    gradient.addColorStop(1, "#61efff");
  } else {
    gradient.addColorStop(0, "#78906a");
    gradient.addColorStop(.13, "#385238");
    gradient.addColorStop(.5, "#1a3123");
    gradient.addColorStop(.86, "#31482f");
    gradient.addColorStop(1, "#b49b5f");
  }
  return gradient;
}

function drawBoardFoundation(ctx, time) {
  const { margin, boardSize, cell } = boardMetrics();
  ctx.save();
  if (theme === "obsidian") drawObsidianBackground(ctx, time);
  if (theme === "neon") drawNeonBackground(ctx, time);
  if (theme === "garden") drawGardenBackground(ctx, time);

  ctx.shadowColor = theme === "neon" ? "rgba(58,221,255,.32)" : "rgba(0,0,0,.66)";
  ctx.shadowBlur = theme === "neon" ? 35 : 30;
  ctx.shadowOffsetY = 16;
  roundedRect(ctx, margin - 28, margin - 28, boardSize + 56, boardSize + 56, theme === "garden" ? 42 : 32);
  ctx.fillStyle = frameGradient(ctx, margin, boardSize);
  ctx.fill();
  ctx.shadowColor = "transparent";

  roundedRect(ctx, margin - 18, margin - 18, boardSize + 36, boardSize + 36, theme === "garden" ? 34 : 24);
  ctx.fillStyle = theme === "neon" ? "#031020" : theme === "garden" ? "#1b3225" : "#0c0e0e";
  ctx.fill();
  ctx.strokeStyle = theme === "neon" ? "rgba(100,239,255,.55)" : "rgba(205,169,101,.5)";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (theme === "garden") drawMossSpeckle(ctx, margin, boardSize);

  for (let row = 0; row < SIZE; row += 1) {
    for (let column = 0; column < SIZE; column += 1) {
      drawCell(ctx, margin + column * cell, margin + row * cell, cell, row, column, time);
    }
  }

  if (theme === "neon") drawNeonCoordinates(ctx, margin, cell);
  ctx.restore();
}

function drawMossSpeckle(ctx, margin, boardSize) {
  for (let i = 0; i < 95; i += 1) {
    const angle = hash(i, 2) * Math.PI * 2;
    const edge = hash(i, 4) > .5;
    const x = edge
      ? margin - 18 + hash(i, 5) * (boardSize + 36)
      : hash(i, 6) > .5 ? margin - 14 : margin + boardSize + 14;
    const y = edge
      ? hash(i, 7) > .5 ? margin - 14 : margin + boardSize + 14
      : margin - 18 + hash(i, 8) * (boardSize + 36);
    ctx.fillStyle = `rgba(${90 + Math.floor(hash(i, 9) * 55)},${105 + Math.floor(hash(i, 10) * 55)},${55 + Math.floor(hash(i, 11) * 40)},${.08 + hash(i, 12) * .16})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 1 + hash(i, 13) * 2.4, .8 + hash(i, 14) * 1.8, angle, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawNeonCoordinates(ctx, margin, cell) {
  ctx.save();
  ctx.fillStyle = "rgba(90,233,255,.82)";
  ctx.font = "600 17px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let column = 0; column < SIZE; column += 1) {
    ctx.fillText(String(column + 1), margin + (column + .5) * cell, margin - 42);
  }
  ctx.textAlign = "right";
  for (let row = 0; row < SIZE; row += 1) {
    ctx.fillText(String.fromCharCode(65 + row), margin - 36, margin + (row + .5) * cell);
  }
  ctx.restore();
}

function drawCell(ctx, x, y, size, row, column, time) {
  const inset = theme === "garden" ? 4 : theme === "neon" ? 3 : 2;
  roundedRect(ctx, x + inset, y + inset, size - inset * 2, size - inset * 2, theme === "garden" ? 15 : 7);
  const gradient = ctx.createLinearGradient(x, y, x + size, y + size);

  if (theme === "obsidian") {
    const alternate = (row + column) % 2;
    gradient.addColorStop(0, alternate ? "#283832" : "#30433b");
    gradient.addColorStop(.55, alternate ? "#16231f" : "#1b2b25");
    gradient.addColorStop(1, "#0a1210");
  } else if (theme === "neon") {
    gradient.addColorStop(0, "rgba(12,44,63,.96)");
    gradient.addColorStop(.48, "rgba(4,21,39,.98)");
    gradient.addColorStop(1, "rgba(2,10,22,1)");
  } else {
    const tone = hash(row, column);
    gradient.addColorStop(0, tone > .5 ? "#536b52" : "#4a624b");
    gradient.addColorStop(.52, tone > .5 ? "#3a523f" : "#344b3a");
    gradient.addColorStop(1, "#273d30");
  }
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = theme === "neon"
    ? "rgba(78,226,255,.38)"
    : theme === "garden"
      ? "rgba(207,185,126,.21)"
      : "rgba(210,178,111,.28)";
  ctx.lineWidth = theme === "neon" ? 1.8 : 1.2;
  ctx.stroke();

  if (theme === "obsidian") {
    ctx.strokeStyle = "rgba(255,255,255,.038)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 13, y + size * (.22 + hash(row, column, 3) * .3));
    ctx.bezierCurveTo(x + size * .34, y + size * .15, x + size * .67, y + size * .72, x + size - 12, y + size * (.45 + hash(row, column, 4) * .24));
    ctx.stroke();
  }

  if (theme === "neon") {
    const pulse = .45 + .55 * Math.sin(time * .002 + row * 1.3 + column * .7);
    ctx.fillStyle = "rgba(88,232,255,.35)";
    ctx.globalAlpha = .22 + pulse * .2;
    ctx.fillRect(x + 9, y + 9, 4, 4);
    ctx.fillRect(x + size - 13, y + size - 13, 4, 4);
    ctx.globalAlpha = 1;
  }

  if (theme === "garden") {
    ctx.strokeStyle = "rgba(229,213,164,.055)";
    ctx.beginPath();
    ctx.moveTo(x + size * .5, y + 12);
    ctx.quadraticCurveTo(x + size * (.35 + hash(row, column) * .3), y + size * .5, x + size * .5, y + size - 12);
    ctx.stroke();
  }
}

function drawDisc(ctx, centerX, centerY, radius, player, row, column, time, scaleX = 1, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(centerX, centerY);
  ctx.scale(Math.max(.045, scaleX), 1);
  if (theme === "obsidian") drawObsidianDisc(ctx, radius, player, row, column);
  if (theme === "neon") drawNeonDisc(ctx, radius, player, row, column, time);
  if (theme === "garden") drawGardenDisc(ctx, radius, player, row, column, time);
  ctx.restore();
}

function drawObsidianDisc(ctx, radius, player, row, column) {
  ctx.shadowColor = "rgba(0,0,0,.68)";
  ctx.shadowBlur = 13;
  ctx.shadowOffsetY = 8;
  const gradient = ctx.createRadialGradient(-radius * .33, -radius * .42, radius * .08, 0, 0, radius);
  if (player === DARK) {
    gradient.addColorStop(0, "#8a8b88");
    gradient.addColorStop(.18, "#3b3d40");
    gradient.addColorStop(.58, "#111316");
    gradient.addColorStop(1, "#020305");
  } else {
    gradient.addColorStop(0, "#fffdf5");
    gradient.addColorStop(.33, "#ede3ce");
    gradient.addColorStop(.72, "#b8a98d");
    gradient.addColorStop(1, "#756957");
  }
  ctx.fillStyle = gradient;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = player === DARK ? "rgba(255,255,255,.18)" : "rgba(255,255,255,.56)";
  ctx.lineWidth = 2.1;
  ctx.stroke();
  ctx.strokeStyle = player === DARK ? "rgba(196,203,201,.1)" : "rgba(105,88,64,.18)";
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    const bend = (hash(row, column, i) - .5) * radius;
    ctx.moveTo(-radius * .66, -radius * .25 + i * radius * .22);
    ctx.bezierCurveTo(-radius * .2, bend, radius * .15, -bend * .4, radius * .72, radius * (.08 + i * .08));
    ctx.stroke();
  }
}

function drawNeonDisc(ctx, radius, player, row, column, time) {
  const color = player === DARK ? "#ff4fd8" : "#67f3ff";
  const core = player === DARK ? "#33102f" : "#0a3742";
  const pulse = .72 + .28 * Math.sin(time * .003 + row + column * .7);
  ctx.shadowColor = color;
  ctx.shadowBlur = 22 + pulse * 10;
  const gradient = ctx.createRadialGradient(-radius * .25, -radius * .3, 2, 0, 0, radius);
  gradient.addColorStop(0, "#fff");
  gradient.addColorStop(.08, color);
  gradient.addColorStop(.34, core);
  gradient.addColorStop(.76, "#07101c");
  gradient.addColorStop(1, color);
  ctx.fillStyle = gradient;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 8;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.rotate(time * .00018 * (player === DARK ? 1 : -1) + row * .1 + column * .07);
  ctx.strokeStyle = `${color}99`;
  ctx.lineWidth = 2.8;
  ctx.beginPath(); ctx.arc(0, 0, radius * .69, -.82, .82); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, radius * .69, Math.PI - .82, Math.PI + .82); ctx.stroke();
  ctx.shadowColor = "transparent";
}

function drawGardenDisc(ctx, radius, player, row, column, time) {
  ctx.shadowColor = "rgba(0,0,0,.4)";
  ctx.shadowBlur = 11;
  ctx.shadowOffsetY = 6;
  const base = ctx.createRadialGradient(-radius * .25, -radius * .3, 2, 0, 0, radius);
  if (player === DARK) {
    base.addColorStop(0, "#6a6e69");
    base.addColorStop(.22, "#353b37");
    base.addColorStop(.72, "#171b19");
    base.addColorStop(1, "#080a09");
  } else {
    base.addColorStop(0, "#fff8f1");
    base.addColorStop(.28, "#eddcd3");
    base.addColorStop(.72, "#c7a8a1");
    base.addColorStop(1, "#806863");
  }
  ctx.fillStyle = base;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = "transparent";

  ctx.save();
  ctx.rotate(hash(row, column) * Math.PI + Math.sin(time * .00035 + row) * .018);
  if (player === DARK) drawLeafMark(ctx, radius);
  else drawLotusMark(ctx, radius);
  ctx.restore();

  ctx.strokeStyle = player === DARK ? "rgba(198,187,151,.23)" : "rgba(255,255,255,.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
}

function drawLeafMark(ctx, radius) {
  ctx.strokeStyle = "rgba(181,188,166,.47)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, radius * .48);
  ctx.quadraticCurveTo(-radius * .02, 0, 0, -radius * .47);
  ctx.stroke();
  for (const direction of [-1, 1]) {
    for (let i = 0; i < 3; i += 1) {
      const y = radius * (.28 - i * .22);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(direction * radius * .34, y - radius * .12, direction * radius * .37, y - radius * .3);
      ctx.quadraticCurveTo(direction * radius * .08, y - radius * .25, 0, y);
      ctx.stroke();
    }
  }
}

function drawLotusMark(ctx, radius) {
  const petals = 7;
  for (let i = 0; i < petals; i += 1) {
    ctx.save();
    ctx.rotate((i - 3) * .28);
    ctx.fillStyle = "rgba(255,245,238,.28)";
    ctx.strokeStyle = "rgba(159,108,103,.38)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, -radius * .18, radius * .18, radius * .46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = "rgba(218,178,144,.7)";
  ctx.beginPath(); ctx.arc(0, radius * .18, radius * .1, 0, Math.PI * 2); ctx.fill();
}

function drawHints(ctx, time) {
  if (!hints || state.complete) return;
  const { margin, cell } = boardMetrics();
  for (const move of legalMoves()) {
    const x = margin + (move.column + .5) * cell;
    const y = margin + (move.row + .5) * cell;
    const hovered = hover && hover.row === move.row && hover.column === move.column;
    const pulse = .5 + .5 * Math.sin(time * .004 + move.row + move.column);
    ctx.save();
    if (theme === "obsidian") {
      ctx.strokeStyle = hovered ? "rgba(240,210,145,.95)" : `rgba(221,186,112,${.36 + pulse * .17})`;
      ctx.lineWidth = hovered ? 3.5 : 2;
      ctx.beginPath(); ctx.arc(x, y, hovered ? 20 : 12, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "rgba(238,205,135,.18)";
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
    } else if (theme === "neon") {
      const color = state.player === DARK ? "#ff5fdc" : "#5ff2ff";
      ctx.shadowColor = color;
      ctx.shadowBlur = hovered ? 26 : 14;
      ctx.strokeStyle = color;
      ctx.globalAlpha = hovered ? 1 : .45 + pulse * .2;
      ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.arc(x, y, hovered ? 23 : 14, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y); ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 7); ctx.stroke();
    } else {
      ctx.strokeStyle = hovered ? "rgba(225,196,116,.95)" : `rgba(213,184,106,${.38 + pulse * .18})`;
      ctx.lineWidth = hovered ? 3 : 1.8;
      for (let i = 0; i < 4; i += 1) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(i * Math.PI / 2 + time * .00008);
        ctx.beginPath();
        ctx.ellipse(0, -(hovered ? 13 : 9), hovered ? 6.5 : 4.5, hovered ? 13 : 9, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }
}

function drawLastMove(ctx, time) {
  if (!state.lastMove) return;
  const { margin, cell } = boardMetrics();
  const [row, column] = state.lastMove;
  const x = margin + (column + .5) * cell;
  const y = margin + (row + .5) * cell;
  ctx.save();
  ctx.strokeStyle = theme === "neon"
    ? "rgba(255,255,255,.64)"
    : theme === "garden"
      ? "rgba(221,191,113,.66)"
      : "rgba(232,204,143,.62)";
  ctx.lineWidth = 2;
  ctx.globalAlpha = .5 + Math.sin(time * .004) * .14;
  ctx.beginPath(); ctx.arc(x, y, cell * .43, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawPieces(ctx, time) {
  const { margin, cell } = boardMetrics();
  let animationProgress = 1;
  if (flipAnimation) animationProgress = Math.min(1, (time - flipAnimation.started) / flipAnimation.duration);
  for (let row = 0; row < SIZE; row += 1) {
    for (let column = 0; column < SIZE; column += 1) {
      const player = state.board[row][column];
      if (!player) continue;
      const x = margin + (column + .5) * cell;
      const y = margin + (row + .5) * cell;
      let scaleX = 1;
      let displayPlayer = player;
      if (flipAnimation) {
        const isFlip = flipAnimation.flips.some(([r, c]) => r === row && c === column);
        const isPlaced = flipAnimation.placed[0] === row && flipAnimation.placed[1] === column;
        if (isFlip) {
          scaleX = Math.abs(Math.cos(animationProgress * Math.PI));
          displayPlayer = animationProgress < .5 ? -flipAnimation.player : flipAnimation.player;
        } else if (isPlaced) {
          scaleX = Math.min(1, animationProgress * 1.35);
        }
      }
      drawDisc(ctx, x, y, cell * .36, displayPlayer, row, column, time, scaleX);
    }
  }
  if (flipAnimation && animationProgress >= 1) flipAnimation = null;
}

function draw(time) {
  context.clearRect(0, 0, 960, 960);
  drawBoardFoundation(context, time);
  drawHints(context, time);
  drawPieces(context, time);
  drawLastMove(context, time);
  if (!snapshotMode) requestAnimationFrame(draw);
}

function pointerCell(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  const { margin, boardSize, cell } = boardMetrics();
  if (x < margin || y < margin || x >= margin + boardSize || y >= margin + boardSize) return null;
  return { row: Math.floor((y - margin) / cell), column: Math.floor((x - margin) / cell) };
}

canvas.addEventListener("pointermove", (event) => { hover = pointerCell(event); });
canvas.addEventListener("pointerleave", () => { hover = null; });
canvas.addEventListener("pointerdown", (event) => {
  const cell = pointerCell(event);
  if (!cell || flipAnimation) return;
  const move = legalMoves().find((candidate) => candidate.row === cell.row && candidate.column === cell.column);
  applyMove(move);
});

document.querySelectorAll(".theme-button").forEach((button) => {
  button.addEventListener("click", () => setTheme(button.dataset.theme));
});
document.querySelector("#new-game").addEventListener("click", () => {
  state = createState();
  flipAnimation = null;
  updateUi();
});
document.querySelector("#demo-move").addEventListener("click", () => {
  if (!flipAnimation) playOneMove();
});
hintButton.addEventListener("click", () => {
  hints = !hints;
  hintButton.querySelector("span").textContent = hints ? "Hints on" : "Hints off";
  hintButton.setAttribute("aria-pressed", String(hints));
});

setTheme(theme);
setPreviewState(query.get("state") || "midgame");
requestAnimationFrame(draw);
