import { establishGameFrameIdentity } from "./gameframe-auth.js";

const parameters = new URLSearchParams(window.location.search);
const preferredDevelopmentPlayerId = parameters.get("player");
const identity = await establishGameFrameIdentity({
  preferredDevelopmentPlayerId,
  allowOfflineCachedIdentity: true,
});
window.gameFrameIdentity = identity;
window.gameFrameOffline = identity?.offline === true || navigator.onLine === false;
document.body.dataset.gameframeConnectivity = window.gameFrameOffline ? "offline" : "online";

// Othello's fidelity client is still a classic-script stack. Keep its existing
// fetch calls intact while giving local development requests the same identity
// header used by the rest of GameFrame. Hosted Discord sessions continue to use
// their normal secure cookie without an injected identity claim.
if (identity.source === "development" && !identity.offline) {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const requestUrl = new URL(
      typeof input === "string" || input instanceof URL ? String(input) : input.url,
      window.location.href,
    );
    if (requestUrl.origin !== window.location.origin || !requestUrl.pathname.startsWith("/api/")) {
      return nativeFetch(input, init);
    }
    const headers = new Headers(
      init.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    headers.set("x-gameframe-player-id", identity.playerId);
    return nativeFetch(input, {
      ...init,
      headers,
      credentials: init.credentials ?? "same-origin",
    });
  };
}

if (identity.source === "discord" && !identity.offline && parameters.has("player")) {
  const url = new URL(window.location.href);
  url.searchParams.delete("player");
  window.history.replaceState({}, "", url);
}

await import("./gameframe-nav.js");
if (window.gameFrameOffline) await import("./othello-offline-mode.js");
