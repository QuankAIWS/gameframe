import { expect, test } from "@playwright/test";

const LIFECYCLE_KEY = "scribbles-gameframe.cascade-render-lifecycle:v1";
const ANALYTICS_KEY = "scribbles-gameframe.cascade-analytics:v1";
const RELOAD_INTENT_KEY = "scribbles-gameframe.reload-intent:v1";

function analyticsOfType(events, type) {
  return events.filter((event) => event?.type === type);
}

test("Cascade reports a recent abrupt renderer recovery with its last VFX state", async ({ page }) => {
  await page.addInitScript(({ lifecycleKey, analyticsKey }) => {
    localStorage.removeItem(analyticsKey);
    localStorage.setItem(lifecycleKey, JSON.stringify({
      documentId: "prior-render",
      openedAt: Date.now() - 10_000,
      lastSeenAt: Date.now() - 300,
      cleanExit: false,
      visibility: "visible",
      lastInteractionAt: Date.now() - 200,
      lastVfx: {
        activeDomNodes: 636,
        peakDomNodes: 636,
        activeParticles: 360,
        peakParticles: 360,
        contextLosses: 0,
        visibleEffectGroups: 28,
        level: 17,
        moves: 9,
        interactionAgeMs: 100,
      },
      lastError: null,
    }));
  }, { lifecycleKey: LIFECYCLE_KEY, analyticsKey: ANALYTICS_KEY });

  await page.goto("/cascade.html?player=cascade-lifecycle-abrupt");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  const result = await page.evaluate(({ lifecycleKey, analyticsKey }) => {
    const current = JSON.parse(localStorage.getItem(lifecycleKey) || "null");
    const analytics = JSON.parse(localStorage.getItem(analyticsKey) || "[]");
    return { current, analytics };
  }, { lifecycleKey: LIFECYCLE_KEY, analyticsKey: ANALYTICS_KEY });

  expect(result.current?.cleanExit).toBe(false);
  expect(result.current?.documentId).not.toBe("prior-render");
  const recoveries = analyticsOfType(result.analytics, "render_abrupt_recovery");
  expect(recoveries).toHaveLength(1);
  expect(recoveries[0].previousDocumentId).toBe("prior-render");
  expect(recoveries[0].previousVisibility).toBe("visible");
  expect(recoveries[0].previousLastVfx?.activeDomNodes).toBe(636);
  expect(recoveries[0].previousLastVfx?.activeParticles).toBe(360);
  expect(recoveries[0].previousLastVfx?.visibleEffectGroups).toBe(28);
});

test("Cascade persists intentional GameFrame reload reasons separately from abrupt recovery", async ({ page }) => {
  await page.addInitScript(({ lifecycleKey, analyticsKey, reloadKey }) => {
    localStorage.removeItem(lifecycleKey);
    localStorage.removeItem(analyticsKey);
    sessionStorage.removeItem(reloadKey);
  }, { lifecycleKey: LIFECYCLE_KEY, analyticsKey: ANALYTICS_KEY, reloadKey: RELOAD_INTENT_KEY });

  await page.goto("/cascade.html?player=cascade-lifecycle-intent");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("gameframe:reload-intent", {
      detail: {
        reason: "test-reload",
        status: 200,
        source: "development",
      },
    }));
  });

  const result = await page.evaluate(({ lifecycleKey, analyticsKey, reloadKey }) => ({
    lifecycle: JSON.parse(localStorage.getItem(lifecycleKey) || "null"),
    analytics: JSON.parse(localStorage.getItem(analyticsKey) || "[]"),
    sessionIntent: JSON.parse(sessionStorage.getItem(reloadKey) || "null"),
  }), { lifecycleKey: LIFECYCLE_KEY, analyticsKey: ANALYTICS_KEY, reloadKey: RELOAD_INTENT_KEY });

  expect(result.lifecycle?.reloadIntent?.reason).toBe("test-reload");
  expect(result.sessionIntent?.reason).toBe("test-reload");
  expect(result.sessionIntent?.status).toBeUndefined();
  expect(result.sessionIntent?.detail?.status).toBe(200);
  const intents = analyticsOfType(result.analytics, "render_reload_intent");
  expect(intents).toHaveLength(1);
  expect(intents[0].reason).toBe("test-reload");
});

test("Cascade marks a normal pagehide as a clean renderer exit", async ({ page }) => {
  await page.addInitScript(({ lifecycleKey, analyticsKey }) => {
    localStorage.removeItem(lifecycleKey);
    localStorage.removeItem(analyticsKey);
  }, { lifecycleKey: LIFECYCLE_KEY, analyticsKey: ANALYTICS_KEY });

  await page.goto("/cascade.html?player=cascade-lifecycle-pagehide");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  await page.evaluate(() => {
    window.dispatchEvent(new Event("pagehide"));
  });

  const lifecycle = await page.evaluate((lifecycleKey) => JSON.parse(localStorage.getItem(lifecycleKey) || "null"), LIFECYCLE_KEY);
  expect(lifecycle?.cleanExit).toBe(true);
  expect(Number(lifecycle?.exitAt)).toBeGreaterThan(0);
});
