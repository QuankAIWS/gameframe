const CACHE_VERSION = "gameframe-static-v5";

// This is the first intentionally complete GameFrame offline pack. Keep it
// limited to the lightweight shell plus experiences that can genuinely execute
// without server authority: Cascade Crush and local Othello. API/auth responses
// remain outside the service-worker cache.
const REQUIRED_ASSETS = [
  // Installed GameFrame shell.
  "/",
  "/manifest.webmanifest",
  "/gameframe-icon.svg",
  "/gameframe-pwa.js",
  "/gameframe-navigation-preflight.js",
  "/gameframe-navigation-preflight.css",
  "/gameframe-boot.css",
  "/styles.css",
  "/game-polish.css",
  "/clockwork-eclipse.css",
  "/game-polish.js",
  "/checkers-premium.js",
  "/checkers-premium-layout.js",
  "/checkers-premium.css",
  "/auth-launcher.js",
  "/gameframe-auth.js",
  "/gameframe-auth.css",
  "/gameframe-account-menu.css",
  "/gameframe-nav.js",
  "/gameframe-theme.js",
  "/gameframe-nav.css",
  "/gameframe-nav-integrations.css",
  "/gameframe-final-polish.css",
  "/gameframe-session-override.css",
  "/gameframe-themes.css",
  "/gameframe-theme-environments.css",
  "/gameframe-offline-shell.js",
  "/game-hub.css",
  "/game-hub-shell.css",
  "/game-hub-cards.css",
  "/game-hub-flow.css",
  "/game-hub-rpg.css",
  "/family-sign-in.js",
  "/family-admin-link.js",

  // Lightweight GameFrame destinations.
  "/casual-games.html",
  "/casual-games.css",
  "/casual-games.js",
  "/leaderboard.html",
  "/leaderboard-app.js",
  "/player-platform.css",
  "/player-social.css",

  // Cascade Crush.
  "/cascade.html",
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
  "/cascade-cabinet-unified.css",
  "/cascade-match3-benchmark.css",
  "/cascade-match3-reduction.css",
  "/cascade-score-hud.css",
  "/cascade-cabinet-polish.css",
  "/cascade-mobile.css",
  "/cascade-final-touch.css",
  "/cascade-fresh-run-guard.js",
  "/cascade-family-state-guard.js",
  "/cascade-viewport-guard.js",
  "/cascade-progression-sync.js",
  "/cascade-telemetry-sync.js",
  "/cascade-presentation-director.js",
  "/cascade-runtime-v2.js",
  "/cascade-score-hud.js",
  "/cascade-input.js",
  "/cascade-family-polish.js",
  "/cascade-bonus-modes.js",
  "/cascade-life-ui.js",
  "/cascade-admin.js",
  "/cascade-admin-telemetry.js",
  "/cascade-piece-idle.js",
  "/cascade-cell-objectives.js",
  "/cascade-tutorial-mode.js",
  "/cascade-tutorial.js",
  "/cascade-build-refresh.js",
  "/cascade-special-engine.js",
  "/cascade-engine.js",

  // Othello local/bot play and all three visual themes.
  "/othello.html",
  "/othello.css",
  "/othello-reference-core.css",
  "/othello-reference-neon.css",
  "/othello-reference-garden.css",
  "/othello-reference-responsive.css",
  "/othello-fidelity-neon.css",
  "/othello-fidelity-garden.css",
  "/othello-bake4-neon.css",
  "/othello-bake4-garden.css",
  "/othello-bake4-responsive.css",
  "/othello-garden-delicacy.css",
  "/othello-garden-water-integration.css",
  "/othello-game-menu.css",
  "/othello-fidelity-app-1.js",
  "/othello-fidelity-app-2.js",
  "/othello-fidelity-app-3.js",
  "/othello-fidelity-app-4.js",
  "/othello-launcher.js",
  "/othello-offline-mode.js",
  "/othello-game-menu.js",
];

function cacheable(requestUrl) {
  if (requestUrl.origin !== self.location.origin) return false;
  if (requestUrl.pathname.startsWith("/api/") || requestUrl.pathname.startsWith("/auth/")) return false;
  return true;
}

async function precacheRequiredAssets(cache) {
  await Promise.all(REQUIRED_ASSETS.map(async (path) => {
    const response = await fetch(path, { cache: "reload" });
    if (!response.ok) throw new Error(`GameFrame offline asset ${path} returned HTTP ${response.status}.`);
    await cache.put(path, response);
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    // Required offline assets are atomic now. A partially populated new worker
    // must not activate and advertise an offline GameFrame that cannot boot.
    await precacheRequiredAssets(cache);
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
        // Ignore query strings for installed navigation. The HTML shell still
        // sees the original URL, so /?catalog=1 and /othello.html?theme=neon
        // can reuse their precached pathname documents without falling home.
        return (await caches.match(request))
          || (await caches.match(url.pathname))
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
