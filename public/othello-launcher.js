import { establishGameFrameIdentity } from "./gameframe-auth.js";

const parameters = new URLSearchParams(window.location.search);
const preferredDevelopmentPlayerId = parameters.get("player");
const identity = await establishGameFrameIdentity({ preferredDevelopmentPlayerId });
window.gameFrameIdentity = identity;

if (identity.source === "discord" && parameters.has("player")) {
  const url = new URL(window.location.href);
  url.searchParams.delete("player");
  window.history.replaceState({}, "", url);
}

await import("./gameframe-nav.js");
