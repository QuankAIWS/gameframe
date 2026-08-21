import { gameFrameOptionalFetch, tryGameFrameIdentity } from "./gameframe-auth.js";

const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const PERFORMANCE_KEY = "scribbles-gameframe.cascade-performance:v1";
const ACTIVE_RUN_KEY = "scribbles-gameframe.cascade-active-run:v1";
const OWNER_KEY = "scribbles-gameframe.cascade-progression-owner:v1";
const CANDIDATE_KEY = "scribbles-gameframe.cascade-progression-candidate:v1";
const RELOAD_KEY = "scribbles-gameframe.cascade-progression-reload:v1";
const LOCAL_CHANGE_INTERVAL_MS = 1_000;
const SERVER_RECONCILE_INTERVAL_MS = 5 * 60 * 1_000;
const MIN_EVENT_RECONCILE_GAP_MS = 60_000;
const BASE_RETRY_MS = 15_000;
const MAX_RETRY_MS = 5 * 60 * 1_000;
const storage = window.localStorage;
const query = new URLSearchParams(window.location.search);
const requestedReplayLevel = (() => {
  const value = Math.floor(Number(query.get("replay")));
  return Number.isInteger(value) && value >= 1 && value <= 300 ? value : 0;
})();
let lastSubmitted = "";
let syncPending = false;
let identity = null;
let lastServerReconcileAt = 0;
let networkRetryMs = 0;
let nextNetworkAttemptAt = 0;

