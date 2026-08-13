const BUILD_ENDPOINT = "/api/client-build";
const CHECK_TIMEOUT_MS = 1_200;
const LONG_IDLE_MS = 30 * 60 * 1_000;
const REFRESH_LEAD_MS = 110;

let loadedBuildId = null;
let currentBuildId = null;
let pendingBuildId = null;
let baselinePromise = null;
let checkPromise = null;
let hiddenAt = 0;

async function fetchCurrentBuildId() {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    const response = await fetch(BUILD_ENDPOINT, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const body = await response.json();
    const buildId = String(body?.buildId ?? "").trim();
    return buildId || null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

async function establishBaseline() {
  if (loadedBuildId) return loadedBuildId;
  if (baselinePromise) return baselinePromise;
  baselinePromise = fetchCurrentBuildId()
    .then((buildId) => {
      if (buildId) {
        loadedBuildId = buildId;
        currentBuildId = buildId;
      }
      return loadedBuildId;
    })
    .finally(() => {
      baselinePromise = null;
    });
  return baselinePromise;
}

function publishPendingChange(previousPending) {
  if (pendingBuildId && pendingBuildId !== previousPending) {
    window.dispatchEvent(new CustomEvent("gameframe:build-update-pending", {
      detail: {
        loadedBuildId,
        currentBuildId,
        pendingBuildId,
      },
    }));
  }
}

async function checkForUpdate() {
  const baseline = await establishBaseline();
  if (!baseline) return false;
  if (checkPromise) return checkPromise;

  checkPromise = fetchCurrentBuildId()
    .then((buildId) => {
      if (!buildId) return Boolean(pendingBuildId);
      const previousPending = pendingBuildId;
      currentBuildId = buildId;
      pendingBuildId = buildId === loadedBuildId ? null : buildId;
      publishPendingChange(previousPending);
      return Boolean(pendingBuildId);
    })
    .finally(() => {
      checkPromise = null;
    });
  return checkPromise;
}

async function refreshIfPending() {
  if (!pendingBuildId) return false;
  window.dispatchEvent(new CustomEvent("gameframe:build-refresh", {
    detail: {
      loadedBuildId,
      currentBuildId,
      pendingBuildId,
    },
  }));
  await new Promise((resolve) => window.setTimeout(resolve, REFRESH_LEAD_MS));
  window.location.reload();
  return true;
}

function stateSnapshot() {
  return Object.freeze({
    loadedBuildId,
    currentBuildId,
    pendingBuildId,
    updatePending: Boolean(pendingBuildId),
  });
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    return;
  }
  if (!hiddenAt) return;
  const idleFor = Math.max(0, Date.now() - hiddenAt);
  hiddenAt = 0;
  if (idleFor >= LONG_IDLE_MS) void checkForUpdate();
});

void establishBaseline();

export const gameFrameBuildRefresh = Object.freeze({
  endpoint: BUILD_ENDPOINT,
  checkForUpdate,
  refreshIfPending,
  isUpdatePending: () => Boolean(pendingBuildId),
  state: stateSnapshot,
  baselineReady: () => establishBaseline(),
});

window.gameFrameBuildRefresh = gameFrameBuildRefresh;
