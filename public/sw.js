const CACHE_VERSION = "gameframe-static-v2";
const CORE_ASSETS = [
  "/",
  "/cascade.html",
  "/styles.css",
  "/gameframe-icon.svg",
  "/manifest.webmanifest",
  "/gameframe-nav.js",
  "/gameframe-pwa.js",
  "/family-sign-in.js",
  "/gameframe-nav.css",
  "/gameframe-nav-integrations.css",
  "/gameframe-final-polish.css",
  "/gameframe-session-override.css",
  "/gameframe-themes.css",
  "/cascade.css",
  "/cascade-input.css",
  "/cascade-vfx.css",
  "/cascade-rendering.css",
  "/cascade-life-ui.css",
  "/cascade-mechanics.css",
  "/cascade-admin.css",
  "/cascade-polish.css",
  "/cascade-polish-responsive.css",
  "/cascade-performance.css",
  "/cascade-evolution.css",
  "/cascade-bonus-modes.css",
  "/cascade-cell-objectives.css",
  "/cascade-tutorial.css",
  "/cascade-juice.css",
  "/cascade-presentation-director.css",
  "/cascade-build-refresh.css",
  "/cascade-mobile.css",
  "/cascade-fresh-run-guard.js",
  "/cascade-family-state-guard.js",
  "/cascade-viewport-guard.js",
  "/cascade-progression-sync.js",
  "/cascade-telemetry-sync.js",
  "/cascade-presentation-director.js",
  "/cascade-runtime-v2.js",
  "/cascade-input.js",
  "/cascade-family-polish.js",
  "/cascade-bonus-modes.js",
  "/cascade-life-ui.js",
  "/cascade-piece-idle.js",
  "/cascade-cell-objectives.js",
  "/cascade-tutorial-mode.js",
  "/cascade-tutorial.js",
  "/cascade-build-refresh.js",
  "/cascade-special-engine.js",
  "/gameframe-auth.js",
  "/gameframe-auth.css",
  "/gameframe-account-menu.css"
];

function cacheable(requestUrl) {
  if (requestUrl.origin !== self.location.origin) return false;
  if (requestUrl.pathname.startsWith("/api/") || requestUrl.pathname.startsWith("/auth/")) return false;
  return true;
}

async function sessionWithTrustedRefresh(request) {
  let response = await fetch(request);
  if (response.status !== 401) return response;
  const refreshed = await fetch(new URL("/auth/trusted-device/refresh", self.location.origin), {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  });
  if (!refreshed.ok) return response;
  return fetch(request);
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await Promise.allSettled(CORE_ASSETS.map(async (path) => {
      const response = await fetch(path, { cache: "reload" });
      if (response.ok) await cache.put(path, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name !== CACHE_VERSION).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin && url.pathname === "/api/session") {
    event.respondWith(sessionWithTrustedRefresh(request));
    return;
  }

  if (!cacheable(url)) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_VERSION);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(request))
          || (url.pathname === "/cascade.html" ? await caches.match("/cascade.html") : null)
          || await caches.match("/")
          || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    const network = fetch(request).then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(CACHE_VERSION);
        await cache.put(request, response.clone());
      }
      return response;
    }).catch(() => null);
    if (cached) {
      event.waitUntil(network);
      return cached;
    }
    return (await network) || Response.error();
  })());
});
