(() => {
  const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
  const PERFORMANCE_KEY = "scribbles-gameframe.cascade-performance:v1";
  const FRONTIER_KEY = "scribbles-gameframe.cascade-replay-frontier:v1";
  const query = new URLSearchParams(window.location.search);

  function readJson(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value && typeof value === "object" ? value : null;
    } catch {
      return null;
    }
  }

  function levelNumber(value, fallback = 0) {
    const numeric = Math.floor(Number(value));
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(0, numeric);
  }

  function storedFrontier() {
    return levelNumber(sessionStorage.getItem(FRONTIER_KEY), 0);
  }

  function localFrontier() {
    return levelNumber(readJson(STATE_KEY)?.level, 1);
  }

  function bestStars(level) {
    return Math.max(0, Math.min(3, levelNumber(readJson(PERFORMANCE_KEY)?.starsByLevel?.[String(level)], 0)));
  }

  function restoreFrontier({ clear = false } = {}) {
    const frontier = storedFrontier();
    if (frontier > 0) {
      const state = readJson(STATE_KEY) || {};
      const current = levelNumber(state.level, 1);
      if (frontier > current) localStorage.setItem(STATE_KEY, JSON.stringify({ ...state, level: frontier }));
    }
    if (clear) sessionStorage.removeItem(FRONTIER_KEY);
    return frontier;
  }

  function start(level) {
    const target = levelNumber(level, 0);
    if (!target) return false;
    const frontier = Math.max(storedFrontier(), localFrontier());
    const cleared = target < frontier || bestStars(target) > 0;
    if (!cleared) return false;
    sessionStorage.setItem(FRONTIER_KEY, String(frontier));
    const url = new URL(window.location.href);
    url.searchParams.set("replay", String(target));
    window.location.assign(url);
    return true;
  }

  function finish() {
    const frontier = restoreFrontier({ clear: true });
    const url = new URL(window.location.href);
    url.searchParams.delete("replay");
    if (frontier > 0) window.location.assign(url);
    else window.location.replace(url);
  }

  const requestedReplay = levelNumber(query.get("replay"), 0);
  if (requestedReplay > 0) {
    const state = readJson(STATE_KEY) || {};
    const frontier = Math.max(storedFrontier(), levelNumber(state.level, 1));
    const cleared = requestedReplay < frontier || bestStars(requestedReplay) > 0;
    if (cleared) {
      sessionStorage.setItem(FRONTIER_KEY, String(frontier));
      localStorage.setItem(STATE_KEY, JSON.stringify({ ...state, level: requestedReplay }));
      document.documentElement.dataset.cascadeReplay = String(requestedReplay);
    } else {
      query.delete("replay");
      history.replaceState(null, "", `${window.location.pathname}${query.size ? `?${query}` : ""}${window.location.hash}`);
    }
  } else if (storedFrontier() > 0) {
    restoreFrontier({ clear: true });
  }

  window.addEventListener("pagehide", () => restoreFrontier());
  window.cascadeReplay = Object.freeze({
    isReplay: () => requestedReplay > 0 && Boolean(storedFrontier()),
    level: () => requestedReplay,
    frontier: () => Math.max(storedFrontier(), localFrontier()),
    start,
    finish,
    restoreFrontier,
  });
})();
