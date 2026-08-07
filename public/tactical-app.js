const gameId = "tactical-movement-canary";
const gameFrameBotPlayerId = "gameframe-bot";
const playerStorageKey = "scribbles-gameframe.player-id";
const recentMatchStorageKey = "scribbles-gameframe.recent-tactical-match";

const lobby = document.querySelector("#tactical-lobby");
const lobbyMessage = document.querySelector("#tactical-lobby-message");
const challengeBot = document.querySelector("#tactical-bot");
const createHumanMatch = document.querySelector("#tactical-human");
const matchPanel = document.querySelector("#tactical-match");
const status = document.querySelector("#tactical-status");
const revision = document.querySelector("#tactical-revision");
const roundLabel = document.querySelector("#tactical-round");
const matchIdLabel = document.querySelector("#tactical-match-id");
const connectionLabel = document.querySelector("#tactical-connection");
const viewportLabel = document.querySelector("#tactical-viewport-label");
const alphaCard = document.querySelector("#tactical-player-alpha");
const betaCard = document.querySelector("#tactical-player-beta");
const alphaName = document.querySelector("#tactical-alpha-name");
const betaName = document.querySelector("#tactical-beta-name");
const canvas = document.querySelector("#tactical-canvas");
const context = canvas.getContext("2d");
const help = document.querySelector("#tactical-help");
const destinations = document.querySelector("#tactical-destinations");
const errorBanner = document.querySelector("#tactical-error");
const invitePanel = document.querySelector("#tactical-invite-panel");
const inviteLink = document.querySelector("#tactical-invite-link");
const copyInvite = document.querySelector("#tactical-copy-invite");
const newMatch = document.querySelector("#tactical-new-match");
const centerActive = document.querySelector("#tactical-center-active");
const centerObjective = document.querySelector("#tactical-center-objective");
const zoomIn = document.querySelector("#tactical-zoom-in");
const zoomOut = document.querySelector("#tactical-zoom-out");
const details = document.querySelector("#tactical-details");
const panButtons = [...document.querySelectorAll("[data-pan-x][data-pan-y]")];

const urlState = new URLSearchParams(window.location.search);
const explicitPlayerId = normalizeIdentity(urlState.get("player"));
const playerId = explicitPlayerId ?? getOrCreatePlayerId();

let current = null;
let requestPending = false;
let selectedUnitId = null;
let previewAction = null;
let invitePlayerId = null;
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

function objectiveCoordinate(view = current) {
  if (!view) return { x: 12, y: 12 };
  const map = view.observation.board.map;
  const index = map.cells.findIndex((cell) => cell.objectiveId === view.observation.objectiveId);
  return index >= 0 ? { x: index % map.width, y: Math.floor(index / map.width) } : { x: 12, y: 12 };
}

function coordinateKey(coordinate) {
  return `${coordinate.x},${coordinate.y}`;
}

function actionDestination(action) {
  return action.type === "move" ? action.path.at(-1) : null;
}

function legalMoveActions(view = current) {
  return view?.observation.legalActions.filter((action) => action.type === "move") ?? [];
}

function selectedActions() {
  return selectedUnitId
    ? legalMoveActions().filter((action) => action.unitId === selectedUnitId)
    : [];
}

function statusText(view = current) {
  if (!view) return "No tactical match is active.";
  const observation = view.observation;
  if (observation.status.draw) return "The movement canary ended in a draw.";
  if (observation.status.winnerPlayerId) {
    return observation.status.winnerPlayerId === playerId
      ? "You reached the central beacon. Match complete."
      : `${displayName(observation.status.winnerPlayerId)} reached the central beacon. Match complete.`;
  }
  if (observation.activePlayerId === playerId) {
    return selectedUnitId
      ? "Choose a highlighted destination for the active unit."
      : "Your activation. Select your active unit.";
  }
  return `${displayName(observation.activePlayerId)} is moving.`;
}

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.hidden = false;
}

function clearError() {
  errorBanner.textContent = "";
  errorBanner.hidden = true;
}

