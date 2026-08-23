(() => {
  const LIFECYCLE_KEY = "scribbles-gameframe.cascade-render-lifecycle:v1";
  const ANALYTICS_KEY = "scribbles-gameframe.cascade-analytics:v1";
  const RECENT_PRIOR_MS = 15 * 60 * 1000;
  const VFX_SAMPLE_MS = 250;
  const IDLE_PERSIST_MS = 2_000;

  const storage = window.localStorage;
  const session = window.sessionStorage;
  const now = Date.now();
  const navigation = performance.getEntriesByType?.("navigation")?.[0] || null;
  const navigationType = navigation?.type || "unknown";
  const documentId = `cascade-render:${crypto.randomUUID?.() || `${now}:${Math.random()}`}`;
  let lastPersistAt = 0;
  let lastInteractionAt = now;

  function readJson(target, key, fallback = null) {
    try {
      const value = JSON.parse(target.getItem(key) || "null");
      return value && typeof value === "object" ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(target, key, value) {
    try {
      target.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function appendAnalytics(type, payload = {}) {
    try {
      const current = readJson(storage, ANALYTICS_KEY, []);
      const events = Array.isArray(current) ? current : [];
      events.push({
        at: new Date().toISOString(),
        type,
        mode: "telemetry",
        ...payload,
      });
      storage.setItem(ANALYTICS_KEY, JSON.stringify(events));
    } catch {
      // Diagnostics must never affect gameplay if storage is unavailable.
    }
  }

  const previous = readJson(storage, LIFECYCLE_KEY, null);
  const previousAgeMs = previous?.lastSeenAt ? Math.max(0, now - Number(previous.lastSeenAt)) : null;
  const previousRecent = previousAgeMs !== null && previousAgeMs <= RECENT_PRIOR_MS;
  const previousAbrupt = Boolean(previous && previous.cleanExit === false && previousRecent);
  const carriedReloadIntent = readJson(session, "scribbles-gameframe.reload-intent:v1", null);
  try {
    session.removeItem("scribbles-gameframe.reload-intent:v1");
  } catch {
    // Session storage may be blocked; the current lifecycle record still works.
  }

  const state = {
    documentId,
    openedAt: now,
    lastSeenAt: now,
    cleanExit: false,
    visibility: document.visibilityState,
    navigationType,
    wasDiscarded: Boolean(document.wasDiscarded),
    reloadIntent: carriedReloadIntent,
    lastInteractionAt,
    lastVfx: null,
    lastError: null,
  };

  function persist(force = false) {
    const timestamp = Date.now();
    if (!force && timestamp - lastPersistAt < VFX_SAMPLE_MS) return;
    state.lastSeenAt = timestamp;
    state.visibility = document.visibilityState;
    state.lastInteractionAt = lastInteractionAt;
    if (writeJson(storage, LIFECYCLE_KEY, state)) lastPersistAt = timestamp;
  }

  function safeDetail(detail) {
    if (!detail || typeof detail !== "object") return null;
    const compact = {};
    for (const key of ["loadedBuildId", "currentBuildId", "pendingBuildId", "status", "source"]) {
      const value = detail[key];
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") compact[key] = value;
    }
    return Object.keys(compact).length ? compact : null;
  }

  function markReloadIntent(reason, detail = null) {
    const intent = {
      reason: String(reason || "unknown"),
      at: Date.now(),
      detail: safeDetail(detail),
    };
    state.reloadIntent = intent;
    writeJson(session, "scribbles-gameframe.reload-intent:v1", intent);
    persist(true);
    appendAnalytics("render_reload_intent", {
      reason: intent.reason,
      detail: intent.detail,
      lastVfx: state.lastVfx,
    });
  }

  function snapshotVfx() {
    const director = window.cascadePresentationDirector;
    const stats = director?.getStats?.();
    if (!stats) return null;
    const layer = document.querySelector(".cascade-juice-layer");
    let visibleEffectGroups = 0;
    if (layer) {
      for (const effect of layer.children) {
        if (getComputedStyle(effect).display !== "none") visibleEffectGroups += 1;
      }
    }
    return {
      at: Date.now(),
      activeDomNodes: Number(stats.activeDomNodes) || 0,
      peakDomNodes: Number(stats.peakDomNodes) || 0,
      activeParticles: Number(stats.activeParticles) || 0,
      peakParticles: Number(stats.peakParticles) || 0,
      contextLosses: Number(stats.contextLosses) || 0,
      visibleEffectGroups,
      level: Number(document.querySelector("#level-number")?.textContent) || null,
      moves: Number(document.querySelector("#moves")?.textContent) || null,
      interactionAgeMs: Math.max(0, Date.now() - lastInteractionAt),
    };
  }

  appendAnalytics("render_boot", {
    navigationType,
    wasDiscarded: state.wasDiscarded,
    previousAbrupt,
    previousAgeMs,
    reloadIntent: carriedReloadIntent,
  });

  if (previousAbrupt) {
    appendAnalytics("render_abrupt_recovery", {
      previousDocumentId: previous.documentId || null,
      previousAgeMs,
      previousVisibility: previous.visibility || null,
      previousLastVfx: previous.lastVfx || null,
      previousLastError: previous.lastError || null,
      currentNavigationType: navigationType,
      currentWasDiscarded: state.wasDiscarded,
    });
  }

  if (state.wasDiscarded) {
    appendAnalytics("render_discard_recovery", {
      navigationType,
      previousLastVfx: previous?.lastVfx || null,
    });
  }

  persist(true);

  window.addEventListener("pointerdown", () => {
    lastInteractionAt = Date.now();
  }, { passive: true });
  window.addEventListener("touchstart", () => {
    lastInteractionAt = Date.now();
  }, { passive: true });
  window.addEventListener("keydown", () => {
    lastInteractionAt = Date.now();
  });

  document.addEventListener("visibilitychange", () => persist(true));

  window.addEventListener("gameframe:reload-intent", (event) => {
    markReloadIntent(event?.detail?.reason || "gameframe", event?.detail);
  });
  window.addEventListener("gameframe:build-refresh", (event) => {
    markReloadIntent("build-update", event?.detail);
  });

  window.addEventListener("error", (event) => {
    state.lastError = {
      at: Date.now(),
      type: "error",
      message: String(event?.message || "unknown error").slice(0, 240),
      source: String(event?.filename || "").slice(0, 180),
      line: Number(event?.lineno) || null,
      column: Number(event?.colno) || null,
    };
    persist(true);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason instanceof Error ? event.reason.message : String(event?.reason || "unhandled rejection");
    state.lastError = {
      at: Date.now(),
      type: "unhandledrejection",
      message: reason.slice(0, 240),
    };
    persist(true);
  });

  window.addEventListener("pagehide", (event) => {
    state.cleanExit = true;
    state.exitAt = Date.now();
    state.pagehidePersisted = Boolean(event.persisted);
    persist(true);
  });

  window.setInterval(() => {
    const vfx = snapshotVfx();
    const active = Boolean(vfx && (vfx.activeDomNodes > 0 || vfx.activeParticles > 0 || vfx.visibleEffectGroups > 0));
    if (active) {
      state.lastVfx = vfx;
      persist();
      return;
    }
    if (Date.now() - lastPersistAt >= IDLE_PERSIST_MS) persist(true);
  }, VFX_SAMPLE_MS);

  window.cascadeLifecycleDiagnostics = Object.freeze({
    key: LIFECYCLE_KEY,
    markReloadIntent,
    snapshot: () => JSON.parse(JSON.stringify(state)),
    previous: () => previous ? JSON.parse(JSON.stringify(previous)) : null,
  });
})();
