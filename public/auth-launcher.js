import { establishGameFrameIdentity } from "./gameframe-auth.js";
import { installAuthenticatedInvitationFlow } from "./secure-match-invite.js";

const launcher = [...document.querySelectorAll('script[type="module"][src="/auth-launcher.js"]')].at(-1);
const entry = launcher?.dataset.entry;
if (!entry || !entry.startsWith("/") || !entry.endsWith(".js")) {
  throw new Error("The GameFrame authentication launcher requires a local JavaScript entry path.");
}

const bootSeenStorageKey = "scribbles-gameframe.boot-seen:v2";
const bootSurface = document.querySelector("#gameframe-boot");
const bootMessage = document.querySelector("#gameframe-boot-message");
const bootRetry = document.querySelector("#gameframe-boot-retry");
const bootProgress = document.querySelector("#gameframe-boot-progress");
const bootProgressValue = document.querySelector("[data-gameframe-boot-progress-value]");
const bootProgressLabel = document.querySelector("[data-gameframe-boot-progress-label]");
const bootPacket = document.querySelector("[data-gameframe-boot-packet]");
const bootStartedAt = performance.now();
const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
let bootTelemetryTimer = null;
let currentBootProgress = 8;

function hasSeenColdBoot() {
  try {
    return window.localStorage.getItem(bootSeenStorageKey) === "seen";
  } catch {
    return false;
  }
}

const bootMode = bootSurface && !hasSeenColdBoot() ? "cold" : "warm";

function setBootMode() {
  if (!bootSurface) return;
  bootSurface.dataset.mode = bootMode;
  document.body.dataset.gameframeBootMode = bootMode;
  const label = bootSurface.querySelector("[data-gameframe-boot-mode]");
  if (label) label.textContent = bootMode === "cold" ? "COLD START" : "WARM START";

  if (bootMode === "cold") {
    const labels = {
      session: "> HANDSHAKE PLAYER SESSION",
      navigation: "> MOUNT NAVIGATION BUS",
      library: "> INDEX DESTINATION REGISTRY",
      runtime: "> SPIN GAME CLIENT",
    };
    for (const [stageName, text] of Object.entries(labels)) {
      const stage = bootSurface.querySelector(`[data-gameframe-boot-stage="${stageName}"] span`);
      if (stage) stage.textContent = text;
    }
  }
}

function setBootHost() {
  const host = bootSurface?.querySelector("[data-gameframe-boot-host]");
  if (host) host.textContent = `NODE: ${window.location.host || "LOCAL"}`;
}

function startBootTelemetry() {
  if (!bootSurface || bootMode !== "cold" || reducedMotion || !bootPacket) return;
  let sequence = 0x7f;
  bootTelemetryTimer = window.setInterval(() => {
    sequence = (sequence + 0x13) & 0xffff;
    bootPacket.textContent = `PKT ${sequence.toString(16).toUpperCase().padStart(4, "0")}:${(sequence ^ 0xa7).toString(16).toUpperCase().slice(-2)}`;
  }, 180);
}

function stopBootTelemetry() {
  if (bootTelemetryTimer) window.clearInterval(bootTelemetryTimer);
  bootTelemetryTimer = null;
}

function setBootProgress(percent, label) {
  const bounded = Math.max(currentBootProgress, Math.min(100, Math.round(percent)));
  currentBootProgress = bounded;
  bootSurface?.style.setProperty("--gameframe-boot-progress", `${bounded}%`);
  bootProgress?.setAttribute("aria-valuenow", String(bounded));
  if (bootProgressValue) bootProgressValue.textContent = `${String(bounded).padStart(2, "0")}%`;
  if (label && bootProgressLabel) bootProgressLabel.textContent = label;
}

