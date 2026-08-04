import { gameFrameFetch } from "./gameframe-auth.js";

const gameId = "monster-master-duel";
const theoPlayerId = "theo";
const recentMatchStorageKey = "scribbles-gameframe.recent-monster-master-match";
const monsterMasterViewEvent = "gameframe:monster-master-pixi-view";
const identity = window.gameFrameIdentity;
const playerId = identity.playerId;

const lobby = document.querySelector("#monster-master-lobby");
const lobbyMessage = document.querySelector("#monster-master-lobby-message");
const challengeTheo = document.querySelector("#monster-master-theo");
const createHumanMatch = document.querySelector("#monster-master-human");
const matchPanel = document.querySelector("#monster-master-match");
const status = document.querySelector("#monster-master-status");
const revision = document.querySelector("#monster-master-revision");
const revisionSmall = document.querySelector("#monster-master-revision-small");
const phaseLabel = document.querySelector("#monster-master-phase");
const roundLabel = document.querySelector("#monster-master-round");
const activeUnitLabel = document.querySelector("#monster-master-active-unit");
const connectionLabel = document.querySelector("#monster-master-connection");
const moveBudget = document.querySelector("#monster-master-move-budget");
const primaryBudget = document.querySelector("#monster-master-primary-budget");
const alphaCommand = document.querySelector("#monster-master-alpha-command");
const betaCommand = document.querySelector("#monster-master-beta-command");
const alphaCard = document.querySelector("#monster-master-player-alpha");
const betaCard = document.querySelector("#monster-master-player-beta");
const alphaName = document.querySelector("#monster-master-alpha-name");
const betaName = document.querySelector("#monster-master-beta-name");
const rosterList = document.querySelector("#monster-master-roster-list");
const canvas = document.querySelector("#monster-master-canvas");
const context = canvas.getContext("2d");
const help = document.querySelector("#monster-master-help");
const options = document.querySelector("#monster-master-options");
const effects = document.querySelector("#monster-master-effects");
const errorBanner = document.querySelector("#monster-master-error");
const invitePanel = document.querySelector("#monster-master-invite-panel");
const inviteLink = document.querySelector("#monster-master-invite-link");
const copyInvite = document.querySelector("#monster-master-copy-invite");
const newMatch = document.querySelector("#monster-master-new-match");
const selectDeploy = document.querySelector("#monster-master-select-deploy");
const selectMove = document.querySelector("#monster-master-select-move");
const selectAttack = document.querySelector("#monster-master-select-attack");
const selectMend = document.querySelector("#monster-master-select-mend");
const endActivation = document.querySelector("#monster-master-end-activation");
const centerActive = document.querySelector("#monster-master-center-active");
const centerField = document.querySelector("#monster-master-center-field");
const zoomIn = document.querySelector("#monster-master-zoom-in");
const zoomOut = document.querySelector("#monster-master-zoom-out");
const details = document.querySelector("#monster-master-details");
const panButtons = [...document.querySelectorAll("[data-monster-master-pan-x][data-monster-master-pan-y]")];

const urlState = new URLSearchParams(window.location.search);
const explicitDevelopmentSeat = identity.source === "development" && urlState.has("player");

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

function displayName(id) {
  if (id === theoPlayerId) return "Theo";
  if (id === playerId) return "You";
  return "Opponent";
}

function activePlayerId(view = current) {
  return view?.observation.activePlayerId ?? null;
}

function allRosterUnits(view = current) {
  if (!view) return [];
  return view.playerIds.flatMap((ownerId) => view.observation.rosters[ownerId] ?? []);
}

function deployedUnit(unitId, view = current) {
  return view?.observation.board.units.find((unit) => unit.id === unitId) ?? null;
}

function unitById(unitId, view = current) {
  return deployedUnit(unitId, view) ?? allRosterUnits(view).find((unit) => unit.id === unitId) ?? null;
}

function activeUnit(view = current) {
  return unitById(view?.observation.activeUnitId, view);
}

