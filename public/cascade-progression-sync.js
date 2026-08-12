import { establishGameFrameIdentity, gameFrameFetch } from "./gameframe-auth.js";

const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const PERFORMANCE_KEY = "scribbles-gameframe.cascade-performance:v1";
const OWNER_KEY = "scribbles-gameframe.cascade-progression-owner:v1";
const storage = window.localStorage;
const previousSetItem = Storage.prototype.setItem;
const query = new URLSearchParams(window.location.search);
let syncTimer = null;
let lastSubmitted = "";

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

const identityPromise = establishGameFrameIdentity({
  preferredDevelopmentPlayerId: query.get("player"),
});

async function submitSnapshot() {
  syncTimer = null;
  const identity = await identityPromise;
  const current = snapshot();
  const hasProgress = current.highestCompletedLevel > 0 || Object.keys(current.starsByLevel).length > 0;
  const owner = storage.getItem(OWNER_KEY);
  if (!owner && !hasProgress) {
    storage.setItem(OWNER_KEY, identity.playerId);
  }
  if (storage.getItem(OWNER_KEY) !== identity.playerId) return;
  const serialized = JSON.stringify(current);
  if (serialized === lastSubmitted) return;
  try {
    const response = await gameFrameFetch("/api/me/cascade/progression", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: serialized,
    }, identity);
    if (!response.ok) return;
    lastSubmitted = serialized;
  } catch {
    // Gamer progression is additive platform metadata. Cascade play must never
    // fail because the player-platform projection is unavailable.
  }
}

function scheduleSync() {
  if (syncTimer) window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => void submitSnapshot(), 140);
}

Storage.prototype.setItem = function gameFrameCascadeProgressionSetItem(key, value) {
  const result = previousSetItem.call(this, key, value);
  if (this === storage && (key === STATE_KEY || key === PERFORMANCE_KEY)) scheduleSync();
  return result;
};

void identityPromise.then(() => scheduleSync());
