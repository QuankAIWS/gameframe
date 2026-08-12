import { gameFrameOptionalFetch, tryGameFrameIdentity } from "./gameframe-auth.js";

const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const PERFORMANCE_KEY = "scribbles-gameframe.cascade-performance:v1";
const OWNER_KEY = "scribbles-gameframe.cascade-progression-owner:v1";
const CANDIDATE_KEY = "scribbles-gameframe.cascade-progression-candidate:v1";
const SYNC_INTERVAL_MS = 750;
const storage = window.localStorage;
const query = new URLSearchParams(window.location.search);
let lastSubmitted = "";
let syncPending = false;
let identity = null;

function readJson(key) {
  try {
    const value = JSON.parse(storage.getItem(key) || "null");
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function snapshot() {
  const state = readJson(STATE_KEY) || {};
  const performance = readJson(PERFORMANCE_KEY) || {};
  const sourceStars = performance.starsByLevel && typeof performance.starsByLevel === "object"
    ? performance.starsByLevel
    : {};
  const starsByLevel = {};
  let highestStarLevel = 0;
  for (const [rawLevel, rawStars] of Object.entries(sourceStars)) {
    const level = Number(rawLevel);
    const stars = Number(rawStars);
    if (!Number.isInteger(level) || level < 1 || level > 300 || !Number.isFinite(stars)) continue;
    const best = Math.max(0, Math.min(3, Math.floor(stars)));
    if (!best) continue;
    starsByLevel[String(level)] = best;
    highestStarLevel = Math.max(highestStarLevel, level);
  }
  const unlockedLevel = Math.max(1, Math.min(300, Math.floor(Number(state.level) || 1)));
  return {
    highestCompletedLevel: Math.max(highestStarLevel, unlockedLevel - 1),
    starsByLevel,
  };
}

function resolveOwner(hasProgress) {
  const owner = storage.getItem(OWNER_KEY);
  if (owner) {
    storage.removeItem(CANDIDATE_KEY);
    return owner;
  }

  if (!hasProgress) {
    storage.setItem(CANDIDATE_KEY, identity.playerId);
    return null;
  }

  const candidate = storage.getItem(CANDIDATE_KEY);
  if (candidate !== identity.playerId) return null;
  storage.setItem(OWNER_KEY, identity.playerId);
  storage.removeItem(CANDIDATE_KEY);
  return identity.playerId;
}

async function submitSnapshot() {
  if (!identity || syncPending) return;
  const current = snapshot();
  const hasProgress = current.highestCompletedLevel > 0 || Object.keys(current.starsByLevel).length > 0;
  if (resolveOwner(hasProgress) !== identity.playerId) return;
  if (!hasProgress) return;

  const serialized = JSON.stringify(current);
  if (serialized === lastSubmitted) return;
  syncPending = true;
  try {
    const response = await gameFrameOptionalFetch("/api/me/cascade/progression", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: serialized,
    }, identity);
    if (response.ok) lastSubmitted = serialized;
    if (response.status === 401) identity = null;
  } catch {
    // Gamer progression is optional platform metadata. Cascade must remain
    // playable even when the player session or progression service is absent.
  } finally {
    syncPending = false;
  }
}

async function start() {
  identity = await tryGameFrameIdentity({
    preferredDevelopmentPlayerId: query.get("player"),
  });
  if (!identity) return;
  await submitSnapshot();
  window.setInterval(() => void submitSnapshot(), SYNC_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void submitSnapshot();
  });
}

void start();
