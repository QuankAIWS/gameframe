const SIZE = 8;
const DARK = 1;
const LIGHT = -1;
const EMPTY = 0;
const directions = [-1, 0, 1].flatMap((dr) => [-1, 0, 1].map((dc) => [dr, dc])).filter(([dr, dc]) => dr || dc);

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

const themeInfo = {
  obsidian: {
    title: "Obsidian & Ivory",
    description: "Carved stone, polished mineral discs, restrained highlights, and deliberate physical weight.",
  },
  neon: {
    title: "Neon Circuit",
    description: "A live circuit lattice where captures propagate as current and pieces invert their polarity.",
  },
  garden: {
    title: "Living Garden",
    description: "A moss-framed water garden of seed pods, floating pollen, ripples, veins, and seasonal transformation.",
  },
};

let theme = new URLSearchParams(location.search).get("theme") || "obsidian";
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

function inside(row, column) { return row >= 0 && row < SIZE && column >= 0 && column < SIZE; }

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
  state.board.flat().forEach((cell) => { if (cell === DARK) dark += 1; if (cell === LIGHT) light += 1; });
  return { dark, light };
}

function applyMove(move, animate = true) {
  if (!move || state.complete) return false;
  const before = state.player;
  state.board[move.row][move.column] = before;
  move.flips.forEach(([row, column]) => { state.board[row][column] = before; });
  state.lastMove = [move.row, move.column];
  state.move += 1;
  state.player = -before;
  if (legalMoves().length === 0) {
    state.player = before;
    if (legalMoves().length === 0) state.complete = true;
  }
  if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    flipAnimation = { started: performance.now(), placed: [move.row, move.column], flips: move.flips, player: before, duration: 520 };
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
  return legalMoves().sort((a, b) => (weights[b.row][b.column] + b.flips.length * 3) - (weights[a.row][a.column] + a.flips.length * 3) || a.row - b.row || a.column - b.column)[0];
}

function playOneMove(animate = true) { applyMove(selectComputerMove(), animate); }

function setPreviewState(name) {
  state = createState();
  const moves = name === "late" ? 48 : name === "midgame" ? 27 : 0;
  for (let index = 0; index < moves && !state.complete; index += 1) playOneMove(false);
  flipAnimation = null;
  updateUi();
}

function updateUi() {
  const score = scores();
  const legal = legalMoves();
  darkScore.textContent = score.dark;
  lightScore.textContent = score.light;
  moveNumber.textContent = `${state.move} / 60`;
  legalCount.textContent = state.complete ? "—" : String(legal.length);
  darkTurn.classList.toggle("is-active", !state.complete && state.player === DARK);
  lightTurn.classList.toggle("is-active", !state.complete && state.player === LIGHT);
  darkTurn.textContent = !state.complete && state.player === DARK ? "ACTIVE" : "WAITING";
  lightTurn.textContent = !state.complete && state.player === LIGHT ? "ACTIVE" : "WAITING";
  if (state.complete) {
    const result = score.dark === score.light ? "The field rests in balance" : `${score.dark > score.light ? "Dark" : "Light"} commands the final field`;
    turnCopy.textContent = result;
    announcement.textContent = result;
    announcement.hidden = false;
  } else {
    turnCopy.textContent = state.player === DARK ? "Dark shapes the field" : "Light answers the pattern";
    announcement.hidden = true;
  }
}

function setTheme(nextTheme) {
  theme = themeInfo[nextTheme] ? nextTheme : "obsidian";
  document.body.dataset.theme = theme;
  document.querySelectorAll(".theme-button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.theme === theme)));
  themeTitle.textContent = themeInfo[theme].title;
  themeDescription.textContent = themeInfo[theme].description;
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

function drawObsidianBackground(ctx, time) {
  const gradient = ctx.createRadialGradient(480, 360, 100, 480, 480, 680);
  gradient.addColorStop(0, "#473c31");
  gradient.addColorStop(.48, "#201c1a");
  gradient.addColorStop(1, "#08090b");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 960, 960);
  ctx.strokeStyle = "rgba(231,206,155,.08)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 18; i += 1) {
    ctx.beginPath();
    const y = 80 + i * 48 + Math.sin(time * .00015 + i) * 4;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(250, y - 14, 650, y + 19, 960, y - 3);
    ctx.stroke();
  }
}

