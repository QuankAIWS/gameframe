import { expect, test } from "@playwright/test";

test("installed Cascade reloads and remains playable with the browser offline", async ({ page, context }) => {
  await page.goto("/cascade.html?player=pwa-offline-player");
  await expect(page.locator("#board .cascade-tile")).toHaveCount(64);

  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) throw new Error("Service workers are unavailable in this browser.");
    await navigator.serviceWorker.ready;
  });

  // Give the install transaction a deterministic chance to finish its static
  // dependency pre-cache before simulating a true airplane-mode relaunch.
  await expect.poll(() => page.evaluate(async () => {
    const cacheNames = await caches.keys();
    const cacheName = cacheNames.find((name) => name.startsWith("gameframe-static-"));
    if (!cacheName) return false;
    const cache = await caches.open(cacheName);
    return Boolean(
      await cache.match("/cascade.html")
      && await cache.match("/cascade-runtime-v2.js")
      && await cache.match("/cascade-special-engine.js")
      && await cache.match("/cascade-engine.js")
      && await cache.match("/gameframe-theme.js")
      && await cache.match("/cascade-cabinet-polish.css")
      && await cache.match("/cascade-final-touch.css"),
    );
  }), { timeout: 10_000 }).toBe(true);

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(page.locator("#board .cascade-tile")).toHaveCount(64, { timeout: 8_000 });
  await expect(page.locator("#moves")).not.toHaveText("");

  // The cabinet/final-touch styles are part of the first-install precache, not
  // merely runtime-cache side effects from a prior controlled page visit.
  const presentation = await page.locator(".cascade-shell").evaluate((node) => ({
    cabinetMapWidth: getComputedStyle(node).getPropertyValue("--cascade-tv-map-width").trim(),
    finalTouchLoaded: [...document.styleSheets].some((sheet) => sheet.href?.endsWith("/cascade-final-touch.css")),
  }));
  expect(presentation.cabinetMapWidth).toContain("156px");
  expect(presentation.finalTouchLoaded).toBe(true);

  // Local interactions remain available; no server round trip is required to
  // select a candy or persist the local Cascade save.
  await page.locator("#board .cascade-tile").first().click();
  await expect(page.locator("#board .cascade-tile").first()).toHaveClass(/is-selected/);
});
