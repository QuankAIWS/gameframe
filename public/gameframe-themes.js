import { gameFrameFetch } from "./gameframe-auth.js";

const THEMES = Object.freeze([
  { id: "classic", name: "Standard Grid", detail: "GameFrame green", colors: ["#b6ef69", "#6ce7f1", "#ee6bc4"] },
  { id: "cascade", name: "Cascade Pop", detail: "Candy pink, sky blue, lemon", colors: ["#ff64a7", "#5edfff", "#ffe45f"] },
  { id: "cyberpunk", name: "Neon Circuit", detail: "Electric cyan, magenta, violet", colors: ["#ff42d0", "#26e8ff", "#9e68ff"] },
  { id: "midnight", name: "Deep Space", detail: "Cobalt, ice blue, ultraviolet", colors: ["#7b92ff", "#69d5ff", "#b79bff"] },
  { id: "sunset", name: "Sunset Arcade", detail: "Amber, gold, hot coral", colors: ["#ff9b46", "#ffd167", "#ff617b"] },
]);
const themeIds = new Set(THEMES.map((theme) => theme.id));
let pendingInstallObserver = null;

export function normalizeGameFrameTheme(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return themeIds.has(normalized) ? normalized : "classic";
}

function cacheKey(identity) {
  return `gameframe.theme:v1:${identity?.playerId || "anonymous"}`;
}

function readCachedTheme(identity) {
  try { return normalizeGameFrameTheme(window.localStorage.getItem(cacheKey(identity))); }
  catch { return "classic"; }
}

function cacheTheme(identity, themeId) {
  try { window.localStorage.setItem(cacheKey(identity), normalizeGameFrameTheme(themeId)); }
  catch { /* Theme cache is cosmetic. */ }
}

export function applyGameFrameTheme(themeId) {
  const normalized = normalizeGameFrameTheme(themeId);
  document.documentElement.dataset.gameframeTheme = normalized;
  if (document.body) document.body.dataset.gameframeTheme = normalized;
  window.dispatchEvent(new CustomEvent("gameframe:theme-changed", { detail: { themeId: normalized } }));
  return normalized;
}

export function applyProfileTheme(root, themeId) {
  if (!(root instanceof Element)) return "classic";
  const normalized = normalizeGameFrameTheme(themeId);
  root.dataset.profileTheme = normalized;
  return normalized;
}

function installWhenSessionReady(identity) {
  if (pendingInstallObserver || document.querySelector("#gameframe-theme-control")) return;
  pendingInstallObserver = new MutationObserver(() => {
    if (!document.querySelector("#gameframe-session-badge")) return;
    pendingInstallObserver?.disconnect();
    pendingInstallObserver = null;
    installGameFrameThemePicker(window.gameFrameIdentity || identity);
  });
  pendingInstallObserver.observe(document.body, { childList: true, subtree: true });
}

