const gameId = "tactical-combat-canary";
const gameFrameBotPlayerId = "gameframe-bot";
const playerStorageKey = "scribbles-gameframe.player-id";
const recentMatchStorageKey = "scribbles-gameframe.recent-combat-match";

const lobby = document.querySelector("#combat-lobby");
const lobbyMessage = document.querySelector("#combat-lobby-message");
const challengeBot = document.querySelector("#combat-bot");
const createHumanMatch = document.querySelector("#combat-human");
const matchPanel = document.querySelector("#combat-match");
const status = document.querySelector("#combat-status");
const revision = document.querySelector("#combat-revision");
const revisionSmall = document.querySelector("#combat-revision-small");
const roundLabel = document.querySelector("#combat-round");
const activeUnitLabel = document.querySelector("#combat-active-unit");
const connectionLabel = document.querySelector("#combat-connection");
const moveBudget = document.querySelector("#combat-move-budget");
const attackBudget = document.querySelector("#combat-attack-budget");
const alphaCard = document.querySelector("#combat-player-alpha");
const betaCard = document.querySelector("#combat-player-beta");
const alphaName = document.querySelector("#combat-alpha-name");
const betaName = document.querySelector("#combat-beta-name");
const rosterList = document.querySelector("#combat-roster-list");
const canvas = document.querySelector("#combat-canvas");
const context = canvas.getContext("2d");
const help = document.querySelector("#combat-help");
const options = document.querySelector("#combat-options");
const effects = document.querySelector("#combat-effects");
const errorBanner = document.querySelector("#combat-error");
const invitePanel = document.querySelector("#combat-invite-panel");
const inviteLink = document.querySelector("#combat-invite-link");
const copyInvite = document.querySelector("#combat-copy-invite");
const newMatch = document.querySelector("#combat-new-match");
const selectMove = document.querySelector("#combat-select-move");
const selectAttack = document.querySelector("#combat-select-attack");
const endActivation = document.querySelector("#combat-end-activation");
const centerActive = document.querySelector("#combat-center-active");
const centerField = document.querySelector("#combat-center-field");
const zoomIn = document.querySelector("#combat-zoom-in");
const zoomOut = document.querySelector("#combat-zoom-out");
const details = document.querySelector("#combat-details");
const panButtons = [...document.querySelectorAll("[data-combat-pan-x][data-combat-pan-y]")];

const urlState = new URLSearchParams(window.location.search);
const explicitPlayerId = normalizeIdentity(urlState.get("player"));
const playerId = explicitPlayerId ?? getOrCreatePlayerId();

let current = null;
let requestPending = false;
let selectedUnitId = null;
let actionMode = null;
let previewAction = null;
let realtimeEnabled = false;
let socket = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
let pollTimer = null;
let lastCanvasLayout = null;
let lastActiveUnitId = null;
let viewport = {
  centerX: 11.5,
  centerY: 11.5,
  baseColumns: 12,
  baseRows: 9,
  zoom: 1,
  minimumZoom: 0.75,
  maximumZoom: 2,
};

function normalizeIdentity(value) {
  const normalized = value?.trim();
  return normalized && normalized.length <= 120 ? normalized : null;
}

function getOrCreatePlayerId() {
  const existing = normalizeIdentity(localStorage.getItem(playerStorageKey));
  if (existing) return existing;
  const created = `browser-${crypto.randomUUID()}`;
  localStorage.setItem(playerStorageKey, created);
  return created;
}

function displayName(id) {
  if (id === gameFrameBotPlayerId) return "ArenaBot";
  if (id === playerId) return "You";
  return "Opponent";
}

function activePlayerId(view = current) {
  return view?.observation.activePlayerId ?? null;
}

function activeUnit(view = current) {
  const id = view?.observation.activeUnitId;
  return id ? view.observation.board.units.find((unit) => unit.id === id) ?? null : null;
}

function unitLabel(unitOrId) {
  const id = typeof unitOrId === "string" ? unitOrId : unitOrId?.id;
  if (!id) return "—";
  const team = id.startsWith("alpha-") ? "Blue" : "Red";
  const role = id.endsWith("vanguard") ? "Vanguard" : id.endsWith("ranger") ? "Ranger" : id;
  return `${team} ${role}`;
}

