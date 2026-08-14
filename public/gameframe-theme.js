import { gameFrameFetch } from "./gameframe-auth.js";

const legacyThemeStorageKey = "scribbles-gameframe.shell-theme:v1";
const playerIdStorageKey = "scribbles-gameframe.player-id";

const themes = Object.freeze([
  {
    id: "standard",
    name: "GameFrame Green",
    description: "The standard GameFrame charcoal and signal-green shell.",
    colors: ["#b6ef69", "#6ce7f1", "#101a20"],
  },
  {
    id: "cascade-pop",
    name: "Cascade Pop",
    description: "Bright candy color, glossy cards, and playful arcade energy.",
    colors: ["#ff6fae", "#66e5e0", "#ffd75e"],
  },
  {
    id: "cyberpunk",
    name: "Neon Grid",
    description: "Electric cyan, ultraviolet, and hot-magenta night lighting.",
    colors: ["#37e8ff", "#8d5cff", "#ff4fd8"],
  },
  {
    id: "clockwork",
    name: "Clockwork",
    description: "Warm brass, ember light, and smoked mechanical surfaces.",
    colors: ["#e6b85f", "#d77838", "#24180f"],
  },
  {
    id: "deep-space",
    name: "Deep Space",
    description: "Cold starlight, deep indigo, and quiet blue instrumentation.",
    colors: ["#79b7ff", "#7170ff", "#10172c"],
  },
]);
const themeIds = new Set(themes.map((theme) => theme.id));

function normalizeTheme(themeId) {
  const normalized = String(themeId || "").trim().toLowerCase();
  return themeIds.has(normalized) ? normalized : "standard";
}

function currentPlayerId() {
  if (window.gameFrameIdentity?.playerId) return String(window.gameFrameIdentity.playerId);
  try { return window.localStorage.getItem(playerIdStorageKey) || ""; }
  catch { return ""; }
}

function playerThemeStorageKey(playerId = currentPlayerId()) {
  const normalizedPlayerId = String(playerId || "").trim();
  return normalizedPlayerId ? `${legacyThemeStorageKey}:${normalizedPlayerId}` : legacyThemeStorageKey;
}

function cachedPlayerTheme(playerId, allowLegacyFallback = false) {
  try {
    const scoped = window.localStorage.getItem(playerThemeStorageKey(playerId));
    if (scoped !== null) return normalizeTheme(scoped);
    if (allowLegacyFallback) return normalizeTheme(window.localStorage.getItem(legacyThemeStorageKey));
  } catch {
    // Local theme cache is cosmetic and may be unavailable in restricted storage contexts.
  }
  return "standard";
}

function storedTheme() {
  return cachedPlayerTheme(currentPlayerId(), true);
}

function cacheTheme(themeId) {
  try { window.localStorage.setItem(playerThemeStorageKey(), normalizeTheme(themeId)); }
  catch { /* Theme cache is cosmetic and must never block the player shell. */ }
}

function applyTheme(themeId, persist = true) {
  const nextTheme = normalizeTheme(themeId);
  document.documentElement.dataset.gameframeShellTheme = nextTheme;
  document.body.dataset.gameframeShellTheme = nextTheme;
  if (persist) cacheTheme(nextTheme);
  window.dispatchEvent(new CustomEvent("gameframe:theme-change", { detail: { themeId: nextTheme } }));
  return nextTheme;
}

function applyProfileTheme(root, themeId) {
  if (!(root instanceof Element)) return "standard";
  const nextTheme = normalizeTheme(themeId);
  root.dataset.profileTheme = nextTheme;
  return nextTheme;
}

async function readSavedPlayerTheme() {
  const identity = window.gameFrameIdentity;
  if (!identity) return null;
  const response = await gameFrameFetch("/api/me/feed", {}, identity);
  if (!response.ok) return null;
  const body = await response.json().catch(() => ({}));
  return {
    themeId: normalizeTheme(body.themeId),
    themeConfigured: body.themeConfigured === true,
  };
}

async function persistPlayerTheme(themeId) {
  const identity = window.gameFrameIdentity;
  if (!identity) return null;
  const response = await gameFrameFetch("/api/me/preferences", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ themeId: normalizeTheme(themeId) }),
  }, identity);
  if (!response.ok) return null;
  const body = await response.json().catch(() => ({}));
  return normalizeTheme(body.themeId);
}

function ensureShellActions() {
  const host = document.querySelector("#gameframe-shell-actions");
  if (!host) return null;

  const themeControl = document.querySelector("#gameframe-theme-control");
  const alerts = document.querySelector("#gameframe-alerts");
  const sessionBadge = document.querySelector("#gameframe-session-badge");

  for (const node of [themeControl, alerts, sessionBadge]) {
    if (node && node.parentElement !== host) host.append(node);
  }

  if (themeControl && host.firstElementChild !== themeControl) host.prepend(themeControl);
  if (alerts && sessionBadge && alerts.nextElementSibling !== sessionBadge) host.insertBefore(alerts, sessionBadge);
  return host;
}

