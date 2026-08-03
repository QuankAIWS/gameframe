import { establishGameFrameIdentity } from "./gameframe-auth.js";
import { installAuthenticatedInvitationFlow } from "./secure-match-invite.js";

const launcher = [...document.querySelectorAll('script[type="module"][src="/auth-launcher.js"]')].at(-1);
const entry = launcher?.dataset.entry;
if (!entry || !entry.startsWith("/") || !entry.endsWith(".js")) {
  throw new Error("The GameFrame authentication launcher requires a local JavaScript entry path.");
}

const parameters = new URLSearchParams(window.location.search);
const preferredDevelopmentPlayerId = parameters.get("player");
const identity = await establishGameFrameIdentity({ preferredDevelopmentPlayerId });
window.gameFrameIdentity = identity;

if (identity.source === "discord") {
  window.localStorage.setItem("scribbles-gameframe.player-id", identity.playerId);
  if (parameters.has("player")) {
    const url = new URL(window.location.href);
    url.searchParams.delete("player");
    window.history.replaceState({}, "", url);
  }
}

await import("./gameframe-nav.js");

if (entry === "/app.js") {
  await import("./game-hub.js");
  await import("./tic-tac-toe-noir.js");
  await import(entry);
} else if (entry === "/monster-master-app.js") {
  await import("./monster-master-pixi-bridge.js");
  await import("./monster-master-correction.js");
  await import("./monster-master-overlay.js");
  await import(entry);
  await import("./monster-master-pixi-bundle.js");
  await import("./monster-master-keyboard.js");
  await import("./monster-master-results.js");
} else {
  await import(entry);
}
installAuthenticatedInvitationFlow({ identity, entry });