function setBusy(busy) {
  requestPending = busy;
  challengeBot.disabled = busy;
  createHumanMatch.disabled = busy;
  newMatch.disabled = busy;
  for (const button of panButtons) button.disabled = busy;
  centerActive.disabled = busy;
  centerObjective.disabled = busy;
  zoomIn.disabled = busy;
  zoomOut.disabled = busy;
  draw();
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-gameframe-player-id": playerId,
      ...(options.headers ?? {}),
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

function buildInvite(view) {
  if (view.playerIds.includes(gameFrameBotPlayerId) || view.playerIds[0] !== playerId) return null;
  const invitedPlayer = view.playerIds[1];
  const url = new URL(window.location.href);
  url.searchParams.set("match", view.matchId);
  url.searchParams.set("player", invitedPlayer);
  return { url: url.toString(), playerId: invitedPlayer };
}

function renderInvite(view) {
  const invite = buildInvite(view);
  invitePlayerId = invite?.playerId ?? null;
  invitePanel.hidden = !invite;
  inviteLink.value = invite?.url ?? "";
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
  draw();
}

function panViewport(deltaX, deltaY) {
  if (!current) return;
  viewport.centerX += deltaX;
  viewport.centerY += deltaY;
  clampViewport();
  draw();
}

function changeZoom(delta) {
  if (!current) return;
  viewport.zoom = clamp(viewport.zoom + delta, viewport.minimumZoom, viewport.maximumZoom);
  clampViewport();
  draw();
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

function cellAt(map, coordinate) {
  return map.cells[coordinate.y * map.width + coordinate.x];
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

function terrainColor(cell, coordinate) {
  if (cell.terrain === "wall") return "#101620";
  if (cell.terrain === "difficult") return (coordinate.x + coordinate.y) % 2 ? "#4c5042" : "#45493d";
  if (cell.terrain === "objective") return "#8e6d35";
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
      if (cell.terrain === "objective") {
        const centerX = screen.x + layout.cellSize / 2;
        const centerY = screen.y + layout.cellSize / 2;
        const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, layout.cellSize * 0.55);
        gradient.addColorStop(0, "rgba(255, 232, 154, .9)");
        gradient.addColorStop(0.35, "rgba(255, 193, 79, .48)");
        gradient.addColorStop(1, "rgba(255, 193, 79, 0)");
        context.fillStyle = gradient;
        context.fillRect(screen.x, screen.y, layout.cellSize, layout.cellSize);
      }

      context.strokeStyle = "rgba(178, 202, 240, .12)";
      context.lineWidth = 1;
      context.strokeRect(screen.x + 0.5, screen.y + 0.5, layout.cellSize - 1, layout.cellSize - 1);
    }
  }
}

