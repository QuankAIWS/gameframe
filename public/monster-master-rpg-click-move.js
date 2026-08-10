const COORDINATE_EVENT = "gameframe:monster-master-coordinate";
const VIEW_EVENT = "gameframe:monster-master-pixi-view";
const DIRECTIONS = Object.freeze([
  ["north", 0, -1],
  ["east", 1, 0],
  ["south", 0, 1],
  ["west", -1, 0],
]);
const STEP_TIMEOUT_MS = 3_000;

let movementToken = 0;
let moving = false;

function worldState() {
  const world = window.gameFrameMonsterRpgWorld;
  return {
    world,
    payload: world?.getPayload?.() ?? null,
    position: world?.getPlayerPosition?.() ?? null,
  };
}

function coordinateKey(x, y) {
  return `${x},${y}`;
}

function inBounds(map, x, y) {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

function traversable(map, blocked, x, y) {
  if (!inBounds(map, x, y) || blocked.has(coordinateKey(x, y))) return false;
  const cell = map.cells[y * map.width + x];
  return Boolean(cell && cell.terrain !== "wall");
}

function blockedCells(payload) {
  const playerId = payload?.projection?.viewer?.playerCharacterEntityId;
  return new Set((payload?.materialization?.anchors ?? [])
    .filter((anchor) => anchor.semanticId !== playerId)
    .filter((anchor) => anchor.kind === "entity" || anchor.kind === "object")
    .map((anchor) => coordinateKey(anchor.x, anchor.y)));
}

function interactionAnchorAt(payload, coordinate) {
  return (payload?.materialization?.anchors ?? []).find((anchor) =>
    anchor
    && typeof anchor.interactionTargetId === "string"
    && anchor.interactionTargetId
    && anchor.x === coordinate.x
    && anchor.y === coordinate.y
  ) ?? null;
}

function movementTarget(payload, start, requested) {
  const map = payload?.materialization?.map;
  if (!map) return null;
  const blocked = blockedCells(payload);
  const anchor = interactionAnchorAt(payload, requested);
  if (!anchor) {
    return traversable(map, blocked, requested.x, requested.y)
      ? { goals: [requested], extraBlocked: new Set() }
      : null;
  }

  // Clicking an interactive person, object, or route means "walk up to it",
  // leaving the player in the exact Manhattan-distance-1 range used by the
  // authoritative Talk/Uncover/Travel operations.
  const extraBlocked = new Set([coordinateKey(anchor.x, anchor.y)]);
  const goals = DIRECTIONS
    .map(([, dx, dy]) => ({ x: anchor.x + dx, y: anchor.y + dy }))
    .filter((candidate) => traversable(map, new Set([...blocked, ...extraBlocked]), candidate.x, candidate.y))
    .sort((left, right) =>
      (Math.abs(left.x - start.x) + Math.abs(left.y - start.y))
      - (Math.abs(right.x - start.x) + Math.abs(right.y - start.y))
    );
  return goals.length > 0 ? { goals, extraBlocked } : null;
}

function shortestPath(payload, start, target) {
  const map = payload?.materialization?.map;
  if (!map || !target?.goals?.length) return null;
  const blocked = new Set([...blockedCells(payload), ...(target.extraBlocked ?? [])]);
  const goalKeys = new Set(target.goals.map((goal) => coordinateKey(goal.x, goal.y)));
  const startKey = coordinateKey(start.x, start.y);
  if (goalKeys.has(startKey)) return [];

  const queue = [{ x: start.x, y: start.y }];
  const previous = new Map([[startKey, null]]);
  let reached = null;

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const [direction, dx, dy] of DIRECTIONS) {
      const next = { x: current.x + dx, y: current.y + dy };
      const key = coordinateKey(next.x, next.y);
      if (previous.has(key) || !traversable(map, blocked, next.x, next.y)) continue;
      previous.set(key, { from: coordinateKey(current.x, current.y), direction });
      if (goalKeys.has(key)) {
        reached = key;
        break;
      }
      queue.push(next);
    }
    if (reached) break;
  }
  if (!reached) return null;

  const path = [];
  let cursor = reached;
  while (cursor !== startKey) {
    const step = previous.get(cursor);
    if (!step) return null;
    path.push(step.direction);
    cursor = step.from;
  }
  return path.reverse();
}

