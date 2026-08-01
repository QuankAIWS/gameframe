const nativeFetch = window.fetch.bind(window);
const NativeWebSocket = window.WebSocket;
const processedTransitions = new Set();
const lastSeenRevisionByMatch = new Map();
const animationQueue = [];
let animationRunning = false;

function monsterMasterView(candidate) {
  return candidate?.gameId === "monster-master-duel"
    && candidate?.observation?.board?.map
    && Array.isArray(candidate?.observation?.lastEffects);
}

function transitionKey(view, effect) {
  const path = effect.path?.map((coordinate) => `${coordinate.x},${coordinate.y}`).join(";") ?? "";
  return `${view.matchId}:${view.revision}:${effect.unitId}:${path}`;
}

function captureView(view) {
  if (!monsterMasterView(view)) return;
  const previousRevision = lastSeenRevisionByMatch.get(view.matchId);
  lastSeenRevisionByMatch.set(view.matchId, view.revision);
  if (previousRevision === undefined || view.revision <= previousRevision) return;
  for (const effect of view.observation.lastEffects) {
    if (effect.type !== "unit-moved" || !effect.path?.length) continue;
    const key = transitionKey(view, effect);
    if (processedTransitions.has(key)) continue;
    processedTransitions.add(key);
    animationQueue.push({ view, effect });
  }
  void runAnimationQueue();
}

window.fetch = async (...args) => {
  const response = await nativeFetch(...args);
  try {
    const clone = response.clone();
    const contentType = clone.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) captureView(await clone.json());
  } catch {
    // Presentation capture never changes the authoritative request path.
  }
  return response;
};

if (NativeWebSocket) {
  class MotionAwareWebSocket extends NativeWebSocket {
    constructor(...args) {
      super(...args);
      this.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message?.type === "match_state") captureView(message.view);
        } catch {
          // Ignore non-state projection messages.
        }
      });
    }
  }
  window.WebSocket = MotionAwareWebSocket;
}

function readDiagnostics() {
  try {
    return JSON.parse(document.querySelector("#monster-master-details")?.textContent || "{}");
  } catch {
    return {};
  }
}

async function waitForRenderedRevision(revision) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (Number(readDiagnostics().revision) === Number(revision)) return true;
  }
  return false;
}

function ensureMotionCanvas() {
  const frame = document.querySelector(".combat-canvas-frame");
  const primary = document.querySelector("#monster-master-canvas");
  if (!frame || !primary) return null;
  let overlay = frame.querySelector("#monster-master-motion-canvas");
  if (!overlay) {
    overlay = document.createElement("canvas");
    overlay.id = "monster-master-motion-canvas";
    overlay.setAttribute("aria-hidden", "true");
    frame.append(overlay);
  }
  return { frame, primary, overlay };
}

function configureCanvas(canvas, width, height) {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return context;
}

function terrainColor(cell, coordinate) {
  if (cell.terrain === "wall") return "#101620";
  if (cell.terrain === "difficult") return (coordinate.x + coordinate.y) % 2 ? "#4c5042" : "#45493d";
  if (cell.terrain === "objective") return "#6f5630";
  return (coordinate.x + coordinate.y) % 2 ? "#263751" : "#223149";
}

function layoutFor(view, width, height) {
  const bounds = readDiagnostics().viewport?.bounds;
  if (!bounds) return null;
  const cellSize = Math.min(width / bounds.columns, height / bounds.rows);
  return {
    bounds,
    cellSize,
    originX: (width - cellSize * bounds.columns) / 2,
    originY: (height - cellSize * bounds.rows) / 2,
    map: view.observation.board.map,
  };
}

function screenCenter(coordinate, layout) {
  return {
    x: layout.originX + (coordinate.x - layout.bounds.x + 0.5) * layout.cellSize,
    y: layout.originY + (coordinate.y - layout.bounds.y + 0.5) * layout.cellSize,
  };
}

function visible(coordinate, bounds) {
  return coordinate.x >= bounds.x
    && coordinate.y >= bounds.y
    && coordinate.x < bounds.x + bounds.columns
    && coordinate.y < bounds.y + bounds.rows;
}

function redrawDestination(context, coordinate, layout) {
  if (!visible(coordinate, layout.bounds)) return;
  const cell = layout.map.cells[coordinate.y * layout.map.width + coordinate.x];
  const x = layout.originX + (coordinate.x - layout.bounds.x) * layout.cellSize;
  const y = layout.originY + (coordinate.y - layout.bounds.y) * layout.cellSize;
  context.fillStyle = terrainColor(cell, coordinate);
  context.fillRect(x, y, layout.cellSize, layout.cellSize);
  if (cell.terrain === "difficult") {
    context.fillStyle = "rgba(204, 220, 172, .12)";
    for (let offset = 0.18; offset < 1; offset += 0.3) {
      context.fillRect(
        x + layout.cellSize * offset,
        y + layout.cellSize * 0.12,
        Math.max(1, layout.cellSize * 0.05),
        layout.cellSize * 0.76,
      );
    }
  }
  if (cell.terrain === "wall") {
    context.fillStyle = "rgba(117, 137, 166, .24)";
    context.fillRect(
      x + layout.cellSize * 0.12,
      y + layout.cellSize * 0.12,
      layout.cellSize * 0.76,
      layout.cellSize * 0.76,
    );
  }
  context.strokeStyle = "rgba(178, 202, 240, .12)";
  context.lineWidth = 1;
  context.strokeRect(x + 0.5, y + 0.5, layout.cellSize - 1, layout.cellSize - 1);
}