export function installGameFrameThemePicker(identity) {
  if (!identity || document.querySelector("#gameframe-theme-control")) return;
  const sessionBadge = document.querySelector("#gameframe-session-badge");
  if (!sessionBadge) {
    installWhenSessionReady(identity);
    return;
  }
  pendingInstallObserver?.disconnect();
  pendingInstallObserver = null;

  let currentThemeId = applyGameFrameTheme(readCachedTheme(identity));
  let saving = false;
  let knownFavoriteGameIds = [];

  const root = document.createElement("div");
  root.id = "gameframe-theme-control";
  root.className = "gameframe-theme-control";
  root.innerHTML = `
    <button id="gameframe-theme-trigger" class="gameframe-theme-trigger" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="gameframe-theme-panel" aria-label="Choose GameFrame theme" title="Theme">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3a9 9 0 1 0 0 18h1.4a1.7 1.7 0 0 0 0-3.4h-.8a1.7 1.7 0 0 1 0-3.4H15A6 6 0 0 0 15 3Z"/><circle cx="7.5" cy="10" r=".9"/><circle cx="10" cy="6.8" r=".9"/><circle cx="15" cy="7" r=".9"/></svg>
    </button>
    <section id="gameframe-theme-panel" class="gameframe-theme-panel" role="dialog" aria-label="GameFrame themes" hidden>
      <header class="gameframe-theme-heading"><small>GAMEFRAME</small><strong>Choose your theme</strong></header>
      <div class="gameframe-theme-list" data-theme-list></div>
      <p class="gameframe-theme-status" data-theme-status role="status" aria-live="polite"></p>
    </section>
  `;
  sessionBadge.insertAdjacentElement("beforebegin", root);
  const trigger = root.querySelector("#gameframe-theme-trigger");
  const panel = root.querySelector("#gameframe-theme-panel");
  const list = root.querySelector("[data-theme-list]");
  const status = root.querySelector("[data-theme-status]");
  document.body.append(panel);

  function renderChoices() {
    const rows = THEMES.map((theme) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `gameframe-theme-choice${theme.id === currentThemeId ? " is-active" : ""}`;
      button.dataset.themeId = theme.id;
      button.setAttribute("aria-pressed", String(theme.id === currentThemeId));
      const swatch = document.createElement("span");
      swatch.className = "gameframe-theme-swatch";
      for (const color of theme.colors) {
        const stripe = document.createElement("i");
        stripe.style.background = color;
        swatch.append(stripe);
      }
      const copy = document.createElement("span");
      copy.className = "gameframe-theme-choice-copy";
      const strong = document.createElement("strong");
      strong.textContent = theme.name;
      const small = document.createElement("small");
      small.textContent = theme.detail;
      copy.append(strong, small);
      const check = document.createElement("span");
      check.className = "gameframe-theme-check";
      check.textContent = "✓";
      button.append(swatch, copy, check);
      button.addEventListener("click", () => void saveTheme(theme.id));
      return button;
    });
    list.replaceChildren(...rows);
  }

  function setOpen(open) {
    panel.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
    if (open) {
      window.dispatchEvent(new CustomEvent("gameframe:utility-open", { detail: { name: "theme" } }));
      renderChoices();
    }
  }

  async function saveTheme(nextThemeId) {
    if (saving) return;
    const next = normalizeGameFrameTheme(nextThemeId);
    const previous = currentThemeId;
    saving = true;
    currentThemeId = applyGameFrameTheme(next);
    cacheTheme(identity, currentThemeId);
    renderChoices();
    status.textContent = "Saving theme…";
    try {
      const response = await gameFrameFetch("/api/me/preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ favoriteGameIds: knownFavoriteGameIds, themeId: next }),
      }, identity);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Theme could not be saved.");
      if (Array.isArray(body.favoriteGameIds)) knownFavoriteGameIds = body.favoriteGameIds;
      currentThemeId = applyGameFrameTheme(body.themeId || next);
      cacheTheme(identity, currentThemeId);
      renderChoices();
      status.textContent = `${THEMES.find((theme) => theme.id === currentThemeId)?.name || "Theme"} selected.`;
    } catch (error) {
      currentThemeId = applyGameFrameTheme(previous);
      cacheTheme(identity, currentThemeId);
      renderChoices();
      status.textContent = error instanceof Error ? error.message : "Theme could not be saved.";
    } finally {
      saving = false;
    }
  }

  async function syncFromPlayer() {
    try {
      const response = await gameFrameFetch("/api/me/feed", {}, identity);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return;
      knownFavoriteGameIds = Array.isArray(body.favoriteGameIds) ? body.favoriteGameIds : [];
      currentThemeId = applyGameFrameTheme(body.themeId || currentThemeId);
      cacheTheme(identity, currentThemeId);
      renderChoices();
    } catch {
      // Cached theme is sufficient when player preferences are temporarily unavailable.
    }
  }

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(panel.hidden);
  });
  panel.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      setOpen(false);
      trigger.focus();
    }
  });
  window.addEventListener("gameframe:utility-open", (event) => {
    if (event.detail?.name !== "theme") setOpen(false);
  });

  renderChoices();
  void syncFromPlayer();
  window.gameFrameThemes = Object.freeze({
    themes: THEMES,
    get currentThemeId() { return currentThemeId; },
    open: () => setOpen(true),
    apply: applyGameFrameTheme,
  });
}

export { THEMES as GAMEFRAME_THEMES };
