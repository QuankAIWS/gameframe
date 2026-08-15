const manifestHref = "/manifest.webmanifest";
let reconnectingCachedIdentity = false;

function syncConnectivity() {
  const offline = navigator.onLine === false;
  window.gameFrameOffline = offline || Boolean(window.gameFrameIdentity?.offline);
  document.documentElement.dataset.gameframeConnectivity = window.gameFrameOffline ? "offline" : "online";
  document.body?.setAttribute("data-gameframe-connectivity", window.gameFrameOffline ? "offline" : "online");
  window.dispatchEvent(new CustomEvent("gameframe:connectivity", {
    detail: { offline: window.gameFrameOffline },
  }));
}

function reconnect() {
  // A cached identity is deliberately display-only. Once the browser has a
  // network again, reload through the normal auth launcher so the trusted
  // device/session is revalidated before Matches/Profile or server APIs return.
  if (window.gameFrameIdentity?.offline && !reconnectingCachedIdentity) {
    reconnectingCachedIdentity = true;
    window.location.reload();
    return;
  }
  syncConnectivity();
}

syncConnectivity();
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