function drawUnitShape(context, unit, x, y, radius) {
  context.beginPath();
  if (unit.role === "master") {
    context.rect(x - radius * 0.8, y - radius * 0.8, radius * 1.6, radius * 1.6);
  } else if (unit.role === "emberling") {
    context.moveTo(x, y - radius);
    context.lineTo(x + radius, y);
    context.lineTo(x, y + radius);
    context.lineTo(x - radius, y);
    context.closePath();
  } else {
    context.arc(x, y, radius, 0, Math.PI * 2);
  }
}

function drawMovingUnit(context, view, unit, position, layout, lift) {
  const alpha = unit.ownerId === view.playerIds[0];
  const radius = layout.cellSize * 0.31;
  const scale = 1 + lift * 0.08;
  context.save();
  context.translate(position.x, position.y - lift * layout.cellSize * 0.15);
  context.scale(scale, scale);
  context.shadowColor = alpha ? "rgba(78, 164, 255, .65)" : "rgba(255, 92, 139, .6)";
  context.shadowBlur = layout.cellSize * (0.1 + lift * 0.14);
  context.fillStyle = alpha ? "#2f79c9" : "#b33e62";
  drawUnitShape(context, unit, 0, 0, radius);
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = "#eaf7ff";
  context.lineWidth = Math.max(2, layout.cellSize * 0.05);
  context.stroke();
  context.fillStyle = "#ffffff";
  context.font = `900 ${Math.max(10, layout.cellSize * 0.2)}px system-ui`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(unit.role === "master" ? "M" : unit.role === "bulwark" ? "B" : "E", 0, 0);
  context.restore();
}

function interpolatePath(path, progress, layout) {
  const segmentCount = path.length - 1;
  const scaled = Math.min(segmentCount - Number.EPSILON, Math.max(0, progress * segmentCount));
  const segment = Math.min(segmentCount - 1, Math.floor(scaled));
  const local = scaled - segment;
  const from = screenCenter(path[segment], layout);
  const to = screenCenter(path[segment + 1], layout);
  return {
    x: from.x + (to.x - from.x) * local,
    y: from.y + (to.y - from.y) * local,
    lift: Math.sin(local * Math.PI),
  };
}

async function animateMovement(view, effect) {
  if (!await waitForRenderedRevision(view.revision)) return;
  const elements = ensureMotionCanvas();
  if (!elements) return;
  const { frame, primary, overlay } = elements;
  const rect = primary.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const layout = layoutFor(view, width, height);
  if (!layout) return;

  const path = [effect.from, ...effect.path];
  const unit = view.observation.board.units.find((candidate) => candidate.id === effect.unitId);
  if (!unit || path.length < 2) return;

  primary.dataset.lastAnimationSteps = String(path.length - 1);
  primary.dispatchEvent(new CustomEvent("gameframe:monster-animation", {
    bubbles: true,
    detail: { unitId: effect.unitId, path: path.map((coordinate) => ({ ...coordinate })) },
  }));
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const overlayContext = configureCanvas(overlay, width, height);
  const staticCanvas = document.createElement("canvas");
  const staticContext = configureCanvas(staticCanvas, width, height);
  staticContext.drawImage(primary, 0, 0, width, height);
  redrawDestination(staticContext, effect.to, layout);

  overlay.hidden = false;
  frame.dataset.animating = "true";
  primary.style.visibility = "hidden";
  const duration = Math.min(1700, Math.max(300, (path.length - 1) * 145));
  const started = performance.now();

  try {
    await new Promise((resolve) => {
      function frameStep(now) {
        const progress = Math.min(1, (now - started) / duration);
        const position = interpolatePath(path, progress, layout);
        overlayContext.clearRect(0, 0, width, height);
        overlayContext.drawImage(staticCanvas, 0, 0, width, height);
        drawMovingUnit(overlayContext, view, unit, position, layout, position.lift);
        if (progress < 1) requestAnimationFrame(frameStep);
        else resolve();
      }
      requestAnimationFrame(frameStep);
    });
  } finally {
    primary.style.visibility = "";
    frame.dataset.animating = "false";
    overlayContext.clearRect(0, 0, width, height);
    overlay.hidden = true;
  }
}

async function runAnimationQueue() {
  if (animationRunning) return;
  animationRunning = true;
  try {
    while (animationQueue.length) {
      const transition = animationQueue.shift();
      await animateMovement(transition.view, transition.effect);
    }
  } finally {
    animationRunning = false;
  }
}
