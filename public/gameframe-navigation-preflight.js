(() => {
  const storageKey = "scribbles-gameframe.internal-home-return:v1";
  const recentMatchStorageKey = "scribbles-gameframe.recent-match";
  const maxAgeMs = 15000;

  try {
    // A durable match is now resumed explicitly from its URL or the player's
    // Matches/Home feed. The old single-browser recent-match pointer must not
    // hijack a plain Home or Games visit.
    if (!new URLSearchParams(window.location.search).has("match")) {
      window.localStorage.removeItem(recentMatchStorageKey);
    }

    const value = window.sessionStorage.getItem(storageKey);
    if (value === null) return;
    window.sessionStorage.removeItem(storageKey);

    const markedAt = Number(value);
    if (!Number.isFinite(markedAt)) return;
    if (Date.now() - markedAt < 0 || Date.now() - markedAt > maxAgeMs) return;

    document.documentElement.classList.add("gameframe-internal-home-return");
  } catch {
    // Internal-return presentation state is cosmetic and must never block startup.
  }
})();