function drawNeonBackground(ctx, time) {
  const gradient = ctx.createRadialGradient(480, 480, 80, 480, 480, 680);
  gradient.addColorStop(0, "#102a47");
  gradient.addColorStop(.52, "#061324");
  gradient.addColorStop(1, "#02050a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 960, 960);
  ctx.save();
  ctx.strokeStyle = "rgba(59,221,255,.12)";
  ctx.lineWidth = 2;
  for (let x = 32; x < 960; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 960); ctx.stroke();
  }
  for (let y = 32; y < 960; y += 64) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(960, y); ctx.stroke();
  }
  const sweep = (time * .12) % 1200 - 120;
  const sweepGradient = ctx.createLinearGradient(0, sweep - 70, 0, sweep + 70);
  sweepGradient.addColorStop(0, "rgba(73,229,255,0)");
  sweepGradient.addColorStop(.5, "rgba(73,229,255,.13)");
  sweepGradient.addColorStop(1, "rgba(73,229,255,0)");
  ctx.fillStyle = sweepGradient;
  ctx.fillRect(0, sweep - 70, 960, 140);
  ctx.restore();
}

function drawGardenBackground(ctx, time) {
  const gradient = ctx.createRadialGradient(420, 400, 80, 480, 480, 700);
  gradient.addColorStop(0, "#45634a");
  gradient.addColorStop(.48, "#1d3828");
  gradient.addColorStop(1, "#08140e");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 960, 960);
  for (let i = 0; i < 42; i += 1) {
    const x = hash(i, 1) * 960;
    const y = (hash(i, 2) * 960 + time * (3 + hash(i, 4) * 4) * .01) % 1040 - 40;
    const size = 1.5 + hash(i, 3) * 3;
    ctx.fillStyle = `rgba(241,219,125,${.08 + hash(i, 7) * .18})`;
    ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
  }
}

function boardMetrics() { return { margin: 70, boardSize: 820, cell: 102.5 }; }

function drawBoardFoundation(ctx, time) {
  const { margin, boardSize, cell } = boardMetrics();
  ctx.save();
  if (theme === "obsidian") drawObsidianBackground(ctx, time);
  if (theme === "neon") drawNeonBackground(ctx, time);
  if (theme === "garden") drawGardenBackground(ctx, time);

  ctx.shadowColor = theme === "neon" ? "rgba(35,220,255,.26)" : "rgba(0,0,0,.65)";
  ctx.shadowBlur = theme === "neon" ? 38 : 28;
  ctx.shadowOffsetY = 18;
  roundedRect(ctx, margin - 20, margin - 20, boardSize + 40, boardSize + 40, 35);
  const frameGradient = ctx.createLinearGradient(margin, margin, margin + boardSize, margin + boardSize);
  if (theme === "obsidian") { frameGradient.addColorStop(0, "#a88f68"); frameGradient.addColorStop(.15, "#493b2d"); frameGradient.addColorStop(.75, "#171311"); frameGradient.addColorStop(1, "#806848"); }
  if (theme === "neon") { frameGradient.addColorStop(0, "#1b5771"); frameGradient.addColorStop(.4, "#07192b"); frameGradient.addColorStop(1, "#123955"); }
  if (theme === "garden") { frameGradient.addColorStop(0, "#667b46"); frameGradient.addColorStop(.35, "#263b28"); frameGradient.addColorStop(1, "#14271a"); }
  ctx.fillStyle = frameGradient;
  ctx.fill();
  ctx.shadowColor = "transparent";

  for (let row = 0; row < SIZE; row += 1) {
    for (let column = 0; column < SIZE; column += 1) {
      const x = margin + column * cell;
      const y = margin + row * cell;
      drawCell(ctx, x, y, cell, row, column, time);
    }
  }
  ctx.restore();
}

