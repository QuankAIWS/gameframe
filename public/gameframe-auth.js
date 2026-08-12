const developmentStorageKey = "scribbles-gameframe.player-id";
let installedIdentity = null;

if (!document.querySelector('link[href="/gameframe-auth.css"]')) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "/gameframe-auth.css";
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
  message = "Sign in with Discord to use this hosted GameFrame deployment.",
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
        <h1>Discord sign-in required</h1>
        <p data-auth-message></p>
        <a class="gameframe-auth-button" data-auth-login>Sign in with Discord</a>
        <button class="gameframe-auth-button" type="button" data-auth-retry hidden>Retry Activity authentication</button>
        <small>Game commands use the signed GameFrame session. Discord does not control game rules or match state.</small>
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

function installIdentityBadge(identity) {
  if (document.querySelector("#gameframe-session-badge")) return;
  const badge = document.createElement("aside");
  badge.id = "gameframe-session-badge";
  badge.className = "gameframe-session-badge";
  const avatar = identity.avatarUrl
    ? `<img src="${identity.avatarUrl}" alt="" referrerpolicy="no-referrer">`
    : `<span class="gameframe-session-avatar" aria-hidden="true">${identity.source === "discord" ? "D" : "DEV"}</span>`;
  badge.innerHTML = `
    ${avatar}
    <span>
      <small>${identity.source === "discord" ? "Discord session" : "Local development"}</small>
      <strong></strong>
    </span>
    ${identity.source === "discord" ? '<button type="button">Log out</button>' : ""}
  `;
  badge.querySelector("strong").textContent = identity.displayName || identity.playerId;
  badge.querySelector("button")?.addEventListener("click", async () => {
    await fetch("/auth/logout", { method: "POST", credentials: "same-origin" });
    window.location.reload();
  });
  document.body.append(badge);
}

async function readSession(preferredDevelopmentPlayerId) {
  const candidate = developmentIdentity(preferredDevelopmentPlayerId);
  return fetch("/api/session", {
    credentials: "same-origin",
    headers: { "x-gameframe-player-id": candidate },
  });
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

export async function gameFrameFetch(url, options = {}, identity = installedIdentity) {
  if (!identity) throw new Error("GameFrame identity has not been established.");
  const headers = new Headers(options.headers);
  if (identity.source === "development") {
    headers.set("x-gameframe-player-id", identity.playerId);
  }
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  if (response.status === 401 && identity.source !== "development") {
    renderAuthenticationGate(
      "Your GameFrame session expired. Sign in again to continue.",
      { activity: isDiscordActivity() },
    );
  }
  return response;
}
