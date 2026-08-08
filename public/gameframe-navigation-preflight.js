(() => {
  const storageKey = "scribbles-gameframe.internal-home-return:v1";
  const maxAgeMs = 15000;

  try {
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
