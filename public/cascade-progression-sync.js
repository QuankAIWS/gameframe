import { gameFrameOptionalFetch, tryGameFrameIdentity } from "./gameframe-auth.js";

const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const PERFORMANCE_KEY = "scribbles-gameframe.cascade-performance:v1";
const ACTIVE_RUN_KEY = "scribbles-gameframe.cascade-active-run:v1";
const OWNER_KEY = "scribbles-gameframe.cascade-progression-owner:v1";
const CANDIDATE_KEY = "scribbles-gameframe.cascade-progression-candidate:v1";
const VISIT_KEY = "scribbles-gameframe.cascade-progression-visit:v1";
const RELOAD_KEY = "scribbles-gameframe.cascade-progression-reload:v1";
const LOCAL_CHANGE_INTERVAL_MS = 1_000;
const SERVER_RECONCILE_INTERVAL_MS = 5 * 60 * 1_000;
const MIN_EVENT_RECONCILE_GAP_MS = 60_000;
const storage = window.localStorage;
const query = new URLSearchParams(window.location.search);
let lastSubmitted = "";
let syncPending = false;
let identity = null;
let lastServerReconcileAt = 0;

function readJson(key) {
  try {
    const value = JSON.parse(storage.getItem(key) || "null");
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function visitId() {
  const existing = window.sessionStorage.getItem(VISIT_KEY)?.trim();
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(VISIT_KEY, created);
  return created;
}

const currentVisitId = visitId();

function readCandidate() {
  const candidate = readJson(CANDIDATE_KEY);
  if (
    !candidate
    || typeof candidate.playerId !== "string"
    || !candidate.playerId.trim()
    || typeof candidate.visitId !== "string"
    || !candidate.visitId.trim()
  ) return null;
  return {
    playerId: candidate.playerId.trim(),
    visitId: candidate.visitId.trim(),
  };
}

function writeCandidate(playerId) {
  storage.setItem(CANDIDATE_KEY, JSON.stringify({ playerId, visitId: currentVisitId }));
}

function normalizedLevel(value, fallback = 1) {
  const level = Math.floor(Number(value));
  if (!Number.isFinite(level)) return fallback;
  return Math.max(1, Math.min(300, level));
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

function normalizedProgression(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    highestCompletedLevel: Math.max(0, Math.min(300, Math.floor(Number(value.highestCompletedLevel) || 0))),
    starsByLevel: normalizedStars(value.starsByLevel),
  };
}

function progressionFromResponse(body) {
  return normalizedProgression(body?.cascade ?? body?.progression?.cascade ?? null);
}

const initialActiveRunLevel = (() => {
  const activeRun = readJson(ACTIVE_RUN_KEY);
  if (!activeRun) return null;
  const level = normalizedLevel(activeRun.level, 0);
  return level || null;
})();

function snapshot() {
  const state = readJson(STATE_KEY) || {};
  const performance = readJson(PERFORMANCE_KEY) || {};
  const starsByLevel = normalizedStars(performance.starsByLevel);
  const highestStarLevel = Object.keys(starsByLevel).reduce((highest, rawLevel) => Math.max(highest, Number(rawLevel) || 0), 0);
  const unlockedLevel = normalizedLevel(state.level);
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
    return owner === identity?.playerId ? owner : null;
  }

  if (!identity) return null;

  // A blank browser can safely bind immediately. Existing anonymous progress is
  // intentionally a two-visit migration so a one-off login cannot silently claim
  // another household member's local save. The visit marker keeps background
  // synchronization and same-tab reloads from satisfying the second visit.
  if (!hasProgress(current)) {
    storage.setItem(OWNER_KEY, identity.playerId);
    storage.removeItem(CANDIDATE_KEY);
    return identity.playerId;
  }

  const candidate = readCandidate();
  if (
    candidate?.playerId === identity.playerId
    && candidate.visitId !== currentVisitId
  ) {
    storage.setItem(OWNER_KEY, identity.playerId);
    storage.removeItem(CANDIDATE_KEY);
    return identity.playerId;
  }

  // Legacy raw-string candidates and candidates for another identity are both
  // rewritten for this visit instead of being trusted as proof of a prior visit.
  writeCandidate(identity.playerId);
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

function shouldProtectLoadedRun() {
  if (!initialActiveRunLevel) return false;
  const state = readJson(STATE_KEY) || {};
  const activeRun = readJson(ACTIVE_RUN_KEY);
  if (!activeRun) return false;
  return normalizedLevel(state.level) === initialActiveRunLevel
    && normalizedLevel(activeRun.level, 0) === initialActiveRunLevel;
}

function applyCanonicalToLocal(canonical, { preserveLevel = false } = {}) {
  const state = readJson(STATE_KEY) || {};
  const performance = readJson(PERFORMANCE_KEY) || {};
  const currentLevel = normalizedLevel(state.level);
  const nextLevel = preserveLevel
    ? currentLevel
    : Math.max(currentLevel, Math.min(300, canonical.highestCompletedLevel + 1));
  const nextStars = { ...normalizedStars(performance.starsByLevel), ...canonical.starsByLevel };
  const stateChanged = nextLevel !== currentLevel;
  const starsChanged = JSON.stringify(normalizedStars(performance.starsByLevel)) !== JSON.stringify(nextStars);
  if (stateChanged) storage.setItem(STATE_KEY, JSON.stringify({ ...state, level: nextLevel }));
  if (starsChanged) storage.setItem(PERFORMANCE_KEY, JSON.stringify({ ...performance, starsByLevel: nextStars }));
  return { stateChanged, starsChanged };
}

async function fetchServerProgression() {
  const response = await gameFrameOptionalFetch("/api/me/progression", { method: "GET" }, identity);
  if (response.status === 401) {
    identity = null;
    return null;
  }
  if (!response.ok) return null;
  const body = await response.json().catch(() => null);
  return progressionFromResponse(body);
}

async function submitCanonical(canonical) {
  const serialized = JSON.stringify(canonical);
  if (serialized === lastSubmitted) return true;
  const response = await gameFrameOptionalFetch("/api/me/cascade/progression", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: serialized,
  }, identity);
  if (response.status === 401) {
    identity = null;
    return false;
  }
  if (!response.ok) return false;

  const body = await response.json().catch(() => null);
  const server = progressionFromResponse(body);
  lastSubmitted = JSON.stringify(server ? mergeProgression(canonical, server) : canonical);
  return true;
}

function maybeReloadAfterHydration(canonical, stateChanged, preserveLevel) {
  if (!stateChanged || preserveLevel) return false;
  const marker = JSON.stringify(canonical);
  if (window.sessionStorage.getItem(RELOAD_KEY) === marker) {
    window.sessionStorage.removeItem(RELOAD_KEY);
    return false;
  }
  window.sessionStorage.setItem(RELOAD_KEY, marker);
  // Reload synchronously after the canonical state write. Yielding to another
  // network request first lets the already-running Cascade runtime persist its
  // stale in-memory level back over the newly hydrated localStorage value.
  window.location.reload();
  return true;
}

async function reconcileServer({ force = false } = {}) {
  if (!identity || syncPending || !navigator.onLine || document.hidden) return;
  const current = snapshot();
  if (resolveOwner(current) !== identity.playerId) return;

  const now = Date.now();
  if (!force && now - lastServerReconcileAt < MIN_EVENT_RECONCILE_GAP_MS) return;
  syncPending = true;
  try {
    const server = await fetchServerProgression();
    if (!identity || !server) return;
    lastServerReconcileAt = Date.now();

    const canonical = mergeProgression(current, server);
    const preserveLevel = shouldProtectLoadedRun();
    const changes = applyCanonicalToLocal(canonical, { preserveLevel });
    if (maybeReloadAfterHydration(canonical, changes.stateChanged, preserveLevel)) return;

    const canonicalSerialized = JSON.stringify(canonical);
    const serverSerialized = JSON.stringify(normalizedProgression(server));
    if (canonicalSerialized === serverSerialized) {
      lastSubmitted = canonicalSerialized;
      return;
    }
    await submitCanonical(canonical);
  } catch {
    // Cascade remains fully playable from its local save while offline or while
    // optional GameFrame progression services are temporarily unavailable.
  } finally {
    syncPending = false;
  }
}

async function publishLocalChanges() {
  if (!identity || syncPending || !navigator.onLine || document.hidden) return;
  const current = snapshot();
  if (resolveOwner(current) !== identity.playerId) return;
  if (JSON.stringify(current) === lastSubmitted) return;

  syncPending = true;
  try {
    await submitCanonical(current);
  } catch {
    // Leave lastSubmitted unchanged so the next local check retries the same
    // progression after a transient failure instead of losing the update.
  } finally {
    syncPending = false;
  }
}

async function establishIdentity() {
  if (identity) return identity;
  identity = await tryGameFrameIdentity({
    preferredDevelopmentPlayerId: query.get("player"),
  });
  return identity;
}

async function establishAndSynchronize({ force = false } = {}) {
  if (!await establishIdentity()) return;
  await reconcileServer({ force });
  await publishLocalChanges();
}

void establishAndSynchronize({ force: true });
window.setInterval(() => void publishLocalChanges(), LOCAL_CHANGE_INTERVAL_MS);
window.setInterval(() => void reconcileServer(), SERVER_RECONCILE_INTERVAL_MS);
window.addEventListener("online", () => void establishAndSynchronize({ force: true }));
window.addEventListener("focus", () => void establishAndSynchronize());
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void establishAndSynchronize();
});
