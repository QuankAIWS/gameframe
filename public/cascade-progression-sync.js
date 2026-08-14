import { gameFrameOptionalFetch, tryGameFrameIdentity } from "./gameframe-auth.js";

const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const PERFORMANCE_KEY = "scribbles-gameframe.cascade-performance:v1";
const ACTIVE_RUN_KEY = "scribbles-gameframe.cascade-active-run:v1";
const OWNER_KEY = "scribbles-gameframe.cascade-progression-owner:v1";
const CANDIDATE_KEY = "scribbles-gameframe.cascade-progression-candidate:v1";
const RELOAD_KEY = "scribbles-gameframe.cascade-progression-reload:v1";
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

function normalizedStars(value) {
  const starsByLevel = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return starsByLevel;
  for (const [rawLevel, rawStars] of Object.entries(value)) {
    const level = Number(rawLevel);
    const stars = Number(rawStars);
    if (!Number.isInteger(level) || level < 1 || level > 300 || !Number.isFinite(stars)) continue;
    const best = Math.max(0, Math.min(3, Math.floor(stars)));
    if (best) starsByLevel[String(level)] = best;
  }
  return starsByLevel;
}

function snapshot() {
  const state = readJson(STATE_KEY) || {};
  const performance = readJson(PERFORMANCE_KEY) || {};
  const starsByLevel = normalizedStars(performance.starsByLevel);
  const highestStarLevel = Object.keys(starsByLevel).reduce((highest, rawLevel) => Math.max(highest, Number(rawLevel) || 0), 0);
  const unlockedLevel = Math.max(1, Math.min(300, Math.floor(Number(state.level) || 1)));
  return {
    highestCompletedLevel: Math.max(highestStarLevel, unlockedLevel - 1),
    starsByLevel,
  };
}

function hasProgress(value) {
  return value.highestCompletedLevel > 0 || Object.keys(value.starsByLevel).length > 0;
}

function resolveOwner(current) {
  const owner = storage.getItem(OWNER_KEY);
  if (owner) {
    storage.removeItem(CANDIDATE_KEY);
    return owner === identity.playerId ? owner : null;
  }

  // A blank browser can safely bind immediately. Existing anonymous progress is
  // intentionally a two-visit migration so a one-off login cannot silently claim
  // another household member's local save.
  if (!hasProgress(current)) {
    storage.setItem(OWNER_KEY, identity.playerId);
    storage.removeItem(CANDIDATE_KEY);
    return identity.playerId;
  }

  const candidate = storage.getItem(CANDIDATE_KEY);
  if (candidate === identity.playerId) {
    storage.setItem(OWNER_KEY, identity.playerId);
    storage.removeItem(CANDIDATE_KEY);
    return identity.playerId;
  }
  storage.setItem(CANDIDATE_KEY, identity.playerId);
  return null;
}

function mergeProgression(local, server) {
  const serverStars = normalizedStars(server?.starsByLevel);
  const starsByLevel = { ...serverStars };
  for (const [level, stars] of Object.entries(local.starsByLevel)) {
    starsByLevel[level] = Math.max(Number(starsByLevel[level]) || 0, stars);
  }
  return {
    highestCompletedLevel: Math.max(
      local.highestCompletedLevel,
      Math.max(0, Math.min(300, Math.floor(Number(server?.highestCompletedLevel) || 0))),
    ),
    starsByLevel,
  };
}

function applyCanonicalToLocal(canonical) {
  const state = readJson(STATE_KEY) || {};
  const performance = readJson(PERFORMANCE_KEY) || {};
  const nextLevel = Math.max(
    Math.max(1, Math.min(300, Math.floor(Number(state.level) || 1))),
    Math.min(300, canonical.highestCompletedLevel + 1),
  );
  const nextStars = { ...normalizedStars(performance.starsByLevel), ...canonical.starsByLevel };
  const stateChanged = nextLevel !== Math.max(1, Math.floor(Number(state.level) || 1));
  const starsChanged = JSON.stringify(normalizedStars(performance.starsByLevel)) !== JSON.stringify(nextStars);
  if (!stateChanged && !starsChanged) return false;
  storage.setItem(STATE_KEY, JSON.stringify({ ...state, level: nextLevel }));
  storage.setItem(PERFORMANCE_KEY, JSON.stringify({ ...performance, starsByLevel: nextStars }));
  return true;
}

async function fetchServerProgression() {
  const response = await gameFrameOptionalFetch("/api/me/progression", { method: "GET" }, identity);
  if (response.status === 401) {
    identity = null;
    return null;
  }
  if (!response.ok) return null;
  const body = await response.json().catch(() => null);
  return body?.progression?.cascade ?? null;
}

async function submitCanonical(canonical) {
  const serialized = JSON.stringify(canonical);
  if (serialized === lastSubmitted) return;
  const response = await gameFrameOptionalFetch("/api/me/cascade/progression", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: serialized,
  }, identity);
  if (response.ok) lastSubmitted = serialized;
  if (response.status === 401) identity = null;
}

function maybeReloadAfterHydration(canonical, localChanged) {
  if (!localChanged || storage.getItem(ACTIVE_RUN_KEY)) return;
  const marker = JSON.stringify(canonical);
  if (window.sessionStorage.getItem(RELOAD_KEY) === marker) {
    window.sessionStorage.removeItem(RELOAD_KEY);
    return;
  }
  window.sessionStorage.setItem(RELOAD_KEY, marker);
  window.location.reload();
}

async function synchronize() {
  if (!identity || syncPending || !navigator.onLine) return;
  const current = snapshot();
  if (resolveOwner(current) !== identity.playerId) return;
  syncPending = true;
  try {
    const server = await fetchServerProgression();
    if (!identity || !server) return;
    const canonical = mergeProgression(current, server);
    const localChanged = applyCanonicalToLocal(canonical);
    await submitCanonical(canonical);
    maybeReloadAfterHydration(canonical, localChanged);
  } catch {
    // Cascade remains fully playable from its local save while offline or while
    // optional GameFrame progression services are temporarily unavailable.
  } finally {
    syncPending = false;
  }
}

async function establishAndSynchronize() {
  if (!identity) {
    identity = await tryGameFrameIdentity({
      preferredDevelopmentPlayerId: query.get("player"),
    });
  }
  if (identity) await synchronize();
}

void establishAndSynchronize();
window.setInterval(() => void synchronize(), SYNC_INTERVAL_MS);
window.addEventListener("online", () => void establishAndSynchronize());
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void establishAndSynchronize();
});
