const manifestHref = "/manifest.webmanifest";

void import("/family-sign-in.js").catch(() => {
  // Assisted family sign-in is optional on pages that never render an auth gate.
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