function coordinateKey(coordinate) {
  return `${coordinate.x},${coordinate.y}`;
}

function legalActions(type) {
  return current?.observation.legalActions.filter((action) => action.type === type) ?? [];
}

function actionDestination(action) {
  return action.type === "move" ? action.path.at(-1) : action.type === "attack" ? action.target : null;
}

function statusText(view = current) {
  if (!view) return "No combat match is active.";
  const observation = view.observation;
  if (observation.status.draw) return "The combat ended in a draw.";
  if (observation.status.winnerPlayerId) {
    return observation.status.winnerPlayerId === playerId
      ? "Your team won the skirmish."
      : `${displayName(observation.status.winnerPlayerId)} won the skirmish.`;
  }
  if (observation.activePlayerId !== playerId) {
    return `${displayName(observation.activePlayerId)} is resolving ${unitLabel(observation.activeUnitId)}.`;
  }
  if (actionMode === "move") return "Choose a highlighted movement destination.";
  if (actionMode === "attack") return legalActions("attack").length
    ? "Choose a highlighted enemy target."
    : "No enemy is currently in legal line of sight.";
  return `Your activation: ${unitLabel(observation.activeUnitId)}.`;
}

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.hidden = false;
}

function clearError() {
  errorBanner.textContent = "";
  errorBanner.hidden = true;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function visibleSize(map) {
  return {
    columns: Math.min(map.width, Math.max(1, Math.ceil(viewport.baseColumns / viewport.zoom))),
    rows: Math.min(map.height, Math.max(1, Math.ceil(viewport.baseRows / viewport.zoom))),
  };
}

function visibleBounds(map) {
  const size = visibleSize(map);
  return {
    x: clamp(Math.round(viewport.centerX - (size.columns - 1) / 2), 0, map.width - size.columns),
    y: clamp(Math.round(viewport.centerY - (size.rows - 1) / 2), 0, map.height - size.rows),
    ...size,
  };
}

function clampViewport() {
  if (!current) return;
  const map = current.observation.board.map;
  viewport.zoom = clamp(viewport.zoom, viewport.minimumZoom, viewport.maximumZoom);
  const bounds = visibleBounds(map);
  viewport.centerX = bounds.x + (bounds.columns - 1) / 2;
  viewport.centerY = bounds.y + (bounds.rows - 1) / 2;
}

function centerViewport(coordinate) {
  viewport.centerX = coordinate.x;
  viewport.centerY = coordinate.y;
  clampViewport();
  drawScene();
}

function panViewport(deltaX, deltaY) {
  if (!current) return;
  viewport.centerX += deltaX;
  viewport.centerY += deltaY;
  clampViewport();
  drawScene();
}

function changeZoom(delta) {
  if (!current) return;
  viewport.zoom = clamp(viewport.zoom + delta, viewport.minimumZoom, viewport.maximumZoom);
  clampViewport();
  drawScene();
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.round(canvas.clientWidth));
  const height = Math.max(280, Math.round(canvas.clientHeight));
  const pixelWidth = Math.round(width * ratio);
  const pixelHeight = Math.round(height * ratio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { width, height };
}

function layoutCanvas(map) {
  const canvasSize = resizeCanvas();
  const bounds = visibleBounds(map);
  const cellSize = Math.min(canvasSize.width / bounds.columns, canvasSize.height / bounds.rows);
  const boardWidth = cellSize * bounds.columns;
  const boardHeight = cellSize * bounds.rows;
  return {
    bounds,
    cellSize,
    originX: (canvasSize.width - boardWidth) / 2,
    originY: (canvasSize.height - boardHeight) / 2,
    width: canvasSize.width,
    height: canvasSize.height,
  };
}

function screenPosition(coordinate, layout) {
  return {
    x: layout.originX + (coordinate.x - layout.bounds.x) * layout.cellSize,
    y: layout.originY + (coordinate.y - layout.bounds.y) * layout.cellSize,
  };
}

function isVisible(coordinate, bounds) {
  return coordinate.x >= bounds.x
    && coordinate.y >= bounds.y
    && coordinate.x < bounds.x + bounds.columns
    && coordinate.y < bounds.y + bounds.rows;
}

function cellAt(map, coordinate) {
  return map.cells[coordinate.y * map.width + coordinate.x];
}

function terrainColor(cell, coordinate) {
  if (cell.terrain === "wall") return "#101620";
  if (cell.terrain === "difficult") return (coordinate.x + coordinate.y) % 2 ? "#4c5042" : "#45493d";
  if (cell.terrain === "objective") return "#6f5630";
  return (coordinate.x + coordinate.y) % 2 ? "#263751" : "#223149";
}

function drawGrid(view, layout) {
  const map = view.observation.board.map;
  context.fillStyle = "#080c14";
  context.fillRect(0, 0, layout.width, layout.height);
  for (let y = layout.bounds.y; y < layout.bounds.y + layout.bounds.rows; y += 1) {
    for (let x = layout.bounds.x; x < layout.bounds.x + layout.bounds.columns; x += 1) {
      const coordinate = { x, y };
      const cell = cellAt(map, coordinate);
      const screen = screenPosition(coordinate, layout);
      context.fillStyle = terrainColor(cell, coordinate);
      context.fillRect(screen.x, screen.y, layout.cellSize, layout.cellSize);
      if (cell.terrain === "difficult") {
        context.fillStyle = "rgba(204, 220, 172, .12)";
        for (let offset = 0.18; offset < 1; offset += 0.3) {
          context.fillRect(
            screen.x + layout.cellSize * offset,
            screen.y + layout.cellSize * 0.12,
            Math.max(1, layout.cellSize * 0.05),
            layout.cellSize * 0.76,
          );
        }
      }
      if (cell.terrain === "wall") {
        context.fillStyle = "rgba(117, 137, 166, .24)";
        context.fillRect(
          screen.x + layout.cellSize * 0.12,
          screen.y + layout.cellSize * 0.12,
          layout.cellSize * 0.76,
          layout.cellSize * 0.76,
        );
      }
      context.strokeStyle = "rgba(178, 202, 240, .12)";
      context.lineWidth = 1;
      context.strokeRect(screen.x + 0.5, screen.y + 0.5, layout.cellSize - 1, layout.cellSize - 1);
    }
  }
}

function drawMoveTargets(layout) {
  if (actionMode !== "move") return;
  for (const action of legalActions("move")) {
    const destination = actionDestination(action);
    if (!destination || !isVisible(destination, layout.bounds)) continue;
    const screen = screenPosition(destination, layout);
    context.fillStyle = "rgba(112, 216, 255, .30)";
    context.beginPath();
    context.arc(
      screen.x + layout.cellSize / 2,
      screen.y + layout.cellSize / 2,
      layout.cellSize * 0.25,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
}

function drawPreview(layout) {
  if (!previewAction) return;
  if (previewAction.type === "move") {
    const coordinates = [previewAction.from, ...previewAction.path]
      .filter((coordinate) => isVisible(coordinate, layout.bounds));
    if (coordinates.length < 2) return;
    context.strokeStyle = "rgba(255, 207, 110, .95)";
    context.lineWidth = Math.max(3, layout.cellSize * 0.09);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    coordinates.forEach((coordinate, index) => {
      const screen = screenPosition(coordinate, layout);
      const x = screen.x + layout.cellSize / 2;
      const y = screen.y + layout.cellSize / 2;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
  } else if (previewAction.type === "attack") {
    if (!isVisible(previewAction.from, layout.bounds) || !isVisible(previewAction.target, layout.bounds)) return;
    const from = screenPosition(previewAction.from, layout);
    const target = screenPosition(previewAction.target, layout);
    context.strokeStyle = "rgba(255, 104, 145, .95)";
    context.lineWidth = Math.max(3, layout.cellSize * 0.07);
    context.setLineDash([Math.max(5, layout.cellSize * 0.14), Math.max(4, layout.cellSize * 0.1)]);
    context.beginPath();
    context.moveTo(from.x + layout.cellSize / 2, from.y + layout.cellSize / 2);
    context.lineTo(target.x + layout.cellSize / 2, target.y + layout.cellSize / 2);
    context.stroke();
    context.setLineDash([]);
  }
}

function drawUnits(view, layout) {
  const attackTargets = new Set(legalActions("attack").map((action) => action.targetUnitId));
  for (const unit of view.observation.board.units) {
    if (!isVisible(unit.position, layout.bounds)) continue;
    const screen = screenPosition(unit.position, layout);
    const centerX = screen.x + layout.cellSize / 2;
    const centerY = screen.y + layout.cellSize / 2;
    const radius = layout.cellSize * 0.31;
    const alpha = unit.ownerId === view.playerIds[0];
    const active = unit.id === view.observation.activeUnitId;
    const selected = unit.id === selectedUnitId;
    const targetable = actionMode === "attack" && attackTargets.has(unit.id);

    context.save();
    context.shadowColor = alpha ? "rgba(78, 164, 255, .65)" : "rgba(255, 92, 139, .6)";
    context.shadowBlur = active ? layout.cellSize * 0.28 : layout.cellSize * 0.1;
    context.fillStyle = alpha ? "#2f79c9" : "#b33e62";
    context.beginPath();
    if (unit.role === "ranger") {
      context.moveTo(centerX, centerY - radius);
      context.lineTo(centerX + radius, centerY + radius * 0.82);
      context.lineTo(centerX - radius, centerY + radius * 0.82);
      context.closePath();
    } else {
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    }
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = targetable ? "#ff7fa5" : selected ? "#ffd06e" : active ? "#eaf7ff" : "rgba(255,255,255,.5)";
    context.lineWidth = targetable || selected ? Math.max(4, layout.cellSize * 0.08) : Math.max(2, layout.cellSize * 0.05);
    context.stroke();

    context.fillStyle = "#ffffff";
    context.font = `900 ${Math.max(10, layout.cellSize * 0.22)}px system-ui`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(unit.role === "ranger" ? "R" : "V", centerX, centerY);

    const barWidth = layout.cellSize * 0.72;
    const barHeight = Math.max(4, layout.cellSize * 0.07);
    const barX = centerX - barWidth / 2;
    const barY = screen.y + layout.cellSize * 0.82;
    context.fillStyle = "rgba(5, 8, 14, .86)";
    context.fillRect(barX, barY, barWidth, barHeight);
    context.fillStyle = unit.health / unit.maxHealth > 0.45 ? "#6ee0a5" : "#ff9a75";
    context.fillRect(barX, barY, barWidth * (unit.health / unit.maxHealth), barHeight);
    context.restore();
  }
}

function drawCoordinates(layout) {
  if (layout.cellSize < 46) return;
  context.fillStyle = "rgba(217, 230, 255, .3)";
  context.font = `${Math.max(9, layout.cellSize * 0.12)}px ui-monospace, monospace`;
  context.textAlign = "left";
  context.textBaseline = "top";
  for (let y = layout.bounds.y; y < layout.bounds.y + layout.bounds.rows; y += 1) {
    for (let x = layout.bounds.x; x < layout.bounds.x + layout.bounds.columns; x += 1) {
      const screen = screenPosition({ x, y }, layout);
      context.fillText(`${x},${y}`, screen.x + 4, screen.y + 3);
    }
  }
}

function drawScene() {
  if (!current) return;
  const layout = layoutCanvas(current.observation.board.map);
  lastCanvasLayout = layout;
  drawGrid(current, layout);
  drawMoveTargets(layout);
  drawPreview(layout);
  drawUnits(current, layout);
  drawCoordinates(layout);
  details.textContent = JSON.stringify({
    gameId,
    matchId: current.matchId,
    playerId,
    revision: current.revision,
    round: current.observation.round,
    activePlayerId: activePlayerId(),
    activeUnitId: current.observation.activeUnitId,
    selectedUnitId,
    actionMode,
    legalActionCount: current.observation.legalActions.length,
    defeatedUnitIds: current.observation.defeatedUnitIds,
    viewport: { centerX: viewport.centerX, centerY: viewport.centerY, zoom: viewport.zoom, bounds: layout.bounds },
  }, null, 2);
}

function renderOptions() {
  options.replaceChildren();
  if (!current || requestPending || activePlayerId() !== playerId || !actionMode) return;
  const actions = legalActions(actionMode);
  for (const action of actions.slice(0, 24)) {
    const destination = actionDestination(action);
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.actionKind = action.type;
    button.dataset.preview = String(previewAction === action);
    if (action.type === "move") {
      button.dataset.destination = coordinateKey(destination);
      button.textContent = `${destination.x},${destination.y} · move ${action.movementCost}`;
    } else {
      button.dataset.targetUnitId = action.targetUnitId;
      button.textContent = `${unitLabel(action.targetUnitId)} · ${action.damage} damage · range ${action.range}`;
    }
    button.addEventListener("mouseenter", () => {
      previewAction = action;
      drawScene();
    });
    button.addEventListener("focus", () => {
      previewAction = action;
      drawScene();
    });
    button.addEventListener("click", () => submitAction(action));
    options.append(button);
  }
  if (actions.length === 0) {
    const note = document.createElement("span");
    note.className = "muted";
    note.textContent = actionMode === "attack" ? "No legal targets in range and line of sight." : "No legal movement destinations.";
    options.append(note);
  } else if (actions.length > 24) {
    const note = document.createElement("span");
    note.className = "muted";
    note.textContent = `+${actions.length - 24} more legal actions available on the battlefield`;
    options.append(note);
  }
}

function renderRoster(view) {
  rosterList.replaceChildren();
  const units = [...view.observation.board.units].sort((left, right) => (
    right.initiative - left.initiative || left.id.localeCompare(right.id)
  ));
  const known = new Map(units.map((unit) => [unit.id, unit]));
  const allIds = ["alpha-vanguard", "beta-vanguard", "alpha-ranger", "beta-ranger"];
  for (const unitId of allIds) {
    const unit = known.get(unitId);
    const item = document.createElement("div");
    item.className = "combat-roster-unit";
    item.classList.toggle("is-active", unitId === view.observation.activeUnitId);
    item.classList.toggle("is-defeated", !unit);
    const dot = document.createElement("span");
    dot.className = `combat-team-dot ${unitId.startsWith("alpha-") ? "alpha" : "beta"}`;
    const name = document.createElement("strong");
    name.textContent = unitLabel(unitId);
    const health = document.createElement("span");
    health.className = "combat-roster-health";
    health.textContent = unit ? `${unit.health}/${unit.maxHealth} · I${unit.initiative}` : "defeated";
    item.append(dot, name, health);
    rosterList.append(item);
  }
}

function effectText(effect) {
  if (effect.type === "unit-moved") return `${unitLabel(effect.unitId)} moved to ${coordinateKey(effect.to)}`;
  if (effect.type === "unit-damaged") return `${unitLabel(effect.targetUnitId)} took ${effect.damage} damage`;
  if (effect.type === "unit-defeated") return `${unitLabel(effect.targetUnitId)} defeated`;
  if (effect.type === "activation-ended") return `${unitLabel(effect.unitId)} ended activation`;
  if (effect.type === "round-started") return `Round ${effect.round} started`;
  return effect.draw ? "Combat ended in a draw" : "Combat victory resolved";
}

function renderEffects(view) {
  effects.replaceChildren();
  for (const effect of view.observation.lastEffects) {
    const item = document.createElement("span");
    item.className = `combat-effect ${effect.type === "unit-damaged" ? "damage" : effect.type === "unit-defeated" ? "defeat" : effect.type === "combat-completed" ? "victory" : ""}`;
    item.textContent = effectText(effect);
    effects.append(item);
  }
}

function renderPlayers(view) {
  const [alphaId, betaId] = view.playerIds;
  alphaName.textContent = displayName(alphaId);
  betaName.textContent = displayName(betaId);
  alphaCard.classList.toggle("is-active", activePlayerId(view) === alphaId);
  betaCard.classList.toggle("is-active", activePlayerId(view) === betaId);
  alphaCard.classList.toggle("is-you", alphaId === playerId);
  betaCard.classList.toggle("is-you", betaId === playerId);
}

function buildInvite(view) {
  if (view.playerIds.includes(gameFrameBotPlayerId) || view.playerIds[0] !== playerId) return null;
  const invitedPlayer = view.playerIds[1];
  const url = new URL(window.location.href);
  url.searchParams.set("match", view.matchId);
  url.searchParams.set("player", invitedPlayer);
  return url.toString();
}

function renderInvite(view) {
  const invite = buildInvite(view);
  invitePanel.hidden = !invite;
  inviteLink.value = invite ?? "";
}

function updateActionControls() {
  const canAct = Boolean(current)
    && !requestPending
    && current.observation.status.lifecycle === "active"
    && activePlayerId() === playerId;
  const canMove = canAct && current.observation.movementAvailable && legalActions("move").length > 0;
  const canAttack = canAct && current.observation.primaryActionAvailable;
  selectMove.disabled = !canMove;
  selectAttack.disabled = !canAttack;
  endActivation.disabled = !canAct || !legalActions("end-activation").length;
  selectMove.setAttribute("aria-pressed", String(actionMode === "move"));
  selectAttack.setAttribute("aria-pressed", String(actionMode === "attack"));
}

function render(view) {
  const previous = current;
  const changed = !previous || previous.matchId !== view.matchId || previous.revision !== view.revision;
  current = view;
  if (changed) {
    selectedUnitId = activePlayerId(view) === playerId ? view.observation.activeUnitId : null;
    actionMode = null;
    previewAction = null;
    const nextActive = activeUnit(view);
    if (!previous || previous.matchId !== view.matchId || nextActive?.id !== lastActiveUnitId) {
      if (nextActive) centerViewport(nextActive.position);
    }
    lastActiveUnitId = nextActive?.id ?? null;
  }

  lobby.hidden = true;
  matchPanel.hidden = false;
  clearError();
  status.textContent = statusText(view);
  revision.textContent = `Revision ${view.revision}`;
  revisionSmall.textContent = String(view.revision);
  roundLabel.textContent = String(view.observation.round);
  activeUnitLabel.textContent = unitLabel(view.observation.activeUnitId);
  connectionLabel.textContent = realtimeEnabled
    ? (socket?.readyState === WebSocket.OPEN ? "Live connection" : "Connecting…")
    : "HTTP refresh";
  moveBudget.textContent = view.observation.movementAvailable ? "Available" : "Used";
  attackBudget.textContent = view.observation.primaryActionAvailable ? "Available" : "Used";
  renderPlayers(view);
  renderRoster(view);
  renderEffects(view);
  renderInvite(view);
  updateActionControls();
  renderOptions();
  drawScene();
  persistMatch(view.matchId);
  updateUrl(view.matchId);
  startProjection(view.matchId);
}

function setBusy(busy) {
  requestPending = busy;
  challengeBot.disabled = busy;
  createHumanMatch.disabled = busy;
  newMatch.disabled = busy;
  for (const button of panButtons) button.disabled = busy;
  centerActive.disabled = busy;
  centerField.disabled = busy;
  zoomIn.disabled = busy;
  zoomOut.disabled = busy;
  updateActionControls();
  renderOptions();
  drawScene();
}

async function request(url, requestOptions = {}) {
  const response = await fetch(url, {
    ...requestOptions,
    headers: {
      "content-type": "application/json",
      "x-gameframe-player-id": playerId,
      ...(requestOptions.headers ?? {}),
    },
  });
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : { message: await response.text() };
  if (!response.ok) {
    const error = new Error(body.message ?? body.error ?? `Request failed with ${response.status}.`);
    error.code = body.error;
    error.revision = body.revision;
    throw error;
  }
  return body;
}

function updateUrl(matchId, identity = playerId) {
  const url = new URL(window.location.href);
  if (matchId) {
    url.searchParams.set("match", matchId);
    url.searchParams.set("player", identity);
  } else {
    url.searchParams.delete("match");
    url.searchParams.delete("player");
  }
  history.replaceState({}, "", url);
}

function persistMatch(matchId) {
  if (!explicitPlayerId) localStorage.setItem(recentMatchStorageKey, matchId);
}

function clearRecentMatch() {
  if (!explicitPlayerId) localStorage.removeItem(recentMatchStorageKey);
}

async function createMatch(opponentId) {
  stopProjection();
  clearError();
  lobbyMessage.textContent = "Creating the authoritative combat encounter…";
  setBusy(true);
  try {
    render(await request("/api/matches", {
      method: "POST",
      body: JSON.stringify({ gameId, playerIds: [playerId, opponentId] }),
    }));
  } catch (error) {
    showError(error.message);
    lobbyMessage.textContent = "Combat match creation failed.";
  } finally {
    setBusy(false);
  }
}

async function loadMatch(matchId) {
  clearError();
  lobbyMessage.textContent = "Resuming combat match…";
  setBusy(true);
  try {
    const view = await request(`/api/matches/${encodeURIComponent(matchId)}`);
    if (view.gameId !== gameId) throw new Error("That match is not the tactical combat canary.");
    render(view);
  } catch (error) {
    clearRecentMatch();
    updateUrl(null);
    showError(error.message);
    lobby.hidden = false;
    matchPanel.hidden = true;
    lobbyMessage.textContent = "That combat match could not be resumed with this seat.";
  } finally {
    setBusy(false);
  }
}

async function submitAction(action) {
  if (!current || requestPending) return;
  clearError();
  actionMode = null;
  previewAction = null;
  status.textContent = action.type === "attack" ? "Committing the attack…" : action.type === "move" ? "Committing the movement path…" : "Ending the activation…";
  setBusy(true);
  try {
    render(await request(`/api/matches/${encodeURIComponent(current.matchId)}/actions`, {
      method: "POST",
      body: JSON.stringify({
        actionId: crypto.randomUUID(),
        expectedRevision: current.revision,
        action,
      }),
    }));
  } catch (error) {
    showError(error.message);
    if (error.code === "stale_revision") await refreshCurrent({ quiet: true });
    else status.textContent = error.message;
  } finally {
    setBusy(false);
  }
}

function selectMode(mode) {
  if (!current || requestPending || activePlayerId() !== playerId) return;
  selectedUnitId = current.observation.activeUnitId;
  actionMode = actionMode === mode ? null : mode;
  previewAction = actionMode ? legalActions(actionMode)[0] ?? null : null;
  status.textContent = statusText();
  help.textContent = actionMode === "move"
    ? "Cyan cells are legal destinations. Gold shows the canonical path."
    : actionMode === "attack"
      ? "Red outlines are legal targets. The dashed line is the authoritative shot."
      : "Select Move, Attack, or End activation.";
  updateActionControls();
  renderOptions();
  drawScene();
}

function canvasCoordinate(event) {
  if (!current || !lastCanvasLayout) return null;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const layout = lastCanvasLayout;
  const column = Math.floor((x - layout.originX) / layout.cellSize);
  const row = Math.floor((y - layout.originY) / layout.cellSize);
  if (column < 0 || row < 0 || column >= layout.bounds.columns || row >= layout.bounds.rows) return null;
  return { x: layout.bounds.x + column, y: layout.bounds.y + row };
}

function actionAt(coordinate) {
  if (!actionMode) return null;
  return legalActions(actionMode).find((action) => {
    const destination = actionDestination(action);
    return destination?.x === coordinate.x && destination?.y === coordinate.y;
  }) ?? null;
}

function handleCanvasClick(event) {
  if (!current || requestPending) return;
  const coordinate = canvasCoordinate(event);
  if (!coordinate) return;
  const clickedUnit = current.observation.board.units.find(
    (unit) => unit.position.x === coordinate.x && unit.position.y === coordinate.y,
  );
  if (clickedUnit?.id === current.observation.activeUnitId && clickedUnit.ownerId === playerId) {
    selectedUnitId = clickedUnit.id;
    if (!actionMode) actionMode = current.observation.movementAvailable ? "move" : "attack";
    previewAction = legalActions(actionMode)[0] ?? null;
    status.textContent = statusText();
    updateActionControls();
    renderOptions();
    drawScene();
    return;
  }
  const action = actionAt(coordinate);
  if (action) void submitAction(action);
}

function handleCanvasMove(event) {
  if (!actionMode || requestPending) return;
  const coordinate = canvasCoordinate(event);
  const next = coordinate ? actionAt(coordinate) : null;
  if (next !== previewAction) {
    previewAction = next;
    drawScene();
  }
}

async function refreshCurrent({ quiet = false } = {}) {
  if (!current) return;
  try {
    const view = await request(`/api/matches/${encodeURIComponent(current.matchId)}`);
    if (!current || view.revision >= current.revision) render(view);
  } catch (error) {
    if (!quiet) showError(error.message);
  }
}

async function detectRuntime() {
  try {
    const health = await request("/api/health");
    realtimeEnabled = health.realtime === "websocket-hibernation";
  } catch {
    realtimeEnabled = false;
  }
}

function stopProjection() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (pollTimer) clearInterval(pollTimer);
  reconnectTimer = null;
  pollTimer = null;
  reconnectAttempt = 0;
  if (socket) {
    socket.onclose = null;
    socket.close();
  }
  socket = null;
}

function scheduleReconnect(matchId) {
  if (!realtimeEnabled || !current || current.matchId !== matchId || current.observation.status.lifecycle !== "active") return;
  const delay = Math.min(1000 * (2 ** reconnectAttempt), 15_000);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => connectRealtime(matchId), delay);
}

function connectRealtime(matchId) {
  if (!realtimeEnabled || !current || current.matchId !== matchId) return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  const url = new URL(`/api/matches/${encodeURIComponent(matchId)}/events`, location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(url);
  socket.onopen = () => {
    reconnectAttempt = 0;
    connectionLabel.textContent = "Live connection";
    socket.send(JSON.stringify({ type: "refresh" }));
  };
  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === "match_state" && message.view.matchId === matchId) {
        if (!current || message.view.revision >= current.revision) render(message.view);
      }
    } catch {
      // Projection errors never change authoritative client state.
    }
  };
  socket.onclose = () => {
    socket = null;
    connectionLabel.textContent = "Reconnecting…";
    scheduleReconnect(matchId);
  };
  socket.onerror = () => socket?.close();
}

function startProjection(matchId) {
  if (!current || current.matchId !== matchId) return;
  if (realtimeEnabled) {
    if (!socket) connectRealtime(matchId);
  } else if (!pollTimer) {
    pollTimer = setInterval(() => refreshCurrent({ quiet: true }), 1200);
  }
}

challengeBot.addEventListener("click", () => createMatch(gameFrameBotPlayerId));
createHumanMatch.addEventListener("click", () => createMatch(`guest-${crypto.randomUUID()}`));
selectMove.addEventListener("click", () => selectMode("move"));
selectAttack.addEventListener("click", () => selectMode("attack"));
endActivation.addEventListener("click", () => {
  const action = legalActions("end-activation")[0];
  if (action) void submitAction(action);
});
newMatch.addEventListener("click", () => {
  stopProjection();
  current = null;
  selectedUnitId = null;
  actionMode = null;
  previewAction = null;
  clearRecentMatch();
  updateUrl(null);
  matchPanel.hidden = true;
  lobby.hidden = false;
  lobbyMessage.textContent = "Choose an opponent for a new combat match.";
});
copyInvite.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(inviteLink.value);
    copyInvite.textContent = "Copied";
    setTimeout(() => { copyInvite.textContent = "Copy invite"; }, 1200);
  } catch {
    inviteLink.select();
  }
});
for (const button of panButtons) {
  button.addEventListener("click", () => panViewport(Number(button.dataset.combatPanX), Number(button.dataset.combatPanY)));
}
centerActive.addEventListener("click", () => {
  const unit = activeUnit();
  if (unit) centerViewport(unit.position);
});
centerField.addEventListener("click", () => centerViewport({ x: 11.5, y: 11.5 }));
zoomIn.addEventListener("click", () => changeZoom(0.25));
zoomOut.addEventListener("click", () => changeZoom(-0.25));
canvas.addEventListener("click", handleCanvasClick);
canvas.addEventListener("pointermove", handleCanvasMove);
canvas.addEventListener("pointerleave", () => {
  if (previewAction) {
    previewAction = null;
    drawScene();
  }
});
canvas.addEventListener("keydown", (event) => {
  const controls = {
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
  };
  if (controls[event.key]) {
    event.preventDefault();
    panViewport(...controls[event.key]);
  } else if (event.key.toLowerCase() === "m") {
    event.preventDefault();
    selectMode("move");
  } else if (event.key.toLowerCase() === "a") {
    event.preventDefault();
    selectMode("attack");
  }
});
window.addEventListener("resize", drawScene);
window.addEventListener("beforeunload", stopProjection);

await detectRuntime();
const requestedMatch = urlState.get("match") ?? (!explicitPlayerId ? localStorage.getItem(recentMatchStorageKey) : null);
if (requestedMatch) await loadMatch(requestedMatch);
else lobbyMessage.textContent = "Choose an opponent to begin the four-unit combat canary.";
