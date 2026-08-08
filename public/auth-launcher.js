import { establishGameFrameIdentity } from "./gameframe-auth.js";
import { installAuthenticatedInvitationFlow } from "./secure-match-invite.js";

const launcher = [...document.querySelectorAll('script[type="module"][src="/auth-launcher.js"]')].at(-1);
const entry = launcher?.dataset.entry;
if (!entry || !entry.startsWith("/") || !entry.endsWith(".js")) {
  throw new Error("The GameFrame authentication launcher requires a local JavaScript entry path.");
}

const bootSurface = document.querySelector("#gameframe-boot");
const bootMessage = document.querySelector("#gameframe-boot-message");
const bootRetry = document.querySelector("#gameframe-boot-retry");
const bootStartedAt = performance.now();
const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

function setBootHost() {
  const host = bootSurface?.querySelector("[data-gameframe-boot-host]");
  if (host) host.textContent = `NODE: ${window.location.host || "LOCAL"}`;
}

function setBootStage(name, state) {
  const stage = bootSurface?.querySelector(`[data-gameframe-boot-stage="${name}"]`);
  if (!stage) return;
  stage.dataset.state = state;
  const status = stage.querySelector("strong");
  if (status) {
    status.setAttribute(
      "aria-label",
      state === "ok" ? "complete" : state === "failed" ? "failed" : state === "active" ? "in progress" : "waiting",
    );
  }
}

function setBootMessage(message) {
  if (!bootMessage) return;
  bootMessage.replaceChildren(document.createTextNode(`> ${message}`));
  const cursor = document.createElement("span");
  cursor.className = "gameframe-boot-cursor";
  cursor.setAttribute("aria-hidden", "true");
  bootMessage.append(cursor);
}

async function finishBoot() {
  if (!bootSurface) return;
  setBootMessage("GAMEFRAME ONLINE");
  const shell = document.querySelector(".shell");
  shell?.setAttribute("aria-busy", "false");

  const minimumVisibleMs = reducedMotion ? 0 : 320;
  const remaining = Math.max(0, minimumVisibleMs - (performance.now() - bootStartedAt));
  if (remaining) await new Promise((resolve) => setTimeout(resolve, remaining));

  document.body.classList.remove("gameframe-booting");
  if (reducedMotion) {
    bootSurface.hidden = true;
    return;
  }

  bootSurface.classList.add("is-complete");
  await new Promise((resolve) => setTimeout(resolve, 170));
  bootSurface.hidden = true;
}

function failBoot(error) {
  if (!bootSurface) return;
  bootSurface.classList.add("is-failed");
  const active = bootSurface.querySelector('[data-state="active"]');
  if (active) {
    active.dataset.state = "failed";
    active.querySelector("strong")?.setAttribute("aria-label", "failed");
  }
  setBootMessage(error instanceof Error ? `STARTUP FAILED // ${error.message}` : "STARTUP FAILED");
  if (bootRetry) bootRetry.hidden = false;
}

setBootHost();
bootRetry?.addEventListener("click", () => window.location.reload());

async function launch() {
  const parameters = new URLSearchParams(window.location.search);
  const preferredDevelopmentPlayerId = parameters.get("player");

  setBootStage("session", "active");
  setBootMessage("VERIFYING PLAYER SESSION");
  const identity = await establishGameFrameIdentity({ preferredDevelopmentPlayerId });
  setBootStage("session", "ok");

  window.gameFrameIdentity = identity;
  if (identity.source === "discord") {
    window.localStorage.setItem("scribbles-gameframe.player-id", identity.playerId);
    if (parameters.has("player")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("player");
      window.history.replaceState({}, "", url);
    }
  }

  setBootStage("navigation", "active");
  setBootMessage("MOUNTING NAVIGATION");
  await import("./gameframe-nav.js");
  setBootStage("navigation", "ok");

  if (entry === "/app.js") {
    setBootStage("library", "active");
    setBootMessage("LOADING DESTINATION REGISTRY");
    await import("./game-hub.js");
    setBootStage("library", "ok");

    setBootStage("runtime", "active");
    setBootMessage("STARTING GAME CLIENT");
    await import("./tic-tac-toe-noir.js");
    await import(entry);
    setBootStage("runtime", "ok");
  } else if (entry === "/monster-master-app.js") {
    const pixiFallbackKey = "gameframe:monster-master:legacy-renderer-fallback";
    const useLegacyRenderer = sessionStorage.getItem(pixiFallbackKey) === "true";
    window.gameFrameMonsterRendererMode = useLegacyRenderer ? "legacy" : "pixi";
    if (!useLegacyRenderer) await import("./monster-master-pixi-bridge.js");
    await import("./monster-master-correction.js");
    await import("./monster-master-option-layer.js");
    await import("./monster-master-overlay.js");
    await import("./monster-master-hints.js");
    await import(entry);

    if (!useLegacyRenderer) {
      await import("./monster-master-pixi-bundle.js");
      const pixiReady = await window.gameFrameMonsterPixi?.ready;
      if (!pixiReady) {
        sessionStorage.setItem(pixiFallbackKey, "true");
        window.location.reload();
        await new Promise(() => {});
      }
      sessionStorage.removeItem(pixiFallbackKey);
      await import("./monster-master-battlefield-effects.js");
      await import("./monster-master-gestures.js");
      await import("./monster-master-keyboard.js");
    }

    if (useLegacyRenderer) {
      document.body.classList.add("monster-master-legacy-fallback");
      const errorBanner = document.querySelector("#monster-master-error");
      if (errorBanner) {
        errorBanner.hidden = false;
        errorBanner.textContent = "WebGL could not start. Monster Master is using the compatibility battlefield for this session.";
      }
    }
    await import("./monster-master-results.js");
  } else {
    await import(entry);
    if (entry === "/monster-master-rpg-app.js") {
      await import("./monster-master-rpg-admin.js");
    }
  }

  installAuthenticatedInvitationFlow({ identity, entry });
  await finishBoot();
}

try {
  await launch();
} catch (error) {
  failBoot(error);
  throw error;
}