function animateBootProgress(target, durationMs, label) {
  if (!bootSurface || reducedMotion || durationMs <= 0 || target <= currentBootProgress) {
    setBootProgress(target, label);
    return Promise.resolve();
  }

  const start = performance.now();
  const initial = currentBootProgress;
  if (label && bootProgressLabel) bootProgressLabel.textContent = label;

  return new Promise((resolve) => {
    function frame(now) {
      const ratio = Math.min(1, (now - start) / durationMs);
      const steppedRatio = Math.floor(ratio * 14) / 14;
      setBootProgress(initial + (target - initial) * steppedRatio);
      if (ratio >= 1) {
        setBootProgress(target);
        resolve();
        return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}

async function paceColdBoot(targetElapsedMs, targetProgress, label) {
  if (bootMode !== "cold" || reducedMotion) {
    setBootProgress(targetProgress, label);
    return;
  }
  const remaining = Math.max(0, targetElapsedMs - (performance.now() - bootStartedAt));
  await animateBootProgress(targetProgress, remaining, label);
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

function rememberColdBoot() {
  if (!bootSurface || bootMode !== "cold") return;
  try {
    window.localStorage.setItem(bootSeenStorageKey, "seen");
  } catch {
    // Cosmetic boot history should never block startup.
  }
}

async function finishBoot() {
  if (!bootSurface) return;
  const shell = document.querySelector(".shell");
  shell?.setAttribute("aria-busy", "false");

  if (bootMode === "cold") {
    setBootMessage("PLAYER ENVIRONMENT READY // WELCOME TO GAMEFRAME");
    await paceColdBoot(3000, 100, "GAMEFRAME SYSTEM READY");
  } else {
    setBootMessage("GAMEFRAME ONLINE");
    const minimumVisibleMs = reducedMotion ? 0 : 900;
    const remaining = Math.max(0, minimumVisibleMs - (performance.now() - bootStartedAt));
    await animateBootProgress(100, remaining, "GAMEFRAME ONLINE");
  }

  rememberColdBoot();
  stopBootTelemetry();
  document.body.classList.remove("gameframe-booting");
  if (reducedMotion) {
    bootSurface.hidden = true;
    return;
  }

  bootSurface.classList.add("is-complete");
  await new Promise((resolve) => setTimeout(resolve, bootMode === "cold" ? 260 : 170));
  bootSurface.hidden = true;
}

function failBoot(error) {
  if (!bootSurface) return;
  stopBootTelemetry();
  bootSurface.classList.add("is-failed");
  const active = bootSurface.querySelector('[data-state="active"]');
  if (active) {
    active.dataset.state = "failed";
    active.querySelector("strong")?.setAttribute("aria-label", "failed");
  }
  setBootProgress(Math.min(96, currentBootProgress), "STARTUP INTERRUPTED");
  setBootMessage(error instanceof Error ? `STARTUP FAILED // ${error.message}` : "STARTUP FAILED");
  if (bootRetry) bootRetry.hidden = false;
}

setBootMode();
setBootHost();
setBootProgress(8, bootMode === "cold" ? "COLD-START PLAYER ENVIRONMENT" : "VERIFYING PLAYER ENVIRONMENT");
startBootTelemetry();
bootRetry?.addEventListener("click", () => window.location.reload());

async function launch() {
  const parameters = new URLSearchParams(window.location.search);
  const preferredDevelopmentPlayerId = parameters.get("player");

  setBootStage("session", "active");
  setBootMessage(bootMode === "cold" ? "NEGOTIATING PLAYER HANDSHAKE" : "VERIFYING PLAYER SESSION");
  const identity = await establishGameFrameIdentity({ preferredDevelopmentPlayerId });
  setBootStage("session", "ok");
  await paceColdBoot(700, 30, "PLAYER SESSION VERIFIED");

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
  setBootProgress(34, "MOUNTING NAVIGATION BUS");
  setBootMessage("MOUNTING NAVIGATION");
  await import("./gameframe-nav.js");
  setBootStage("navigation", "ok");
  await paceColdBoot(1250, 50, "NAVIGATION BUS ONLINE");

  if (entry === "/app.js") {
    setBootStage("library", "active");
    setBootProgress(55, "INDEXING DESTINATION REGISTRY");
    setBootMessage("LOADING DESTINATION REGISTRY");
    await import("./game-hub.js");
    setBootStage("library", "ok");
    await paceColdBoot(1900, 72, "DESTINATION REGISTRY INDEXED");

    setBootStage("runtime", "active");
    setBootProgress(78, "STARTING GAME CLIENT");
    setBootMessage("STARTING GAME CLIENT");
    await import("./tic-tac-toe-noir.js");
    await import(entry);
    setBootStage("runtime", "ok");
    await paceColdBoot(2500, 92, "GAME CLIENT READY");
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
  } else if (entry === "/monster-master-rpg-app.js") {
    window.gameFrameMonsterRendererMode = "pixi";
    await import("./monster-master-pixi-bridge.js");
    await import("./monster-master-rpg-world.js");
    await import(entry);
    await import("./monster-master-rpg-admin.js");
    await import("./monster-master-pixi-bundle.js");
    const pixiReady = await window.gameFrameMonsterPixi?.ready;
    if (pixiReady) {
      window.gameFrameMonsterRpgWorld?.refreshAnchors?.();
    } else {
      const errorBanner = document.querySelector("#mm-rpg-error");
      if (errorBanner) {
        errorBanner.hidden = false;
        errorBanner.textContent = "The physical campaign scene could not start WebGL. Narrative campaign controls remain available.";
      }
    }
  } else {
    await import(entry);
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
