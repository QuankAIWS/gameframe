const developmentStorageKey = "scribbles-gameframe.player-id";
let installedIdentity = null;

for (const href of ["/gameframe-auth.css", "/gameframe-account-menu.css"]) {
  if (document.querySelector(`link[href="${href}"]`)) continue;
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = href;
  document.head.append(stylesheet);
}

function normalizeIdentity(value) {
  const normalized = value?.trim();
  return normalized && normalized.length <= 120 ? normalized : null;
}

function developmentIdentity(preferred) {
  const explicit = normalizeIdentity(preferred);
  if (explicit) {
    window.localStorage.setItem(developmentStorageKey, explicit);
    return explicit;
  }
  const existing = normalizeIdentity(window.localStorage.getItem(developmentStorageKey));
  if (existing) return existing;
  const created = `browser-${crypto.randomUUID()}`;
  window.localStorage.setItem(developmentStorageKey, created);
  return created;
}

function isDiscordActivity() {
  return /^\d+\.discordsays\.com$/i.test(window.location.hostname);
}

function returnTo() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function loginUrl() {
  const url = new URL("/auth/discord/start", window.location.origin);
  url.searchParams.set("returnTo", returnTo());
  return url.toString();
}

function renderAuthenticationGate(
  message = "Sign in with Discord or use Family sign-in to use this hosted GameFrame deployment.",
  options = {},
) {
  let gate = document.querySelector("#gameframe-auth-gate");
  if (!gate) {
    gate = document.createElement("section");
    gate.id = "gameframe-auth-gate";
    gate.setAttribute("role", "dialog");
    gate.setAttribute("aria-modal", "true");
    gate.innerHTML = `
      <div class="gameframe-auth-card">
        <p class="gameframe-auth-eyebrow">SECURE GAMEFRAME SESSION</p>
        <h1>GameFrame sign-in required</h1>
        <p data-auth-message></p>
        <a class="gameframe-auth-button" data-auth-login>Sign in with Discord</a>
        <button class="gameframe-auth-button" type="button" data-auth-retry hidden>Retry Activity authentication</button>
        <small>Game commands use the signed GameFrame session. Authentication does not control game rules or match state.</small>
      </div>
    `;
    document.body.append(gate);
  }
  gate.querySelector("[data-auth-message]").textContent = message;
  const login = gate.querySelector("[data-auth-login]");
  const retry = gate.querySelector("[data-auth-retry]");
  login.href = loginUrl();
  login.hidden = Boolean(options.activity);
  retry.hidden = !options.activity;
  retry.onclick = options.activity ? () => window.location.reload() : null;
  document.documentElement.classList.add("gameframe-auth-blocked");
}

function accountAvatarMarkup(identity) {
  if (identity.avatarUrl) {
    return `<img src="${identity.avatarUrl}" alt="" referrerpolicy="no-referrer">`;
  }
  return `<span class="gameframe-session-avatar" aria-hidden="true">${identity.source === "discord" ? "G" : "DEV"}</span>`;
}

function installIdentityBadge(identity) {
  if (document.querySelector("#gameframe-session-badge")) return;

  const displayName = identity.displayName || identity.playerId;
  const sourceLabel = identity.source === "discord" ? "GameFrame account" : "Local development";
  const avatar = accountAvatarMarkup(identity);

  const badge = document.createElement("aside");
  badge.id = "gameframe-session-badge";
  badge.className = "gameframe-session-badge gameframe-account-control";
  badge.innerHTML = `
    <button id="gameframe-account-trigger" class="gameframe-account-trigger" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="gameframe-account-panel">
      ${avatar}
      <strong></strong>
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m4 6 4 4 4-4" /></svg>
    </button>
  `;
  badge.querySelector("strong").textContent = displayName;
  document.body.append(badge);

  const panel = document.createElement("section");
  panel.id = "gameframe-account-panel";
  panel.className = "gameframe-account-panel";
  panel.setAttribute("role", "menu");
  panel.setAttribute("aria-label", "GameFrame account");
  panel.hidden = true;
  panel.innerHTML = `
    <div class="gameframe-account-summary">
      <span class="gameframe-account-summary-avatar">${avatar}</span>
      <span class="gameframe-account-summary-copy">
        <strong></strong>
        <small></small>
      </span>
    </div>
    <div class="gameframe-account-menu-actions"></div>
  `;
  panel.querySelector(".gameframe-account-summary-copy strong").textContent = displayName;
  panel.querySelector(".gameframe-account-summary-copy small").textContent = sourceLabel;

  const actions = panel.querySelector(".gameframe-account-menu-actions");
  if (identity.source === "discord") {
    const logout = document.createElement("button");
    logout.type = "button";
    logout.className = "gameframe-account-logout";
    logout.setAttribute("role", "menuitem");
    logout.innerHTML = `
      <span><strong>Log out</strong><small>End this GameFrame session and forget this trusted device</small></span>
      <span aria-hidden="true">↗</span>
    `;
    logout.addEventListener("click", async () => {
      logout.disabled = true;
      const label = logout.querySelector("strong");
      if (label) label.textContent = "Logging out…";
      try {
        await fetch("/auth/trusted-device/logout", { method: "POST", credentials: "same-origin" }).catch(() => null);
        await fetch("/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => null);
      } finally {
        installedIdentity = null;
        window.location.reload();
      }
    });
    actions.append(logout);
  } else {
    const local = document.createElement("div");
    local.className = "gameframe-account-local-note";
    local.innerHTML = "<small>PLAYER ID</small><strong></strong>";
    local.querySelector("strong").textContent = identity.playerId;
    actions.append(local);
  }
  document.body.append(panel);

  const trigger = badge.querySelector("#gameframe-account-trigger");
  function setOpen(open) {
    panel.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
    badge.classList.toggle("is-open", open);
    if (open) panel.querySelector('[role="menuitem"]')?.focus();
  }

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(panel.hidden);
  });
  panel.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || panel.hidden) return;
    setOpen(false);
    trigger.focus();
  });

  // Alerts belong to the authenticated GameFrame shell, not only invite-creation pages.
  // Dynamic import avoids a static auth <-> alerts module cycle while keeping optional pages lightweight.
  void import("./gameframe-alerts.js")
    .then(({ installGameFrameAlerts }) => installGameFrameAlerts(identity))
    .catch(() => {});
}

