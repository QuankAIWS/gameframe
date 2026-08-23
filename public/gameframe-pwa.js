const manifestHref = "/manifest.webmanifest";
const cachedIdentityProbeDelayMs = 5000;
let lastIdentity = window.gameFrameIdentity || null;
let cachedIdentityProbeTimer = null;
let cachedIdentityProbeInFlight = false;
let reloadingForSessionRevalidation = false;

function currentIdentity() {
  return window.gameFrameIdentity || lastIdentity || null;
}

function clearCachedIdentityProbe() {
  if (cachedIdentityProbeTimer !== null) window.clearTimeout(cachedIdentityProbeTimer);
  cachedIdentityProbeTimer = null;
}

function scheduleCachedIdentityProbe(delay = cachedIdentityProbeDelayMs) {
  clearCachedIdentityProbe();
  const identity = currentIdentity();
  if (!identity?.offline || navigator.onLine === false || reloadingForSessionRevalidation) return;
  cachedIdentityProbeTimer = window.setTimeout(() => {
    cachedIdentityProbeTimer = null;
    void probeCachedIdentitySession();
  }, delay);
}

async function probeCachedIdentitySession() {
  const identity = currentIdentity();
  if (!identity?.offline || navigator.onLine === false || cachedIdentityProbeInFlight || reloadingForSessionRevalidation) return;
  cachedIdentityProbeInFlight = true;
  try {
    const headers = new Headers();
    if (identity.source === "development") headers.set("x-gameframe-player-id", identity.playerId);
    const response = await fetch("/api/session", {
      credentials: "same-origin",
      cache: "no-store",
      headers,
    });

    // Any authoritative session response below the transient-server-error range
    // proves that the request path is reachable again. Reload through the normal
    // auth launcher so trusted-device refresh, 401 handling, and server authority
    // are re-established instead of promoting the display-only cached identity.
    if (response.status < 500) {
      reloadingForSessionRevalidation = true;
      clearCachedIdentityProbe();
      window.dispatchEvent(new CustomEvent("gameframe:reload-intent", {
        detail: {
          reason: "session-revalidation",
          status: response.status,
          source: identity.source,
        },
      }));
      window.location.reload();
      return;
    }
  } catch {
    // A DNS/proxy/server outage can leave navigator.onLine === true. Keep the
    // local GameFrame shell usable and probe again instead of waiting for an
    // online event that may never fire.
  } finally {
    cachedIdentityProbeInFlight = false;
  }
  scheduleCachedIdentityProbe();
}

function syncConnectivity() {
  const identity = currentIdentity();
  const offline = navigator.onLine === false || Boolean(identity?.offline);
  window.gameFrameOffline = offline;
  document.documentElement.dataset.gameframeConnectivity = offline ? "offline" : "online";
  document.body?.setAttribute("data-gameframe-connectivity", offline ? "offline" : "online");
  window.dispatchEvent(new CustomEvent("gameframe:connectivity", {
    detail: { offline },
  }));

  if (identity?.offline && navigator.onLine !== false) scheduleCachedIdentityProbe(250);
  else clearCachedIdentityProbe();
}

function handleIdentity(event) {
  if (event?.detail?.identity) lastIdentity = event.detail.identity;
  syncConnectivity();
}

function reconnect() {
  syncConnectivity();
  if (currentIdentity()?.offline) scheduleCachedIdentityProbe(0);
}

syncConnectivity();
window.addEventListener("gameframe:identity", handleIdentity);
window.addEventListener("online", reconnect);
window.addEventListener("offline", syncConnectivity);

void import("/family-sign-in.js").catch(() => {
  // Assisted family sign-in is optional on pages that never render an auth gate.
});
void import("/family-admin-link.js").catch(() => {
  // The administrator shortcut is convenience only; API authority remains server-side.
});

if (!document.querySelector(`link[rel="manifest"]`)) {
  const manifest = document.createElement("link");
  manifest.rel = "manifest";
  manifest.href = manifestHref;
  document.head.append(manifest);
}

if (!document.querySelector(`link[rel="apple-touch-icon"]`)) {
  const icon = document.createElement("link");
  icon.rel = "apple-touch-icon";
  icon.href = "/gameframe-icon.svg";
  document.head.append(icon);
}

if (!document.querySelector(`meta[name="mobile-web-app-capable"]`)) {
  const capable = document.createElement("meta");
  capable.name = "mobile-web-app-capable";
  capable.content = "yes";
  document.head.append(capable);
}

if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Installation/offline support is progressive enhancement. A failed worker
      // registration must not keep GameFrame from running online.
    });
  }, { once: true });
}
