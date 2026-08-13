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

let renderFrame = null;

function requestRender() {
  if (renderFrame !== null) return;
  renderFrame = requestAnimationFrame(draw);
}

function draw(time) {
  renderFrame = null;
  context.clearRect(0, 0, 960, 960);
  drawBoardFoundation(context, time);
  drawHints(context, time);
  drawPieces(context, time);
  drawLastMove(context, time);

  // The board used to redraw at display refresh rate forever. That made the
  // Neon theme continuously repaint a 960x960 canvas full of gradients,
  // shadows, and glows even while idle. Only the short disc-flip animation
  // needs a continuous frame loop; all other states render on demand.
  if (!snapshotMode && flipAnimation) requestRender();
}

const renderObserver = new MutationObserver(requestRender);
renderObserver.observe(document.querySelector(".othello-app"), {
  subtree: true,
  childList: true,
  characterData: true,
  attributes: true,
  attributeFilter: ["class", "hidden", "aria-pressed"],
});

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

canvas.addEventListener("pointermove", (event) => {
  const nextHover = pointerCell(event);
  if (nextHover?.row === hover?.row && nextHover?.column === hover?.column) return;
  hover = nextHover;
  requestRender();
});
canvas.addEventListener("pointerleave", () => {
  if (!hover) return;
  hover = null;
  requestRender();
});
canvas.addEventListener("pointerdown", (event) => {
  const cell = pointerCell(event);
  if (!cell || flipAnimation) return;
  const move = legalMoves().find((candidate) => candidate.row === cell.row && candidate.column === cell.column);
  applyMove(move);
  requestRender();
});

document.querySelectorAll(".theme-button").forEach((button) => {
  button.addEventListener("click", () => {
    setTheme(button.dataset.theme);
    requestRender();
  });
});
document.querySelector("#new-game").addEventListener("click", () => {
  state = createState();
  flipAnimation = null;
  updateUi();
  requestRender();
});
document.querySelector("#demo-move").addEventListener("click", () => {
  if (!flipAnimation) playOneMove();
  requestRender();
});
hintButton.addEventListener("click", () => {
  hints = !hints;
  hintButton.querySelector("span").textContent = hints ? "Hints on" : "Hints off";
  hintButton.setAttribute("aria-pressed", String(hints));
  requestRender();
});

setTheme(theme);
setPreviewState(query.get("state") || "start");
requestRender();

if (!document.head.querySelector('link[href="/othello-game-menu.css"]')) {
  const menuStyles = document.createElement("link");
  menuStyles.rel = "stylesheet";
  menuStyles.href = "/othello-game-menu.css";
  document.head.append(menuStyles);
}
void import("./othello-launcher.js").then(() => {
  // `state=` is the fidelity/visual-preview surface used by regression tests
  // and design review. Keep its demo controls available instead of mounting
  // the normal player game menu over them.
  if (query.has("state")) return;
  const gameMenuScript = document.createElement("script");
  gameMenuScript.src = "/othello-game-menu.js";
  document.body.append(gameMenuScript);
});