function drawLegalDestinations(layout) {
  if (!selectedUnitId) return;
  for (const action of selectedActions()) {
    const destination = actionDestination(action);
    if (!destination || !isVisible(destination, layout.bounds)) continue;
    const screen = screenPosition(destination, layout);
    const centerX = screen.x + layout.cellSize / 2;
    const centerY = screen.y + layout.cellSize / 2;
    context.fillStyle = "rgba(112, 216, 255, .30)";
    context.beginPath();
    context.arc(centerX, centerY, layout.cellSize * 0.28, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(151, 231, 255, .9)";
    context.lineWidth = Math.max(2, layout.cellSize * 0.04);
    context.stroke();
  }
}

function drawPreviewPath(layout) {
  if (!previewAction || previewAction.type !== "move") return;
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
}

function drawUnits(view, layout) {
  for (const unit of view.observation.board.units) {
    if (!isVisible(unit.position, layout.bounds)) continue;
    const screen = screenPosition(unit.position, layout);
    const centerX = screen.x + layout.cellSize / 2;
    const centerY = screen.y + layout.cellSize / 2;
    const radius = layout.cellSize * 0.32;
    const isAlpha = unit.id === "unit-alpha";
    const active = unit.id === view.observation.activeUnitId;
    const selected = unit.id === selectedUnitId;

    context.save();
    context.shadowColor = isAlpha ? "rgba(78, 164, 255, .65)" : "rgba(255, 92, 139, .6)";
    context.shadowBlur = active ? layout.cellSize * 0.3 : layout.cellSize * 0.12;
    context.fillStyle = isAlpha ? "#2f79c9" : "#b33e62";
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = selected ? "#ffd06e" : active ? "#eaf7ff" : "rgba(255,255,255,.5)";
    context.lineWidth = selected ? Math.max(4, layout.cellSize * 0.08) : Math.max(2, layout.cellSize * 0.05);
    context.stroke();
    context.fillStyle = "#ffffff";
    context.font = `900 ${Math.max(12, layout.cellSize * 0.28)}px system-ui`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(isAlpha ? "A" : "B", centerX, centerY);
    context.restore();
  }
}

function drawCoordinates(layout) {
  if (layout.cellSize < 44) return;
  context.fillStyle = "rgba(217, 230, 255, .34)";
  context.font = `${Math.max(9, layout.cellSize * 0.13)}px ui-monospace, monospace`;
  context.textAlign = "left";
  context.textBaseline = "top";
  for (let y = layout.bounds.y; y < layout.bounds.y + layout.bounds.rows; y += 1) {
    for (let x = layout.bounds.x; x < layout.bounds.x + layout.bounds.columns; x += 1) {
      const screen = screenPosition({ x, y }, layout);
      context.fillText(`${x},${y}`, screen.x + 4, screen.y + 3);
    }
  }
}

function draw() {
  if (!current) return;
  const layout = layoutCanvas(current.observation.board.map);
  lastCanvasLayout = layout;
  drawGrid(current, layout);
  drawLegalDestinations(layout);
  drawPreviewPath(layout);
  drawUnits(current, layout);
  drawCoordinates(layout);

  viewportLabel.textContent = `${layout.bounds.columns}×${layout.bounds.rows} at ${layout.bounds.x},${layout.bounds.y} · ${viewport.zoom.toFixed(2)}×`;
  renderDestinationButtons();
  details.textContent = JSON.stringify({
    gameId,
    matchId: current.matchId,
    playerId,
    revision: current.revision,
    round: current.observation.round,
    activePlayerId: activePlayerId(),
    activeUnitId: current.observation.activeUnitId,
    selectedUnitId,
    previewDestination: previewAction ? actionDestination(previewAction) : null,
    legalActionCount: current.observation.legalActions.length,
    viewport: {
      centerX: viewport.centerX,
      centerY: viewport.centerY,
      zoom: viewport.zoom,
      bounds: layout.bounds,
    },
  }, null, 2);
}

function renderDestinationButtons() {
  destinations.replaceChildren();
  if (!selectedUnitId || activePlayerId() !== playerId || requestPending) return;
  const actions = [...selectedActions()].sort((left, right) => {
    const leftDestination = actionDestination(left);
    const rightDestination = actionDestination(right);
    return left.movementCost - right.movementCost
      || leftDestination.y - rightDestination.y
      || leftDestination.x - rightDestination.x;
  });
  for (const action of actions.slice(0, 18)) {
    const destination = actionDestination(action);
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.destination = coordinateKey(destination);
    button.dataset.preview = String(previewAction === action);
    button.textContent = `${destination.x},${destination.y} · ${action.movementCost}`;
    button.addEventListener("mouseenter", () => {
      previewAction = action;
      draw();
    });
    button.addEventListener("focus", () => {
      previewAction = action;
      draw();
    });
    button.addEventListener("click", () => submitAction(action));
    destinations.append(button);
  }
  if (actions.length > 18) {
    const note = document.createElement("span");
    note.className = "muted";
    note.textContent = `+${actions.length - 18} more destinations available on the map`;
    destinations.append(note);
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

function render(view) {
  const previous = current;
  const changed = !previous || previous.matchId !== view.matchId || previous.revision !== view.revision;
  current = view;
  if (changed) {
    selectedUnitId = null;
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
  roundLabel.textContent = String(view.observation.round);
  matchIdLabel.textContent = view.matchId;
  connectionLabel.textContent = realtimeEnabled
    ? (socket?.readyState === WebSocket.OPEN ? "Live connection" : "Connecting…")
    : "HTTP refresh";
  renderPlayers(view);
  renderInvite(view);
  persistMatch(view.matchId);
  updateUrl(view.matchId);
  draw();
  startProjection(view.matchId);
}

async function createMatch(opponentId) {
  stopProjection();
  clearError();
  lobbyMessage.textContent = "Creating the authoritative 24×24 battlefield…";
  setBusy(true);
  try {
    render(await request("/api/matches", {
      method: "POST",
      body: JSON.stringify({ gameId, playerIds: [playerId, opponentId] }),
    }));
  } catch (error) {
    showError(error.message);
    lobbyMessage.textContent = "Tactical match creation failed.";
  } finally {
    setBusy(false);
  }
}

async function loadMatch(matchId) {
  clearError();
  lobbyMessage.textContent = "Resuming tactical match…";
  setBusy(true);
  try {
    const view = await request(`/api/matches/${encodeURIComponent(matchId)}`);
    if (view.gameId !== gameId) throw new Error("That match is not the tactical movement canary.");
    render(view);
  } catch (error) {
    clearRecentMatch();
    updateUrl(null);
    showError(error.message);
    lobby.hidden = false;
    matchPanel.hidden = true;
    lobbyMessage.textContent = "That tactical match could not be resumed with this seat.";
  } finally {
    setBusy(false);
  }
}

async function submitAction(action) {
  if (!current || requestPending) return;
  clearError();
  selectedUnitId = null;
  previewAction = null;
  status.textContent = "Committing the complete movement path…";
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

function selectActiveUnit() {
  const unit = activeUnit();
  if (!unit || activePlayerId() !== playerId || requestPending) return;
  selectedUnitId = selectedUnitId === unit.id ? null : unit.id;
  previewAction = selectedUnitId ? selectedActions()[0] ?? null : null;
  status.textContent = statusText();
  help.textContent = selectedUnitId
    ? "Choose a cyan destination. Gold shows the canonical path preview."
    : "Select your active unit, then choose a highlighted destination.";
  draw();
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
  return selectedActions().find((action) => {
    const destination = actionDestination(action);
    return destination?.x === coordinate.x && destination?.y === coordinate.y;
  }) ?? null;
}

function handleCanvasClick(event) {
  if (!current || requestPending) return;
  const coordinate = canvasCoordinate(event);
  if (!coordinate) return;
  const unit = current.observation.board.units.find(
    (candidate) => candidate.position.x === coordinate.x && candidate.position.y === coordinate.y,
  );
  if (unit?.id === current.observation.activeUnitId && unit.ownerId === playerId) {
    selectActiveUnit();
    return;
  }
  const action = selectedUnitId ? actionAt(coordinate) : null;
  if (action) void submitAction(action);
  else {
    selectedUnitId = null;
    previewAction = null;
    status.textContent = statusText();
    draw();
  }
}

function handleCanvasMove(event) {
  if (!selectedUnitId || requestPending) return;
  const coordinate = canvasCoordinate(event);
  const next = coordinate ? actionAt(coordinate) : null;
  if (next !== previewAction) {
    previewAction = next;
    draw();
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
    connectionLabel.textContent = "HTTP refresh";
    pollTimer = setInterval(() => {
      if (!requestPending && current?.observation.status.lifecycle === "active") {
        void refreshCurrent({ quiet: true });
      }
    }, 900);
  }
}

function leaveMatch() {
  stopProjection();
  current = null;
  selectedUnitId = null;
  previewAction = null;
  invitePlayerId = null;
  clearRecentMatch();
  clearError();
  updateUrl(null);
  matchPanel.hidden = true;
  lobby.hidden = false;
  lobbyMessage.textContent = "Choose an opponent to start a new movement canary.";
}

async function copyInviteLink() {
  if (!inviteLink.value || !invitePlayerId) return;
  try {
    await navigator.clipboard.writeText(inviteLink.value);
    copyInvite.textContent = "Copied";
    setTimeout(() => { copyInvite.textContent = "Copy invite"; }, 1400);
  } catch {
    inviteLink.focus();
    inviteLink.select();
    showError("Copy was blocked. The invite link is selected for manual copying.");
  }
}

challengeBot.addEventListener("click", () => createMatch(gameFrameBotPlayerId));
createHumanMatch.addEventListener("click", () => createMatch(`guest-${crypto.randomUUID()}`));
newMatch.addEventListener("click", leaveMatch);
copyInvite.addEventListener("click", copyInviteLink);
centerActive.addEventListener("click", () => {
  const unit = activeUnit();
  if (unit) centerViewport(unit.position);
});
centerObjective.addEventListener("click", () => centerViewport(objectiveCoordinate()));
zoomIn.addEventListener("click", () => changeZoom(0.25));
zoomOut.addEventListener("click", () => changeZoom(-0.25));
for (const button of panButtons) {
  button.addEventListener("click", () => panViewport(
    Number(button.dataset.panX),
    Number(button.dataset.panY),
  ));
}
canvas.addEventListener("click", handleCanvasClick);
canvas.addEventListener("pointermove", handleCanvasMove);
canvas.addEventListener("pointerleave", () => {
  if (previewAction) {
    previewAction = selectedActions()[0] ?? null;
    draw();
  }
});
canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  changeZoom(event.deltaY < 0 ? 0.25 : -0.25);
}, { passive: false });
canvas.addEventListener("keydown", (event) => {
  const pans = {
    ArrowUp: [0, -2],
    ArrowDown: [0, 2],
    ArrowLeft: [-2, 0],
    ArrowRight: [2, 0],
  };
  if (pans[event.key]) {
    event.preventDefault();
    panViewport(...pans[event.key]);
  } else if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    changeZoom(0.25);
  } else if (event.key === "-") {
    event.preventDefault();
    changeZoom(-0.25);
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    selectActiveUnit();
  }
});
new ResizeObserver(draw).observe(canvas);
window.addEventListener("beforeunload", stopProjection);

await detectRuntime();
const requestedMatchId = normalizeIdentity(urlState.get("match"));
const recentMatchId = explicitPlayerId ? null : normalizeIdentity(localStorage.getItem(recentMatchStorageKey));
if (requestedMatchId ?? recentMatchId) {
  await loadMatch(requestedMatchId ?? recentMatchId);
} else {
  lobbyMessage.textContent = "Choose an opponent to begin on the 24×24 battlefield.";
}
