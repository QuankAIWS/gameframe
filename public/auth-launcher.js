import { establishGameFrameIdentity } from "./gameframe-auth.js";

const entry = document.currentScript?.dataset.entry;
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

await import(entry);

if (identity.source === "discord") {
  const unsupportedHumanControls = [
    ["#create-human-match", "Verified friend invites are not enabled on this staging build yet."],
    ["#tactical-human", "Verified friend invites are not enabled on this staging build yet."],
    ["#combat-human", "Verified friend invites are not enabled on this staging build yet."],
  ];
  for (const [selector, title] of unsupportedHumanControls) {
    const control = document.querySelector(selector);
    if (!control) continue;
    control.disabled = true;
    control.title = title;
    control.setAttribute("aria-disabled", "true");
  }
}