function readJson(key) {
  try {
    const value = JSON.parse(storage.getItem(key) || "null");
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function networkAttemptAllowed() {
  return Date.now() >= nextNetworkAttemptAt;
}

function noteNetworkSuccess() {
  networkRetryMs = 0;
  nextNetworkAttemptAt = 0;
}

function noteNetworkFailure() {
  networkRetryMs = networkRetryMs
    ? Math.min(MAX_RETRY_MS, networkRetryMs * 2)
    : BASE_RETRY_MS;
  nextNetworkAttemptAt = Date.now() + networkRetryMs;
}

function resetNetworkBackoff() {
  networkRetryMs = 0;
  nextNetworkAttemptAt = 0;
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

function ownerState() {
  const owner = storage.getItem(OWNER_KEY)?.trim() || null;
  if (!identity) return { owner, owned: false, foreign: false };
  if (!owner) {
    storage.setItem(OWNER_KEY, identity.playerId);
    storage.removeItem(CANDIDATE_KEY);
    return { owner: identity.playerId, owned: true, foreign: false };
  }
  if (owner === identity.playerId) {
    storage.removeItem(CANDIDATE_KEY);
    return { owner, owned: true, foreign: false };
  }
  return { owner, owned: false, foreign: true };
}

function bindCurrentOwner() {
  if (!identity) return;
  storage.setItem(OWNER_KEY, identity.playerId);
  storage.removeItem(CANDIDATE_KEY);
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

function activeRunState() {
  const state = readJson(STATE_KEY) || {};
  const activeRun = readJson(ACTIVE_RUN_KEY);
  const currentLevel = normalizedLevel(state.level);
  const activeRunLevel = activeRun ? normalizedLevel(activeRun.level, 0) : 0;
  return {
    activeRun,
    activeRunLevel,
    currentLevel,
    current: Boolean(activeRunLevel && activeRunLevel === currentLevel),
  };
}

function hydrationPolicy(server, ownership) {
  const activeRun = activeRunState();
  if (ownership.foreign) {
    return {
      preserveLevel: false,
      discardActiveRun: Boolean(activeRun.activeRun),
    };
  }
  if (requestedReplayLevel > 0) {
    return {
      preserveLevel: true,
      discardActiveRun: false,
    };
  }
  if (!activeRun.current) {
    return {
      preserveLevel: false,
      discardActiveRun: false,
    };
  }

  // An active run is only current while the authenticated account has not
  // completed that level elsewhere. Once the server has completed this level,
  // keeping the saved board would pin the browser behind the canonical frontier.
  const serverHighestCompleted = Math.max(0, Math.min(300, Math.floor(Number(server?.highestCompletedLevel) || 0)));
  const staleActiveRun = serverHighestCompleted >= activeRun.activeRunLevel;
  return {
    preserveLevel: !staleActiveRun,
    discardActiveRun: staleActiveRun,
  };
}

function applyCanonicalToLocal(canonical, { preserveLevel = false, replace = false } = {}) {
  const state = readJson(STATE_KEY) || {};
  const performance = readJson(PERFORMANCE_KEY) || {};
  const currentLevel = normalizedLevel(state.level);
  const canonicalLevel = Math.min(300, canonical.highestCompletedLevel + 1);
  const nextLevel = preserveLevel
    ? currentLevel
    : replace
      ? canonicalLevel
      : Math.max(currentLevel, canonicalLevel);
  const localStars = normalizedStars(performance.starsByLevel);
  const nextStars = replace
    ? normalizedStars(canonical.starsByLevel)
    : { ...localStars, ...canonical.starsByLevel };
  const stateChanged = nextLevel !== currentLevel;
  const starsChanged = JSON.stringify(localStars) !== JSON.stringify(nextStars);
  if (stateChanged) storage.setItem(STATE_KEY, JSON.stringify({ ...state, level: nextLevel }));
  if (starsChanged) storage.setItem(PERFORMANCE_KEY, JSON.stringify({ ...performance, starsByLevel: nextStars }));
  return { stateChanged, starsChanged };
}

async function fetchServerProgression() {
  try {
    const response = await gameFrameOptionalFetch("/api/me/progression", { method: "GET" }, identity);
    if (response.status === 401) {
      identity = null;
      resetNetworkBackoff();
      return null;
    }
    if (!response.ok) {
      noteNetworkFailure();
      return null;
    }
    const body = await response.json().catch(() => null);
    const progression = progressionFromResponse(body);
    if (!progression) {
      noteNetworkFailure();
      return null;
    }
    noteNetworkSuccess();
    return progression;
  } catch {
    noteNetworkFailure();
    return null;
  }
}

async function submitCanonical(canonical) {
  const serialized = JSON.stringify(canonical);
  if (serialized === lastSubmitted) return true;
  try {
    const response = await gameFrameOptionalFetch("/api/me/cascade/progression", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: serialized,
    }, identity);
    if (response.status === 401) {
      identity = null;
      resetNetworkBackoff();
      return false;
    }
    if (!response.ok) {
      noteNetworkFailure();
      return false;
    }

    const body = await response.json().catch(() => null);
    const server = progressionFromResponse(body);
    lastSubmitted = JSON.stringify(server ? mergeProgression(canonical, server) : canonical);
    noteNetworkSuccess();
    return true;
  } catch {
    noteNetworkFailure();
    return false;
  }
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
  if (!networkAttemptAllowed()) return;

  const now = Date.now();
  if (!force && now - lastServerReconcileAt < MIN_EVENT_RECONCILE_GAP_MS) return;
  const current = snapshot();
  const ownership = ownerState();

  syncPending = true;
  try {
    // Server progression is always readable for the authenticated player. Local
    // ownership only decides whether this browser may merge/upload its save.
    const server = await fetchServerProgression();
    if (!identity || !server) return;
    lastServerReconcileAt = Date.now();

    const canonical = ownership.foreign
      ? normalizedProgression(server)
      : mergeProgression(current, server);
    if (!canonical) return;

    const policy = hydrationPolicy(server, ownership);
    if (policy.discardActiveRun) storage.removeItem(ACTIVE_RUN_KEY);
    const changes = applyCanonicalToLocal(canonical, {
      preserveLevel: policy.preserveLevel,
      replace: ownership.foreign,
    });

    if (ownership.foreign) {
      // A different authenticated player must never inherit/upload the previous
      // owner's local Cascade frontier or suspended board. Replace it with this
      // player's server progression first, then rebind the browser to the account.
      bindCurrentOwner();
    }

    if (maybeReloadAfterHydration(canonical, changes.stateChanged, policy.preserveLevel)) {
      lastSubmitted = JSON.stringify(canonical);
      return;
    }

    const canonicalSerialized = JSON.stringify(canonical);
    const serverSerialized = JSON.stringify(normalizedProgression(server));
    if (canonicalSerialized === serverSerialized) {
      lastSubmitted = canonicalSerialized;
      return;
    }

    if (!ownership.foreign) await submitCanonical(canonical);
  } finally {
    syncPending = false;
  }
}

async function publishLocalChanges() {
  if (!identity || syncPending || !navigator.onLine || document.hidden || !networkAttemptAllowed()) return;
  const ownership = ownerState();
  if (!ownership.owned) return;

  const current = snapshot();
  if (JSON.stringify(current) === lastSubmitted) return;

  syncPending = true;
  try {
    await submitCanonical(current);
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

async function publishCompletedLevel() {
  resetNetworkBackoff();
  if (!await establishIdentity()) return;
  await publishLocalChanges();
}

void establishAndSynchronize({ force: true });
window.setInterval(() => void publishLocalChanges(), LOCAL_CHANGE_INTERVAL_MS);
window.setInterval(() => void reconcileServer(), SERVER_RECONCILE_INTERVAL_MS);
window.addEventListener("gameframe:cascade-level-complete", () => void publishCompletedLevel());
window.addEventListener("online", () => {
  resetNetworkBackoff();
  void establishAndSynchronize({ force: true });
});
window.addEventListener("focus", () => void establishAndSynchronize({ force: true }));
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void establishAndSynchronize();
});