function installGameFrameThemePicker() {
  if (document.querySelector("#gameframe-theme-control")) {
    ensureShellActions();
    return;
  }

  const host = ensureShellActions();
  if (!host) return;

  const root = document.createElement("div");
  root.id = "gameframe-theme-control";
  root.className = "gameframe-theme-control";
  root.innerHTML = `
    <button id="gameframe-theme-trigger" class="gameframe-shell-icon-button gameframe-theme-trigger" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="gameframe-theme-panel" aria-label="Choose GameFrame theme" title="Theme">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 3a9 9 0 1 0 0 18h1.4a2.1 2.1 0 0 0 0-4.2h-1.1a1.6 1.6 0 0 1 0-3.2H15A6 6 0 0 0 15 3Z" />
        <circle cx="7.5" cy="10" r="1" />
        <circle cx="9.5" cy="6.8" r="1" />
        <circle cx="13.5" cy="6.3" r="1" />
      </svg>
      <span class="gameframe-theme-current-dot" aria-hidden="true"></span>
    </button>
  `;
  host.prepend(root);

  const panel = document.createElement("section");
  panel.id = "gameframe-theme-panel";
  panel.className = "gameframe-theme-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Choose GameFrame theme");
  panel.hidden = true;
  panel.innerHTML = `
    <header class="gameframe-theme-heading">
      <span><small>GAMEFRAME</small><strong>Choose a theme</strong></span>
      <button type="button" data-theme-close aria-label="Close theme picker">×</button>
    </header>
    <div class="gameframe-theme-list" role="list"></div>
  `;
  document.body.append(panel);

  const trigger = root.querySelector("#gameframe-theme-trigger");
  const list = panel.querySelector(".gameframe-theme-list");
  const closeButton = panel.querySelector("[data-theme-close]");
  let selectionRevision = 0;
  let persistQueue = Promise.resolve();

  function renderSelection() {
    const selected = document.documentElement.dataset.gameframeShellTheme || "standard";
    for (const option of list.querySelectorAll("[data-theme-option]")) {
      const active = option.dataset.themeOption === selected;
      option.classList.toggle("is-selected", active);
      option.setAttribute("aria-pressed", String(active));
    }
    root.dataset.theme = selected;
  }

  function queuePlayerThemeSave(themeId, revision) {
    persistQueue = persistQueue
      .catch(() => null)
      .then(() => persistPlayerTheme(themeId))
      .then((savedThemeId) => {
        if (!savedThemeId || revision !== selectionRevision) return;
        applyTheme(savedThemeId);
        renderSelection();
      });
  }

  for (const theme of themes) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "gameframe-theme-option";
    option.dataset.themeOption = theme.id;
    option.setAttribute("role", "listitem");
    option.innerHTML = `
      <span class="gameframe-theme-swatch" aria-hidden="true">
        ${theme.colors.map((color) => `<i style="--swatch:${color}"></i>`).join("")}
      </span>
      <span class="gameframe-theme-option-copy">
        <strong></strong>
        <small></small>
      </span>
      <span class="gameframe-theme-check" aria-hidden="true">✓</span>
    `;
    option.querySelector("strong").textContent = theme.name;
    option.querySelector("small").textContent = theme.description;
    option.addEventListener("click", () => {
      selectionRevision += 1;
      const revision = selectionRevision;
      const selectedThemeId = applyTheme(theme.id);
      renderSelection();
      queuePlayerThemeSave(selectedThemeId, revision);
    });
    list.append(option);
  }

  function setOpen(open) {
    panel.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
    root.classList.toggle("is-open", open);
    if (open) panel.querySelector(".is-selected")?.focus();
  }

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(panel.hidden);
  });
  closeButton.addEventListener("click", () => {
    setOpen(false);
    trigger.focus();
  });
  panel.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      setOpen(false);
      trigger.focus();
    }
  });

  const observer = new MutationObserver(() => ensureShellActions());
  observer.observe(document.body, { childList: true, subtree: true });

  applyTheme(storedTheme(), false);
  renderSelection();
  ensureShellActions();

  const syncRevision = selectionRevision;
  void readSavedPlayerTheme().then((saved) => {
    if (!saved || syncRevision !== selectionRevision) return;
    const localThemeId = storedTheme();
    if (!saved.themeConfigured && localThemeId !== "standard") {
      selectionRevision += 1;
      const revision = selectionRevision;
      queuePlayerThemeSave(localThemeId, revision);
      return;
    }
    applyTheme(saved.themeId);
    renderSelection();
  }).catch(() => undefined);

  window.gameFrameThemes = Object.freeze({
    themes,
    apply: (themeId) => {
      const applied = applyTheme(themeId);
      renderSelection();
      return applied;
    },
    open: () => setOpen(true),
  });
}

applyTheme(storedTheme(), false);

export { applyProfileTheme, applyTheme, cachedPlayerTheme, installGameFrameThemePicker, normalizeTheme, themes };
