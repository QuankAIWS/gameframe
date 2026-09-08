import { gameFrameOptionalFetch, tryGameFrameIdentity } from "./gameframe-auth.js";

const PENDING_KEY = "scribbles-gameframe.spider-progression-pending:v1";
const QUEUE_LIMIT = 64;
const query = new URLSearchParams(window.location.search);
let identityPromise = null;
let installedIdentity = null;
let syncPending = false;

function readQueue() {
  try {
    const value = JSON.parse(window.localStorage.getItem(PENDING_KEY) || "[]");
    return Array.isArray(value) ? value.filter((entry) => entry && typeof entry === "object") : [];
  } catch {
    window.localStorage.removeItem(PENDING_KEY);
    return [];
  }
}

function writeQueue(queue) {
  if (!queue.length) {
    window.localStorage.removeItem(PENDING_KEY);
    return;
  }
  window.localStorage.setItem(PENDING_KEY, JSON.stringify(queue.slice(-QUEUE_LIMIT)));
}

function boundedWhole(value, maximum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(maximum, Math.floor(numeric)));
}

function snapshotFromHistory(state, history = []) {
  if (!state?.seed || ![1, 2, 4].includes(Number(state.difficulty))) return null;
  const candidates = [state, ...(Array.isArray(history) ? history : [])]
    .filter((entry) => entry?.seed === state.seed && Number(entry?.difficulty) === Number(state.difficulty));
  const moveCount = Math.max(0, ...candidates.map((entry) => boundedWhole(entry?.moveCount, 1_000_000)));
  const completedRuns = Math.max(0, ...candidates.map((entry) => (
    Array.isArray(entry?.completedRuns) ? Math.min(8, entry.completedRuns.length) : 0
  )));
  const won = candidates.some((entry) => entry?.status === "won" && Array.isArray(entry?.completedRuns) && entry.completedRuns.length === 8);
  if (moveCount === 0 && completedRuns === 0 && !won) return null;
  return {
    dealId: String(state.seed).slice(0, 160),
    difficulty: Number(state.difficulty),
    moveCount,
    completedRuns,
    won,
  };
}

function mergeSnapshot(previous, incoming) {
  return {
    dealId: incoming.dealId,
    difficulty: incoming.difficulty,
    moveCount: Math.max(boundedWhole(previous?.moveCount, 1_000_000), incoming.moveCount),
    completedRuns: Math.max(boundedWhole(previous?.completedRuns, 8), incoming.completedRuns),
    won: Boolean(previous?.won || incoming.won),
  };
}

function queueKey(snapshot) {
  return `${snapshot.difficulty}:\u0000${snapshot.dealId}`;
}

async function identity() {
  if (installedIdentity) return installedIdentity;
  if (!identityPromise) {
    identityPromise = tryGameFrameIdentity({
      preferredDevelopmentPlayerId: query.get("player"),
    })
      .then((value) => {
        if (value) installedIdentity = value;
        return value;
      })
      .catch(() => null)
      .finally(() => {
        identityPromise = null;
      });
  }
  return identityPromise;
}

function announce(result, snapshot) {
  window.dispatchEvent(new CustomEvent("gameframe:spider-progression", {
    detail: { result, snapshot },
  }));
}

export function queueSpiderProgression(state, history = []) {
  const snapshot = snapshotFromHistory(state, history);
  if (!snapshot) return false;
  const queue = readQueue();
  const key = queueKey(snapshot);
  const existingIndex = queue.findIndex((entry) => queueKey(entry) === key);
  if (existingIndex >= 0) {
    queue[existingIndex] = mergeSnapshot(queue[existingIndex], snapshot);
  } else {
    queue.push(snapshot);
  }
  writeQueue(queue);
  void flushSpiderProgression();
  return true;
}

export async function flushSpiderProgression() {
  if (syncPending) return;
  let queue = readQueue();
  if (!queue.length) return;
  const currentIdentity = await identity();
  if (!currentIdentity) return;

  syncPending = true;
  try {
    queue = readQueue();
    while (queue.length) {
      const snapshot = queue[0];
      let response;
      try {
        response = await gameFrameOptionalFetch("/api/me/spider/progression", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(snapshot),
        }, currentIdentity);
      } catch {
        return;
      }
      if (response.status === 401) {
        installedIdentity = null;
        return;
      }
      if (!response.ok) return;

      const result = await response.json().catch(() => null);
      queue = readQueue();
      const key = queueKey(snapshot);
      const index = queue.findIndex((entry) => queueKey(entry) === key);
      if (index >= 0) {
        const latest = queue[index];
        const covered = boundedWhole(latest.moveCount, 1_000_000) <= snapshot.moveCount
          && boundedWhole(latest.completedRuns, 8) <= snapshot.completedRuns
          && (!latest.won || snapshot.won);
        if (covered) queue.splice(index, 1);
      }
      writeQueue(queue);
      announce(result, snapshot);
    }
  } finally {
    syncPending = false;
  }
}

export function installSpiderProgressionSync() {
  void flushSpiderProgression();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void flushSpiderProgression();
  });
  window.addEventListener("online", () => void flushSpiderProgression());
}