function setStatus(message) {
  const status = document.querySelector("#mm-rpg-world-status");
  if (status) status.textContent = message;
}

function waitForStep(before, token) {
  return new Promise((resolve) => {
    const started = performance.now();
    let settled = false;
    let timer = null;

    function finish(value) {
      if (settled) return;
      settled = true;
      if (timer) window.clearInterval(timer);
      window.removeEventListener(VIEW_EVENT, onView);
      resolve(value);
    }

    function currentResult() {
      if (token !== movementToken) return { cancelled: true };
      const position = worldState().position;
      if (!position) return null;
      if (
        position.sceneId !== before.sceneId
        || position.materializationRef?.hash !== before.materializationRef?.hash
      ) return { changedScene: true, position };
      if (
        position.positionRevision !== before.positionRevision
        || position.transform?.x !== before.transform?.x
        || position.transform?.y !== before.transform?.y
        || position.transform?.facing !== before.transform?.facing
        || position.blockedBy
      ) return { position };
      return null;
    }

    function onView() {
      const result = currentResult();
      if (result) finish(result);
    }

    window.addEventListener(VIEW_EVENT, onView);
    timer = window.setInterval(() => {
      const result = currentResult();
      if (result) {
        finish(result);
        return;
      }
      if (performance.now() - started >= STEP_TIMEOUT_MS) finish({ timeout: true });
    }, 50);
  });
}

async function walkTo(requested) {
  const token = ++movementToken;
  const initial = worldState();
  const start = initial.position?.transform;
  if (!initial.world || !initial.payload?.materialization?.map || !start) return;

  const target = movementTarget(initial.payload, start, requested);
  const path = target ? shortestPath(initial.payload, start, target) : null;
  if (path === null) {
    setStatus("No walkable route to that spot");
    return;
  }
  if (path.length === 0) {
    setStatus("Already in position");
    return;
  }

  moving = true;
  document.body.classList.add("mm-rpg-click-moving");
  setStatus(`Walking · ${path.length} step${path.length === 1 ? "" : "s"}`);
  try {
    for (const direction of path) {
      if (token !== movementToken) return;
      const before = worldState().position;
      if (!before) return;
      if (!initial.world.move?.(direction)) return;
      const result = await waitForStep(before, token);
      if (result.cancelled || token !== movementToken) return;
      if (result.changedScene) return;
      if (result.timeout) {
        setStatus("Movement paused · click again or refresh the scene");
        return;
      }
      if (result.position?.blockedBy) {
        setStatus(`Path blocked · ${result.position.blockedBy}`);
        return;
      }
    }
    const end = worldState().position?.transform;
    if (end) setStatus(`Arrived · ${end.x},${end.y}`);
  } finally {
    if (token === movementToken) {
      moving = false;
      document.body.classList.remove("mm-rpg-click-moving");
    }
  }
}

function cancelClickMove() {
  if (!moving) return;
  movementToken += 1;
  moving = false;
  document.body.classList.remove("mm-rpg-click-moving");
}

window.addEventListener(COORDINATE_EVENT, (event) => {
  const coordinate = event.detail?.coordinate;
  if (!Number.isSafeInteger(coordinate?.x) || !Number.isSafeInteger(coordinate?.y)) return;
  const current = worldState();
  if (!current.payload?.materialization?.map || !current.position) return;

  // Claim this shared Pixi coordinate so the legacy tactical controller cannot
  // swallow an exploration click. Drag-to-pan is filtered by the Pixi bridge
  // before a coordinate event is emitted, so a clean click means movement.
  event.preventDefault();
  void walkTo({ x: coordinate.x, y: coordinate.y });
});

window.addEventListener("keydown", (event) => {
  if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) cancelClickMove();
}, { capture: true });

window.addEventListener("gameframe:before-home", cancelClickMove);
window.addEventListener(VIEW_EVENT, () => {
  document.body.classList.toggle(
    "mm-rpg-click-move-ready",
    Boolean(worldState().payload && worldState().position),
  );
});

window.gameFrameMonsterRpgClickMove = Object.freeze({
  cancel: cancelClickMove,
  moveTo: (coordinate) => walkTo(coordinate),
});

queueMicrotask(() => {
  document.body.classList.toggle(
    "mm-rpg-click-move-ready",
    Boolean(worldState().payload && worldState().position),
  );
});