function drawCell(ctx, x, y, size, row, column, time) {
  const inset = theme === "garden" ? 4 : 2;
  roundedRect(ctx, x + inset, y + inset, size - inset * 2, size - inset * 2, theme === "garden" ? 16 : 7);
  const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
  if (theme === "obsidian") {
    const alternate = (row + column) % 2;
    gradient.addColorStop(0, alternate ? "#2d3834" : "#33433d");
    gradient.addColorStop(.55, alternate ? "#17221f" : "#1e2d28");
    gradient.addColorStop(1, "#0e1513");
  } else if (theme === "neon") {
    gradient.addColorStop(0, "rgba(16,54,74,.9)");
    gradient.addColorStop(.5, "rgba(5,22,40,.95)");
    gradient.addColorStop(1, "rgba(3,12,24,.98)");
  } else {
    const tone = hash(row, column);
    gradient.addColorStop(0, tone > .5 ? "#4c6846" : "#405d41");
    gradient.addColorStop(.55, tone > .5 ? "#2b4935" : "#294331");
    gradient.addColorStop(1, "#1b3125");
  }
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = theme === "neon" ? "rgba(85,225,255,.18)" : theme === "garden" ? "rgba(184,216,137,.13)" : "rgba(219,203,161,.09)";
  ctx.lineWidth = theme === "neon" ? 2 : 1.2;
  ctx.stroke();

  if (theme === "obsidian") {
    ctx.strokeStyle = "rgba(255,255,255,.045)";
    ctx.beginPath();
    ctx.moveTo(x + 14, y + size * (.2 + hash(row, column, 3) * .4));
    ctx.bezierCurveTo(x + size * .35, y + size * .15, x + size * .66, y + size * .75, x + size - 12, y + size * (.45 + hash(row, column, 4) * .3));
    ctx.stroke();
  }
  if (theme === "neon") {
    ctx.fillStyle = "rgba(88,232,255,.22)";
    const pulse = .5 + .5 * Math.sin(time * .002 + row * 1.3 + column * .7);
    ctx.globalAlpha = .25 + pulse * .28;
    ctx.fillRect(x + 9, y + 9, 5, 5);
    ctx.fillRect(x + size - 14, y + size - 14, 5, 5);
    ctx.globalAlpha = 1;
  }
  if (theme === "garden") {
    ctx.strokeStyle = "rgba(184,217,143,.08)";
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
  ctx.shadowColor = "rgba(0,0,0,.65)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 8;
  const gradient = ctx.createRadialGradient(-radius*.33, -radius*.42, radius*.08, 0, 0, radius);
  if (player === DARK) { gradient.addColorStop(0, "#777876"); gradient.addColorStop(.22, "#303236"); gradient.addColorStop(.65, "#111216"); gradient.addColorStop(1, "#020306"); }
  else { gradient.addColorStop(0, "#fffdf4"); gradient.addColorStop(.35, "#e7dcc2"); gradient.addColorStop(.76, "#b5a68b"); gradient.addColorStop(1, "#716653"); }
  ctx.fillStyle = gradient;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI*2); ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = player === DARK ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.55)";
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.strokeStyle = player === DARK ? "rgba(189,197,197,.11)" : "rgba(111,93,68,.18)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    const bend = (hash(row, column, i) - .5) * radius;
    ctx.moveTo(-radius*.65, -radius*.25 + i*radius*.22);
    ctx.bezierCurveTo(-radius*.2, bend, radius*.15, -bend*.4, radius*.72, radius*(.08 + i*.08));
    ctx.stroke();
  }
}