function roleLabel(role) {
  if (role === "master") return "Warden Master";
  if (role === "bulwark") return "Stone Bulwark";
  if (role === "emberling") return "Emberling";
  return role ?? "Unit";
}

function unitLabel(unitOrId, view = current) {
  const unit = typeof unitOrId === "string" ? unitById(unitOrId, view) : unitOrId;
  if (!unit) return "—";
  const team = unit.id.startsWith("alpha-") ? "Alpha" : "Beta";
  return `${team} ${roleLabel(unit.role)}`;
}

function coordinateKey(coordinate) {
  return `${coordinate.x},${coordinate.y}`;
}

function legalActions(type) {
  return current?.observation.legalActions.filter((action) => action.type === type) ?? [];
}

function actionDestination(action) {
  if (action.type === "deploy-unit") return action.position;
  if (action.type === "move") return action.path.at(-1);
  if (action.type === "attack" || action.type === "use-ability") return action.target;
  return null;
}

function statusText(view = current) {
  if (!view) return "No Monster Master duel is active.";
  const observation = view.observation;
  if (observation.status.draw) return "The duel ended in a draw.";
  if (observation.status.winnerPlayerId) {
    return observation.status.winnerPlayerId === playerId
      ? "Your Warden won the duel."
      : `${displayName(observation.status.winnerPlayerId)} won the duel.`;
  }
  if (observation.phase === "deployment") {
    if (observation.activePlayerId !== playerId) {
      return `${displayName(observation.activePlayerId)} is deploying a unit.`;
    }
    const unit = unitById(selectedUnitId, view);
    return unit
      ? `Deploy ${unitLabel(unit, view)} into the highlighted starting zone.`
      : "Choose one of your undeployed units.";
  }
  if (observation.activePlayerId !== playerId) {
    return `${displayName(observation.activePlayerId)} is resolving ${unitLabel(observation.activeUnitId, view)}.`;
  }
  if (actionMode === "move") return "Choose a highlighted movement destination.";
  if (actionMode === "attack") return legalActions("attack").length
    ? "Choose a highlighted enemy target."
    : "No enemy is currently in legal line of sight.";
  if (actionMode === "use-ability") return legalActions("use-ability").length
    ? "Choose a highlighted friendly target for Mend."
    : "Mend has no legal target or insufficient command energy.";
  return `Your activation: ${unitLabel(observation.activeUnitId, view)}.`;
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

function highlightedCoordinates() {
  if (!current || !actionMode) return new Map();
  const result = new Map();
  for (const action of current.observation.legalActions) {
    if (action.type !== actionMode) continue;
    if (action.type === "deploy-unit" && action.unitId !== selectedUnitId) continue;
    const destination = actionDestination(action);
    if (destination) result.set(coordinateKey(destination), action);
  }
  return result;
}

function drawGrid(view, layout) {
  const map = view.observation.board.map;
  const highlights = highlightedCoordinates();
  context.fillStyle = "#080c14";
  context.fillRect(0, 0, layout.width, layout.height);
  for (let y = layout.bounds.y; y < layout.bounds.y + layout.bounds.rows; y += 1) {
    for (let x = layout.bounds.x; x < layout.bounds.x + layout.bounds.columns; x += 1) {
      const coordinate = { x, y };
      const cell = cellAt(map, coordinate);
      const screen = screenPosition(coordinate, layout);
      context.fillStyle = terrainColor(cell, coordinate);
      context.fillRect(screen.x, screen.y, layout.cellSize, layout.cellSize);
      const highlighted = highlights.get(coordinateKey(coordinate));
      if (highlighted) {
        context.fillStyle = highlighted.type === "deploy-unit"
          ? "rgba(255, 207, 110, .28)"
          : highlighted.type === "move"
            ? "rgba(112, 216, 255, .26)"
            : highlighted.type === "use-ability"
              ? "rgba(112, 232, 174, .24)"
              : "rgba(255, 104, 145, .23)";
        context.fillRect(screen.x + 2, screen.y + 2, layout.cellSize - 4, layout.cellSize - 4);
      }
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
    return;
  }
  if (previewAction.type === "attack" || previewAction.type === "use-ability") {
    if (!isVisible(previewAction.from, layout.bounds) || !isVisible(previewAction.target, layout.bounds)) return;
    const from = screenPosition(previewAction.from, layout);
    const target = screenPosition(previewAction.target, layout);
    context.strokeStyle = previewAction.type === "use-ability"
      ? "rgba(112, 232, 174, .95)"
      : "rgba(255, 104, 145, .95)";
    context.lineWidth = Math.max(3, layout.cellSize * 0.07);
    context.setLineDash([Math.max(5, layout.cellSize * 0.14), Math.max(4, layout.cellSize * 0.1)]);
    context.beginPath();
    context.moveTo(from.x + layout.cellSize / 2, from.y + layout.cellSize / 2);
    context.lineTo(target.x + layout.cellSize / 2, target.y + layout.cellSize / 2);
    context.stroke();
    context.setLineDash([]);
  }
}

function drawUnitShape(unit, centerX, centerY, radius) {
  context.beginPath();
  if (unit.role === "master") {
    context.rect(centerX - radius * 0.8, centerY - radius * 0.8, radius * 1.6, radius * 1.6);
  } else if (unit.role === "emberling") {
    context.moveTo(centerX, centerY - radius);
    context.lineTo(centerX + radius, centerY);
    context.lineTo(centerX, centerY + radius);
    context.lineTo(centerX - radius, centerY);
    context.closePath();
  } else {
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  }
}

function drawUnits(view, layout) {
  const targetIds = new Set(
    [...legalActions("attack"), ...legalActions("use-ability")].map((action) => action.targetUnitId),
  );
  for (const unit of view.observation.board.units) {
    if (!isVisible(unit.position, layout.bounds)) continue;
    const screen = screenPosition(unit.position, layout);
    const centerX = screen.x + layout.cellSize / 2;
    const centerY = screen.y + layout.cellSize / 2;
    const radius = layout.cellSize * 0.31;
    const alpha = unit.ownerId === view.playerIds[0];
    const active = unit.id === view.observation.activeUnitId;
    const selected = unit.id === selectedUnitId;
    const targetable = targetIds.has(unit.id)
      && (actionMode === "attack" || actionMode === "use-ability");

    context.save();
    context.shadowColor = alpha ? "rgba(78, 164, 255, .65)" : "rgba(255, 92, 139, .6)";
    context.shadowBlur = active ? layout.cellSize * 0.28 : layout.cellSize * 0.1;
    context.fillStyle = alpha ? "#2f79c9" : "#b33e62";
    drawUnitShape(unit, centerX, centerY, radius);
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = targetable
      ? (actionMode === "use-ability" ? "#78e4b4" : "#ff7fa5")
      : selected
        ? "#ffd06e"
        : active
          ? "#eaf7ff"
          : "rgba(255,255,255,.5)";
    context.lineWidth = targetable || selected ? Math.max(4, layout.cellSize * 0.08) : Math.max(2, layout.cellSize * 0.05);
    context.stroke();

    context.fillStyle = "#ffffff";
    context.font = `900 ${Math.max(10, layout.cellSize * 0.2)}px system-ui`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(unit.role === "master" ? "M" : unit.role === "bulwark" ? "B" : "E", centerX, centerY);

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

function renderDiagnostics(layout = null) {
  const pixiCamera = window.gameFrameMonsterPixi?.getCamera?.();
  const camera = pixiCamera
    ? {
        centerX: pixiCamera.x,
        centerY: pixiCamera.y,
        zoom: pixiCamera.zoom,
        quarter: pixiCamera.quarter,
        bounds: null,
      }
    : {
        centerX: viewport.centerX,
        centerY: viewport.centerY,
        zoom: viewport.zoom,
        bounds: layout?.bounds ?? null,
      };
  details.textContent = JSON.stringify({
    gameId,
    matchId: current.matchId,
    playerId,
    revision: current.revision,
    phase: current.observation.phase,
    round: current.observation.round,
    activePlayerId: activePlayerId(),
    activeUnitId: current.observation.activeUnitId,
    selectedUnitId,
    actionMode,
    commandByPlayer: current.observation.commandByPlayer,
    legalActionCount: current.observation.legalActions.length,
    undeployedUnitIds: current.observation.undeployedUnitIds,
    defeatedUnitIds: current.observation.defeatedUnitIds,
    viewport: camera,
  }, null, 2);
}

function drawScene() {
  if (!current) return;
  if (window.gameFrameMonsterRendererMode === "pixi") {
    renderDiagnostics();
    return;
  }
  window.gameFrameMonsterLegacyDrawCount = (window.gameFrameMonsterLegacyDrawCount ?? 0) + 1;
  const layout = layoutCanvas(current.observation.board.map);
  lastCanvasLayout = layout;
  drawGrid(current, layout);
  drawPreview(layout);
  drawUnits(current, layout);
  drawCoordinates(layout);
  renderDiagnostics(layout);
}

function undeployedOwnedUnits(view = current) {
  if (!view) return [];
  const undeployed = new Set(view.observation.undeployedUnitIds);
  return (view.observation.rosters[playerId] ?? []).filter((unit) => undeployed.has(unit.id));
}

function renderOptions() {
  options.replaceChildren();
  if (!current || requestPending || activePlayerId() !== playerId || !actionMode) return;
  if (actionMode === "deploy-unit") {
    for (const unit of undeployedOwnedUnits()) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.actionKind = "deploy-unit";
      button.dataset.preview = String(unit.id === selectedUnitId);
      button.textContent = `${roleLabel(unit.role)} · move ${unit.movement} · I${unit.initiative}`;
      button.addEventListener("click", () => {
        selectedUnitId = unit.id;
        previewAction = legalActions("deploy-unit").find((action) => action.unitId === unit.id) ?? null;
        status.textContent = statusText();
        renderOptions();
        drawScene();
      });
      options.append(button);
    }
    return;
  }

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
    } else if (action.type === "attack") {
      button.dataset.targetUnitId = action.targetUnitId;
      button.textContent = `${unitLabel(action.targetUnitId)} · ${action.damage} damage · range ${action.range}`;
    } else {
      button.dataset.targetUnitId = action.targetUnitId;
      button.textContent = `${unitLabel(action.targetUnitId)} · heal ${action.healing} · command ${action.commandCost}`;
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
    note.textContent = actionMode === "attack"
      ? "No legal enemy target."
      : actionMode === "use-ability"
        ? "No damaged friendly unit is a legal Mend target."
        : "No legal movement destination.";
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
  const deployed = new Map(view.observation.board.units.map((unit) => [unit.id, unit]));
  const defeated = new Set(view.observation.defeatedUnitIds);
  for (const ownerId of view.playerIds) {
    for (const rosterUnit of view.observation.rosters[ownerId] ?? []) {
      const unit = deployed.get(rosterUnit.id) ?? rosterUnit;
      const item = document.createElement("div");
      item.className = "combat-roster-unit";
      item.classList.toggle("is-active", rosterUnit.id === view.observation.activeUnitId);
      item.classList.toggle("is-defeated", defeated.has(rosterUnit.id));
      const dot = document.createElement("span");
      dot.className = `combat-team-dot ${ownerId === view.playerIds[0] ? "alpha" : "beta"}`;
      const name = document.createElement("strong");
      name.textContent = unitLabel(rosterUnit, view);
      const health = document.createElement("span");
      health.className = "combat-roster-health";
      health.textContent = defeated.has(rosterUnit.id)
        ? "defeated"
        : view.observation.undeployedUnitIds.includes(rosterUnit.id)
          ? `undeployed · I${unit.initiative}`
          : `${unit.health}/${unit.maxHealth} · I${unit.initiative}`;
      item.append(dot, name, health);
      rosterList.append(item);
    }
  }
}

function effectText(effect) {
  if (effect.type === "unit-deployed") return `${unitLabel(effect.unitId)} deployed at ${coordinateKey(effect.position)}`;
  if (effect.type === "combat-started") return `Combat started at round ${effect.round}`;
  if (effect.type === "unit-moved") return `${unitLabel(effect.unitId)} moved to ${coordinateKey(effect.to)}`;
  if (effect.type === "unit-damaged") return `${unitLabel(effect.targetUnitId)} took ${effect.damage} damage`;
  if (effect.type === "unit-healed") return `${unitLabel(effect.targetUnitId)} recovered ${effect.healing} health`;
  if (effect.type === "command-spent") return `${displayName(effect.playerId)} spent ${effect.amount} command`;
  if (effect.type === "command-restored") return `${displayName(effect.playerId)} restored ${effect.amount} command`;
  if (effect.type === "unit-defeated") return `${unitLabel(effect.targetUnitId)} defeated`;
  if (effect.type === "activation-ended") return `${unitLabel(effect.unitId)} ended activation`;
  if (effect.type === "round-started") return `Round ${effect.round} started`;
  return effect.draw ? "The duel ended in a draw" : "Duel victory resolved";
}

function renderEffects(view) {
  effects.replaceChildren();
  for (const effect of view.observation.lastEffects) {
    const item = document.createElement("span");
    item.className = `combat-effect ${effect.type === "unit-damaged" ? "damage" : effect.type === "unit-defeated" ? "defeat" : effect.type === "duel-completed" ? "victory" : ""}`;
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
  if (identity.source !== "development" || view.playerIds.includes(theoPlayerId) || view.playerIds[0] !== playerId) return null;
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
  const deployment = canAct && current.observation.phase === "deployment";
  const combat = canAct && current.observation.phase === "combat";
  selectDeploy.disabled = !deployment || !legalActions("deploy-unit").length;
  selectMove.disabled = !combat || !current.observation.movementAvailable || !legalActions("move").length;
  selectAttack.disabled = !combat || !current.observation.primaryActionAvailable || !legalActions("attack").length;
  selectMend.disabled = !combat || !current.observation.primaryActionAvailable || !legalActions("use-ability").length;
  endActivation.disabled = !combat || !legalActions("end-activation").length;
  selectDeploy.setAttribute("aria-pressed", String(actionMode === "deploy-unit"));
  selectMove.setAttribute("aria-pressed", String(actionMode === "move"));
  selectAttack.setAttribute("aria-pressed", String(actionMode === "attack"));
  selectMend.setAttribute("aria-pressed", String(actionMode === "use-ability"));
}

function chooseDefaultMode(view) {
  if (activePlayerId(view) !== playerId || view.observation.status.lifecycle !== "active") return;
  if (view.observation.phase === "deployment") {
    actionMode = "deploy-unit";
    selectedUnitId = undeployedOwnedUnits(view)[0]?.id ?? null;
    previewAction = legalActions("deploy-unit").find((action) => action.unitId === selectedUnitId) ?? null;
  } else {
    selectedUnitId = view.observation.activeUnitId;
  }
}

function render(view) {
  const previous = current;
  const changed = !previous || previous.matchId !== view.matchId || previous.revision !== view.revision;
  current = view;
  if (changed) {
    actionMode = null;
    previewAction = null;
    selectedUnitId = null;
    chooseDefaultMode(view);
    const nextActive = activeUnit(view);
    if (!previous || previous.matchId !== view.matchId || nextActive?.id !== lastActiveUnitId) {
      if (nextActive?.position?.x >= 0) centerViewport(nextActive.position);
      else if (view.observation.phase === "deployment") {
        centerViewport(view.playerIds[0] === playerId ? { x: 3, y: 11.5 } : { x: 20, y: 11.5 });
      }
    }
    lastActiveUnitId = nextActive?.id ?? null;
  }

  lobby.hidden = true;
  matchPanel.hidden = false;
  clearError();
  status.textContent = statusText(view);
  revision.textContent = `Revision ${view.revision}`;
  revisionSmall.textContent = String(view.revision);
  phaseLabel.textContent = view.observation.phase === "deployment" ? "Deployment" : "Combat";
  roundLabel.textContent = view.observation.round ? String(view.observation.round) : "—";
  activeUnitLabel.textContent = view.observation.phase === "deployment"
    ? unitLabel(selectedUnitId, view)
    : unitLabel(view.observation.activeUnitId, view);
  connectionLabel.textContent = realtimeEnabled
    ? (socket?.readyState === WebSocket.OPEN ? "Live connection" : "Connecting…")
    : "HTTP refresh";
  moveBudget.textContent = view.observation.phase === "combat"
    ? (view.observation.movementAvailable ? "Available" : "Used")
    : "—";
  primaryBudget.textContent = view.observation.phase === "combat"
    ? (view.observation.primaryActionAvailable ? "Available" : "Used")
    : "—";
  alphaCommand.textContent = String(view.observation.commandByPlayer[view.playerIds[0]] ?? 0);
  betaCommand.textContent = String(view.observation.commandByPlayer[view.playerIds[1]] ?? 0);
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
  window.dispatchEvent(new CustomEvent(monsterMasterViewEvent, { detail: { view } }));
}

function setBusy(busy) {
  requestPending = busy;
  challengeTheo.disabled = busy;
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
  const headers = new Headers(requestOptions.headers);
  if (requestOptions.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await gameFrameFetch(url, { ...requestOptions, headers });
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

function updateUrl(matchId) {
  const url = new URL(window.location.href);
  if (matchId) url.searchParams.set("match", matchId);
  else url.searchParams.delete("match");
  if (identity.source === "discord") url.searchParams.delete("player");
  history.replaceState({}, "", url);
}

function persistMatch(matchId) {
  if (!explicitDevelopmentSeat) localStorage.setItem(recentMatchStorageKey, matchId);
}

function clearRecentMatch() {
  if (!explicitDevelopmentSeat) localStorage.removeItem(recentMatchStorageKey);
}

async function createMatch(opponentId) {
  stopProjection();
  clearError();
  lobbyMessage.textContent = "Creating the authoritative Monster Master duel…";
  setBusy(true);
  try {
    render(await request("/api/matches", {
      method: "POST",
      body: JSON.stringify({ gameId, playerIds: [playerId, opponentId] }),
    }));
  } catch (error) {
    showError(error.message);
    lobbyMessage.textContent = "Duel creation failed.";
  } finally {
    setBusy(false);
  }
}

async function loadMatch(matchId) {
  clearError();
  lobbyMessage.textContent = "Resuming Monster Master duel…";
  setBusy(true);
  try {
    const view = await request(`/api/matches/${encodeURIComponent(matchId)}`);
    if (view.gameId !== gameId) throw new Error("That match is not a Monster Master duel.");
    render(view);
  } catch (error) {
    clearRecentMatch();
    updateUrl(null);
    showError(error.message);
    lobby.hidden = false;
    matchPanel.hidden = true;
    lobbyMessage.textContent = "That Monster Master duel could not be resumed with this seat.";
  } finally {
    setBusy(false);
  }
}

async function submitAction(action) {
  if (!current || requestPending) return;
  clearError();
  previewAction = null;
  status.textContent = action.type === "deploy-unit"
    ? "Committing deployment…"
    : action.type === "attack"
      ? "Committing attack…"
      : action.type === "use-ability"
        ? "Channeling Mend…"
        : action.type === "move"
          ? "Committing movement path…"
          : "Ending activation…";
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
  actionMode = actionMode === mode ? null : mode;
  if (actionMode === "deploy-unit") {
    selectedUnitId = selectedUnitId && undeployedOwnedUnits().some((unit) => unit.id === selectedUnitId)
      ? selectedUnitId
      : undeployedOwnedUnits()[0]?.id ?? null;
    previewAction = legalActions("deploy-unit").find((action) => action.unitId === selectedUnitId) ?? null;
  } else {
    selectedUnitId = current.observation.activeUnitId;
    previewAction = actionMode ? legalActions(actionMode)[0] ?? null : null;
  }
  status.textContent = statusText();
  help.textContent = actionMode === "deploy-unit"
    ? "Choose a roster unit below, then select a gold deployment cell."
    : actionMode === "move"
      ? "Cyan cells are legal destinations. Gold shows the canonical path."
      : actionMode === "attack"
        ? "Red-highlighted units are legal targets."
        : actionMode === "use-ability"
          ? "Green-highlighted friendly units are legal Mend targets."
          : "Select Move, Attack, Mend, or End activation.";
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
    if (action.type === "deploy-unit" && action.unitId !== selectedUnitId) return false;
    const destination = actionDestination(action);
    return destination?.x === coordinate.x && destination?.y === coordinate.y;
  }) ?? null;
}

function handleBattlefieldCoordinate(coordinate) {
  if (!current || requestPending || !coordinate) return;
  const clickedUnit = current.observation.board.units.find(
    (unit) => unit.position.x === coordinate.x && unit.position.y === coordinate.y,
  );
  if (
    current.observation.phase === "combat"
    && clickedUnit?.id === current.observation.activeUnitId
    && clickedUnit.ownerId === playerId
  ) {
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

window.gameFrameMonsterController = Object.freeze({
  getView: () => current,
  handleCoordinate: (coordinate) => handleBattlefieldCoordinate(coordinate),
});

function handleCanvasClick(event) {
  handleBattlefieldCoordinate(canvasCoordinate(event));
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

challengeTheo.addEventListener("click", () => createMatch(theoPlayerId));
createHumanMatch.addEventListener("click", () => createMatch(`guest-${crypto.randomUUID()}`));
selectDeploy.addEventListener("click", () => selectMode("deploy-unit"));
selectMove.addEventListener("click", () => selectMode("move"));
selectAttack.addEventListener("click", () => selectMode("attack"));
selectMend.addEventListener("click", () => selectMode("use-ability"));
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
  lobbyMessage.textContent = "Choose an opponent for a new Monster Master duel.";
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
  button.addEventListener("click", () => panViewport(
    Number(button.dataset.monsterMasterPanX),
    Number(button.dataset.monsterMasterPanY),
  ));
}
centerActive.addEventListener("click", () => {
  const unit = activeUnit();
  if (unit?.position?.x >= 0) centerViewport(unit.position);
});
centerField.addEventListener("click", () => centerViewport({ x: 11.5, y: 11.5 }));
zoomIn.addEventListener("click", () => changeZoom(0.25));
zoomOut.addEventListener("click", () => changeZoom(-0.25));
canvas.addEventListener("click", handleCanvasClick);
window.addEventListener("gameframe:monster-master-coordinate", (event) => {
  const coordinate = event.detail?.coordinate;
  if (
    !coordinate
    || !Number.isFinite(coordinate.x)
    || !Number.isFinite(coordinate.y)
  ) return;
  handleBattlefieldCoordinate({ x: Math.round(coordinate.x), y: Math.round(coordinate.y) });
});
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
  } else if (event.key.toLowerCase() === "d") {
    event.preventDefault();
    selectMode("deploy-unit");
  } else if (event.key.toLowerCase() === "m") {
    event.preventDefault();
    selectMode("move");
  } else if (event.key.toLowerCase() === "a") {
    event.preventDefault();
    selectMode("attack");
  } else if (event.key.toLowerCase() === "h") {
    event.preventDefault();
    selectMode("use-ability");
  }
});
window.addEventListener("resize", drawScene);
window.addEventListener("beforeunload", stopProjection);

await detectRuntime();
const requestedMatch = urlState.get("match") ?? (!explicitDevelopmentSeat ? localStorage.getItem(recentMatchStorageKey) : null);
if (requestedMatch) await loadMatch(requestedMatch);
else lobbyMessage.textContent = "Choose an opponent to begin the first Monster Master duel.";