async function refreshTrustedSession() {
  if (isDiscordActivity()) return false;
  try {
    const response = await fetch("/auth/trusted-device/refresh", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

function sessionRequest(candidate) {
  return fetch("/api/session", {
    credentials: "same-origin",
    cache: "no-store",
    headers: { "x-gameframe-player-id": candidate },
  });
}

async function readSession(preferredDevelopmentPlayerId) {
  const candidate = developmentIdentity(preferredDevelopmentPlayerId);
  let response = await sessionRequest(candidate);
  if (response.status === 401 && await refreshTrustedSession()) {
    response = await sessionRequest(candidate);
  }
  return response;
}

async function identityFromResponse(response) {
  if (!response.ok) return null;
  const identity = await response.json();
  if (!normalizeIdentity(identity.playerId)) {
    throw new Error("The server returned an invalid GameFrame identity.");
  }
  installedIdentity = identity;
  installIdentityBadge(installedIdentity);
  return installedIdentity;
}

async function establishActivitySession() {
  const { bootstrapDiscordActivitySession } = await import("/discord-activity-bootstrap.js");
  return bootstrapDiscordActivitySession();
}

async function authenticatedFetch(url, options, identity) {
  if (!identity) throw new Error("GameFrame identity has not been established.");
  const headers = new Headers(options.headers);
  if (identity.source === "development") {
    headers.set("x-gameframe-player-id", identity.playerId);
  }
  const execute = () => fetch(url, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  let response = await execute();
  if (response.status === 401 && identity.source !== "development" && await refreshTrustedSession()) {
    response = await execute();
  }
  return response;
}

/**
 * Reads the current GameFrame identity when one is already available without
 * turning an otherwise playable page into a sign-in gate. This is intended for
 * optional platform features such as social progression layered onto games that
 * can still run without an authenticated player session.
 */
export async function tryGameFrameIdentity(options = {}) {
  if (installedIdentity) return installedIdentity;
  try {
    const response = await readSession(options.preferredDevelopmentPlayerId);
    if (!response.ok) return null;
    return await identityFromResponse(response);
  } catch {
    return null;
  }
}

export async function establishGameFrameIdentity(options = {}) {
  if (installedIdentity) return installedIdentity;
  let response = await readSession(options.preferredDevelopmentPlayerId);
  if (response.status === 401 && isDiscordActivity()) {
    try {
      await establishActivitySession();
      response = await readSession(options.preferredDevelopmentPlayerId);
    } catch (error) {
      renderAuthenticationGate(
        error instanceof Error ? error.message : "Discord Activity authentication failed.",
        { activity: true },
      );
      return new Promise(() => {});
    }
  }
  if (response.status === 401) {
    renderAuthenticationGate();
    return new Promise(() => {});
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Session initialization failed with ${response.status}.`);
  }
  return identityFromResponse(response);
}

/**
 * Authenticated request for optional metadata. A missing/expired GameFrame session
 * is returned to the caller as a normal 401 instead of blocking the page with the
 * global sign-in gate. Trusted family devices get one silent session refresh first.
 */
export async function gameFrameOptionalFetch(url, options = {}, identity = installedIdentity) {
  return authenticatedFetch(url, options, identity);
}

export async function gameFrameFetch(url, options = {}, identity = installedIdentity) {
  const response = await authenticatedFetch(url, options, identity);
  if (response.status === 401 && identity.source !== "development") {
    renderAuthenticationGate(
      "Your GameFrame session expired. Sign in again to continue.",
      { activity: isDiscordActivity() },
    );
  }
  return response;
}