function drawNeonDisc(ctx, radius, player, row, column, time) {
  const color = player === DARK ? "#ff4fd8" : "#67f3ff";
  const core = player === DARK ? "#32102e" : "#0a3540";
  const pulse = .7 + .3 * Math.sin(time*.003 + row + column*.7);
  ctx.shadowColor = color;
  ctx.shadowBlur = 22 + pulse*10;
  const gradient = ctx.createRadialGradient(-radius*.24,-radius*.3,2,0,0,radius);
  gradient.addColorStop(0, "#ffffff"); gradient.addColorStop(.09, color); gradient.addColorStop(.38, core); gradient.addColorStop(.78, "#07101d"); gradient.addColorStop(1, color);
  ctx.fillStyle = gradient;
  ctx.beginPath(); ctx.arc(0,0,radius,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur = 8;
  ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.rotate(time*.00018 * (player === DARK ? 1 : -1) + row*.1 + column*.07);
  ctx.strokeStyle = `${color}99`;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0,0,radius*.68,-.8,.8); ctx.stroke();
  ctx.beginPath(); ctx.arc(0,0,radius*.68,Math.PI-.8,Math.PI+.8); ctx.stroke();
  ctx.shadowColor = "transparent";
}

function drawGardenDisc(ctx, radius, player, row, column, time) {
  ctx.shadowColor = "rgba(0,0,0,.38)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 6;
  const base = ctx.createRadialGradient(-radius*.25,-radius*.3,2,0,0,radius);
  if (player === DARK) { base.addColorStop(0,"#9fbd71"); base.addColorStop(.26,"#4b6b42"); base.addColorStop(.75,"#213c2d"); base.addColorStop(1,"#102219"); }
  else { base.addColorStop(0,"#ffe8a9"); base.addColorStop(.32,"#d98a9e"); base.addColorStop(.76,"#8e465f"); base.addColorStop(1,"#54283b"); }
  ctx.fillStyle = base; ctx.beginPath(); ctx.arc(0,0,radius,0,Math.PI*2); ctx.fill();
  ctx.shadowColor = "transparent";
  const petals = player === DARK ? 6 : 8;
  ctx.save();
  ctx.rotate(hash(row,column)*Math.PI + Math.sin(time*.0005+row)*.025);
  for (let i=0;i<petals;i+=1) {
    ctx.rotate(Math.PI*2/petals);
    ctx.fillStyle = player === DARK ? "rgba(183,213,126,.24)" : "rgba(255,219,174,.28)";
    ctx.beginPath(); ctx.ellipse(0,-radius*.42,radius*.18,radius*.38,0,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = player === DARK ? "#d8cf76" : "#f4d477";
  ctx.beginPath(); ctx.arc(0,0,radius*.16,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.17)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0,0,radius,0,Math.PI*2); ctx.stroke();
}

function drawHints(ctx, time) {
  if (!hints || state.complete) return;
  const { margin, cell } = boardMetrics();
  for (const move of legalMoves()) {
    const x = margin + (move.column + .5) * cell;
    const y = margin + (move.row + .5) * cell;
    const hovered = hover && hover.row === move.row && hover.column === move.column;
    const pulse = .5 + .5 * Math.sin(time*.004 + move.row + move.column);
    ctx.save();
    if (theme === "obsidian") {
      ctx.strokeStyle = hovered ? "rgba(242,210,143,.9)" : `rgba(230,199,137,${.3 + pulse*.18})`;
      ctx.lineWidth = hovered ? 4 : 2.4;
      ctx.beginPath(); ctx.arc(x,y,hovered?21:15,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle = "rgba(242,210,143,.17)"; ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fill();
    } else if (theme === "neon") {
      const color = state.player === DARK ? "#ff5fdc" : "#5ff2ff";
      ctx.shadowColor = color; ctx.shadowBlur = hovered ? 28 : 15;
      ctx.strokeStyle = color; ctx.globalAlpha = hovered ? 1 : .38 + pulse*.25;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x,y,hovered?24:15,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x-8,y); ctx.lineTo(x+8,y); ctx.moveTo(x,y-8); ctx.lineTo(x,y+8); ctx.stroke();
    } else {
      ctx.strokeStyle = hovered ? "rgba(244,215,117,.95)" : `rgba(218,211,121,${.35 + pulse*.18})`;
      ctx.lineWidth = hovered ? 3.4 : 2;
      for (let i=0;i<4;i+=1) {
        ctx.save(); ctx.translate(x,y); ctx.rotate(i*Math.PI/2 + time*.00012); ctx.beginPath(); ctx.ellipse(0,-(hovered?14:10),hovered?7:5,hovered?14:10,0,0,Math.PI*2); ctx.stroke(); ctx.restore();
      }
    }
    ctx.restore();
  }
}

function drawLastMove(ctx, time) {
  if (!state.lastMove) return;
  const { margin, cell } = boardMetrics();
  const [row,column] = state.lastMove;
  const x = margin + (column+.5)*cell;
  const y = margin + (row+.5)*cell;
  ctx.save();
  ctx.strokeStyle = theme === "neon" ? "rgba(255,255,255,.62)" : theme === "garden" ? "rgba(244,215,117,.65)" : "rgba(238,213,158,.6)";
  ctx.lineWidth = 2;
  ctx.globalAlpha = .5 + Math.sin(time*.004)*.15;
  ctx.beginPath(); ctx.arc(x,y,44,0,Math.PI*2); ctx.stroke();
  ctx.restore();
}

function drawPieces(ctx, time) {
  const { margin, cell } = boardMetrics();
  let animationProgress = 1;
  if (flipAnimation) animationProgress = Math.min(1, (time - flipAnimation.started) / flipAnimation.duration);
  for (let row=0; row<SIZE; row+=1) {
    for (let column=0; column<SIZE; column+=1) {
      const player = state.board[row][column];
      if (!player) continue;
      const x = margin + (column+.5)*cell;
      const y = margin + (row+.5)*cell;
      let scaleX = 1;
      let displayPlayer = player;
      if (flipAnimation) {
        const isFlip = flipAnimation.flips.some(([r,c]) => r===row && c===column);
        const isPlaced = flipAnimation.placed[0]===row && flipAnimation.placed[1]===column;
        if (isFlip) {
          scaleX = Math.abs(Math.cos(animationProgress*Math.PI));
          displayPlayer = animationProgress < .5 ? -flipAnimation.player : flipAnimation.player;
        } else if (isPlaced) {
          scaleX = Math.min(1, animationProgress*1.35);
        }
      }
      drawDisc(ctx,x,y,cell*.36,displayPlayer,row,column,time,scaleX);
    }
  }
  if (flipAnimation && animationProgress >= 1) flipAnimation = null;
}

function draw(time) {
  context.clearRect(0,0,960,960);
  drawBoardFoundation(context,time);
  drawHints(context,time);
  drawPieces(context,time);
  drawLastMove(context,time);
  requestAnimationFrame(draw);
}

function pointerCell(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  const { margin, boardSize, cell } = boardMetrics();
  if (x < margin || y < margin || x >= margin + boardSize || y >= margin + boardSize) return null;
  return { row: Math.floor((y-margin)/cell), column: Math.floor((x-margin)/cell) };
}

canvas.addEventListener("pointermove", (event) => { hover = pointerCell(event); });
canvas.addEventListener("pointerleave", () => { hover = null; });
canvas.addEventListener("pointerdown", (event) => {
  const cell = pointerCell(event);
  if (!cell || flipAnimation) return;
  const move = legalMoves().find((candidate) => candidate.row === cell.row && candidate.column === cell.column);
  applyMove(move);
});

document.querySelectorAll(".theme-button").forEach((button) => button.addEventListener("click", () => setTheme(button.dataset.theme)));
document.querySelector("#new-game").addEventListener("click", () => { state = createState(); flipAnimation = null; updateUi(); });
document.querySelector("#demo-move").addEventListener("click", () => { if (!flipAnimation) playOneMove(); });
hintButton.addEventListener("click", () => { hints = !hints; hintButton.textContent = hints ? "Hints on" : "Hints off"; hintButton.setAttribute("aria-pressed", String(hints)); });

setTheme(theme);
setPreviewState(new URLSearchParams(location.search).get("state") || "midgame");
requestAnimationFrame(draw);
