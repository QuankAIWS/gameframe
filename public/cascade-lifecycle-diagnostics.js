(() => {
  const LIFECYCLE_KEY = "scribbles-gameframe.cascade-render-lifecycle:v1";
  const ANALYTICS_KEY = "scribbles-gameframe.cascade-analytics:v1";
  const DIAGNOSTIC_QUEUE_KEY = "scribbles-gameframe.cascade-diagnostics-queue:v1";
  const RELOAD_INTENT_KEY = "scribbles-gameframe.reload-intent:v1";
  const RECENT_PRIOR_MS = 15 * 60 * 1000;
  const VFX_SAMPLE_MS = 250;
  const IDLE_PERSIST_MS = 2_000;
  const LOCAL_INCIDENT_LIMIT = 40;
  const BREADCRUMB_LIMIT = 18;
  const RECENT_VFX_SAMPLE_LIMIT = 8;
  const RECENT_FRAME_GAP_LIMIT = 6;
  const FRAME_GAP_THRESHOLD_MS = 120;

  const storage = window.localStorage;
  const session = window.sessionStorage;
  const now = Date.now();
  const navigation = performance.getEntriesByType?.("navigation")?.[0] || null;
  const navigationType = navigation?.type || "unknown";
  const documentId = `cascade-render:${crypto.randomUUID?.() || `${now}:${Math.random()}`}`;
  let lastPersistAt = 0;
  let lastInteractionAt = now;
  let lastContextLosses = 0;
  let lastAnimationFrameAt = performance.now();

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

  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function buildSnapshot() {
    try {
      return window.gameFrameBuildRefresh?.state?.() ?? null;
    } catch {
      return null;
    }
  }

  function deviceSnapshot() {
    const visual = window.visualViewport;
    const memory = performance.memory;
    return {
      userAgent: String(navigator.userAgent || "").slice(0, 300),
      platform: String(navigator.platform || "").slice(0, 80),
      deviceMemoryGb: finite(navigator.deviceMemory),
      hardwareConcurrency: finite(navigator.hardwareConcurrency),
      dpr: finite(window.devicePixelRatio),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      visualViewport: visual ? {
        width: finite(visual.width),
        height: finite(visual.height),
        scale: finite(visual.scale),
        offsetTop: finite(visual.offsetTop),
      } : null,
      screen: {
        width: finite(screen.width),
        height: finite(screen.height),
        availWidth: finite(screen.availWidth),
        availHeight: finite(screen.availHeight),
      },
      heap: memory ? {
        usedJsHeapSize: finite(memory.usedJSHeapSize),
        totalJsHeapSize: finite(memory.totalJSHeapSize),
        jsHeapSizeLimit: finite(memory.jsHeapSizeLimit),
      } : null,
    };
  }

  function breadcrumbs() {
    const value = readJson(storage, ANALYTICS_KEY, []);
    if (!Array.isArray(value)) return [];
    return value.slice(-BREADCRUMB_LIMIT).map((event) => {
      const compact = {};
      for (const key of [
        "at", "type", "mode", "level", "cascade", "combo", "matched", "specialCreated", "specialTriggered",
        "score", "movesRemaining", "booster", "bonus",
      ]) {
        const candidate = event?.[key];
        if (typeof candidate === "string" || typeof candidate === "number" || typeof candidate === "boolean") compact[key] = candidate;
      }
      return compact;
    }).filter((entry) => Object.keys(entry).length > 0);
  }

  function queueIncident(type, payload = {}) {
    try {
      const current = readJson(storage, DIAGNOSTIC_QUEUE_KEY, []);
      const queue = Array.isArray(current) ? current : [];
      const at = new Date().toISOString();
      const incident = {
        incidentId: `cascade-diagnostic:${documentId}:${type}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        at,
        type,
        payload: {
          documentId,
          navigationType,
          wasDiscarded: Boolean(document.wasDiscarded),
          build: buildSnapshot(),
          device: deviceSnapshot(),
          lifecycle: {
            visibility: document.visibilityState,
            viewportResizeCount: state?.viewportResizeCount || 0,
            visualViewportResizeCount: state?.visualViewportResizeCount || 0,
          },
          breadcrumbs: breadcrumbs(),
          ...payload,
        },
      };
      queue.push(incident);
      storage.setItem(DIAGNOSTIC_QUEUE_KEY, JSON.stringify(queue.slice(-LOCAL_INCIDENT_LIMIT)));
      window.dispatchEvent(new CustomEvent("cascade:diagnostic-queued", { detail: { incidentId: incident.incidentId, type } }));
      return incident;
    } catch {
      return null;
    }
  }

  const previous = readJson(storage, LIFECYCLE_KEY, null);
  const previousAgeMs = previous?.lastSeenAt ? Math.max(0, now - Number(previous.lastSeenAt)) : null;
  const previousRecent = previousAgeMs !== null && previousAgeMs <= RECENT_PRIOR_MS;
  const previousAbrupt = Boolean(previous && previous.cleanExit === false && previousRecent);
  const carriedReloadIntent = readJson(session, RELOAD_INTENT_KEY, null);
  try {
    session.removeItem(RELOAD_INTENT_KEY);
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
    recentVfxSamples: [],
    frameHealth: {
      maxVisibleFrameGapMs: 0,
      recentVisibleFrameGaps: [],
    },
    lastError: null,
    build: null,
    viewportResizeCount: 0,
    visualViewportResizeCount: 0,
    lastViewport: { width: window.innerWidth, height: window.innerHeight },
  };

  function persist(force = false) {
    const timestamp = Date.now();
    if (!force && timestamp - lastPersistAt < VFX_SAMPLE_MS) return;
    state.lastSeenAt = timestamp;
    state.visibility = document.visibilityState;
    state.lastInteractionAt = lastInteractionAt;
    state.build = buildSnapshot();
    state.lastViewport = { width: window.innerWidth, height: window.innerHeight };
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
    writeJson(session, RELOAD_INTENT_KEY, intent);
    persist(true);
    queueIncident("intentional_reload", {
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
      canvasDpr: finite(stats.canvasDpr),
      canvasBackingPixels: finite(stats.canvasBackingPixels),
      canvasMode: typeof stats.canvasMode === "string" ? stats.canvasMode : null,
      level: Number(document.querySelector("#level-number")?.textContent) || null,
      moves: Number(document.querySelector("#moves")?.textContent) || null,
      interactionAgeMs: Math.max(0, Date.now() - lastInteractionAt),
    };
  }

  function compactVfxSample(vfx) {
    return {
      at: vfx.at,
      dom: vfx.activeDomNodes,
      particles: vfx.activeParticles,
      groups: vfx.visibleEffectGroups,
      losses: vfx.contextLosses,
      dpr: vfx.canvasDpr,
      pixels: vfx.canvasBackingPixels,
      level: vfx.level,
      moves: vfx.moves,
    };
  }

  function rendererReport(value) {
    if (!value || typeof value !== "object") return null;
    const recentVfxSamples = Array.isArray(value.recentVfxSamples)
      ? value.recentVfxSamples.slice(-RECENT_VFX_SAMPLE_LIMIT)
      : [];
    const recentVisibleFrameGaps = Array.isArray(value.frameHealth?.recentVisibleFrameGaps)
      ? value.frameHealth.recentVisibleFrameGaps.slice(-RECENT_FRAME_GAP_LIMIT)
      : [];
    return {
      documentId: value.documentId || null,
      openedAt: finite(value.openedAt),
      lastSeenAt: finite(value.lastSeenAt),
      cleanExit: Boolean(value.cleanExit),
      visibility: value.visibility || null,
      navigationType: value.navigationType || null,
      wasDiscarded: Boolean(value.wasDiscarded),
      reloadIntent: value.reloadIntent || null,
      lastViewport: value.lastViewport || null,
      viewportResizeCount: Number(value.viewportResizeCount) || 0,
      visualViewportResizeCount: Number(value.visualViewportResizeCount) || 0,
      lastVfx: value.lastVfx || null,
      recentVfxSamples,
      frameHealth: {
        maxVisibleFrameGapMs: finite(value.frameHealth?.maxVisibleFrameGapMs) || 0,
        recentVisibleFrameGaps,
      },
      lastError: value.lastError || null,
      build: value.build || null,
    };
  }

  function reportVisualIssue(reason = "diagnostic_pack_requested") {
    persist(true);
    return queueIncident("manual_visual_report", {
      reason: String(reason || "diagnostic_pack_requested").slice(0, 120),
      currentRenderer: rendererReport(state),
      previousRenderer: rendererReport(previous),
    });
  }

  if (previousAbrupt) {
    queueIncident("abrupt_renderer_recovery", {
      previousDocumentId: previous.documentId || null,
      previousAgeMs,
      previousVisibility: previous.visibility || null,
      previousBuild: previous.build || null,
      previousLastViewport: previous.lastViewport || null,
      previousViewportResizeCount: Number(previous.viewportResizeCount) || 0,
      previousVisualViewportResizeCount: Number(previous.visualViewportResizeCount) || 0,
      previousLastVfx: previous.lastVfx || null,
      previousLastError: previous.lastError || null,
      currentNavigationType: navigationType,
      currentWasDiscarded: state.wasDiscarded,
      carriedReloadIntent,
    });
  }

  if (state.wasDiscarded) {
    queueIncident("browser_discard_recovery", {
      previousDocumentId: previous?.documentId || null,
      previousLastVfx: previous?.lastVfx || null,
      previousLastError: previous?.lastError || null,
    });
  }

  persist(true);

  function noteInteraction() {
    lastInteractionAt = Date.now();
  }
  window.addEventListener("pointerdown", noteInteraction, { passive: true });
  window.addEventListener("touchstart", noteInteraction, { passive: true });
  window.addEventListener("keydown", noteInteraction);

  window.addEventListener("resize", () => {
    state.viewportResizeCount += 1;
    persist(true);
  }, { passive: true });
  window.visualViewport?.addEventListener("resize", () => {
    state.visualViewportResizeCount += 1;
    persist(true);
  }, { passive: true });

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
    queueIncident("javascript_error", { error: state.lastError, lastVfx: state.lastVfx });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason instanceof Error ? event.reason.message : String(event?.reason || "unhandled rejection");
    state.lastError = {
      at: Date.now(),
      type: "unhandledrejection",
      message: reason.slice(0, 240),
    };
    persist(true);
    queueIncident("unhandled_rejection", { error: state.lastError, lastVfx: state.lastVfx });
  });

  window.addEventListener("pagehide", (event) => {
    state.cleanExit = true;
    state.exitAt = Date.now();
    state.pagehidePersisted = Boolean(event.persisted);
    persist(true);
  });

  function watchAnimationFrame(frameAt) {
    const gapMs = Math.max(0, frameAt - lastAnimationFrameAt);
    lastAnimationFrameAt = frameAt;
    if (document.visibilityState === "visible" && Date.now() - state.openedAt > 1_000 && gapMs >= FRAME_GAP_THRESHOLD_MS) {
      state.frameHealth.maxVisibleFrameGapMs = Math.max(state.frameHealth.maxVisibleFrameGapMs, Math.round(gapMs));
      state.frameHealth.recentVisibleFrameGaps.push({ at: Date.now(), gapMs: Math.round(gapMs) });
      state.frameHealth.recentVisibleFrameGaps = state.frameHealth.recentVisibleFrameGaps.slice(-RECENT_FRAME_GAP_LIMIT);
      persist();
    }
    window.requestAnimationFrame(watchAnimationFrame);
  }
  window.requestAnimationFrame(watchAnimationFrame);

  window.setInterval(() => {
    const vfx = snapshotVfx();
    if (vfx && vfx.contextLosses > lastContextLosses) {
      queueIncident("canvas_context_loss", {
        previousContextLosses: lastContextLosses,
        currentContextLosses: vfx.contextLosses,
        lastVfx: vfx,
      });
    }
    if (vfx) lastContextLosses = vfx.contextLosses;
    const active = Boolean(vfx && (vfx.activeDomNodes > 0 || vfx.activeParticles > 0 || vfx.visibleEffectGroups > 0));
    if (active) {
      state.lastVfx = vfx;
      state.recentVfxSamples.push(compactVfxSample(vfx));
      state.recentVfxSamples = state.recentVfxSamples.slice(-RECENT_VFX_SAMPLE_LIMIT);
      persist();
      return;
    }
    if (Date.now() - lastPersistAt >= IDLE_PERSIST_MS) persist(true);
  }, VFX_SAMPLE_MS);

  window.cascadeLifecycleDiagnostics = Object.freeze({
    key: LIFECYCLE_KEY,
    diagnosticQueueKey: DIAGNOSTIC_QUEUE_KEY,
    markReloadIntent,
    recordIncident: queueIncident,
    reportVisualIssue,
    snapshotVfx,
    snapshot: () => JSON.parse(JSON.stringify(state)),
    previous: () => previous ? JSON.parse(JSON.stringify(previous)) : null,
  });
})();
