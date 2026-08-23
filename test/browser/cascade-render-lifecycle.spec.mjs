import { expect, test } from "@playwright/test";

const LIFECYCLE_KEY = "scribbles-gameframe.cascade-render-lifecycle:v1";
const ANALYTICS_KEY = "scribbles-gameframe.cascade-analytics:v1";
const DIAGNOSTIC_QUEUE_KEY = "scribbles-gameframe.cascade-diagnostics-queue:v1";
const RELOAD_INTENT_KEY = "scribbles-gameframe.reload-intent:v1";

function incidentsOfType(events, type) {
  return events.filter((event) => event?.type === type);
}

test("Cascade queues a recent abrupt renderer recovery with its last VFX and device state", async ({ page }) => {
  await page.addInitScript(({ lifecycleKey, analyticsKey, diagnosticsKey }) => {
    localStorage.removeItem(analyticsKey);
    localStorage.removeItem(diagnosticsKey);
    localStorage.setItem(lifecycleKey, JSON.stringify({
      documentId: "prior-render",
      openedAt: Date.now() - 10_000,
      lastSeenAt: Date.now() - 300,
      cleanExit: false,
      visibility: "visible",
      lastInteractionAt: Date.now() - 200,
      viewportResizeCount: 4,
      visualViewportResizeCount: 3,
      lastViewport: { width: 390, height: 780 },
      build: { loadedBuildId: "prior-build" },
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
  }, { lifecycleKey: LIFECYCLE_KEY, analyticsKey: ANALYTICS_KEY, diagnosticsKey: DIAGNOSTIC_QUEUE_KEY });

  await page.goto("/cascade.html?player=cascade-lifecycle-abrupt");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  const result = await page.evaluate(({ lifecycleKey, analyticsKey, diagnosticsKey }) => ({
    current: JSON.parse(localStorage.getItem(lifecycleKey) || "null"),
    analytics: JSON.parse(localStorage.getItem(analyticsKey) || "[]"),
    diagnostics: JSON.parse(localStorage.getItem(diagnosticsKey) || "[]"),
  }), { lifecycleKey: LIFECYCLE_KEY, analyticsKey: ANALYTICS_KEY, diagnosticsKey: DIAGNOSTIC_QUEUE_KEY });

  expect(result.current?.cleanExit).toBe(false);
  expect(result.current?.documentId).not.toBe("prior-render");
  expect(result.analytics.some((event) => event?.type === "render_boot" || event?.type === "render_abrupt_recovery")).toBe(false);
  const recoveries = incidentsOfType(result.diagnostics, "abrupt_renderer_recovery");
  expect(recoveries).toHaveLength(1);
  expect(recoveries[0].payload.previousDocumentId).toBe("prior-render");
  expect(recoveries[0].payload.previousLastVfx?.activeDomNodes).toBe(636);
  expect(recoveries[0].payload.previousLastVfx?.activeParticles).toBe(360);
  expect(recoveries[0].payload.previousLastVfx?.visibleEffectGroups).toBe(28);
  expect(recoveries[0].payload.previousViewportResizeCount).toBe(4);
  expect(recoveries[0].payload.previousLastViewport).toEqual({ width: 390, height: 780 });
  expect(recoveries[0].payload.device?.viewport?.width).toBeGreaterThan(0);
});

test("Cascade queues intentional GameFrame reload reasons separately from abrupt recovery", async ({ page }) => {
  await page.addInitScript(({ lifecycleKey, analyticsKey, diagnosticsKey, reloadKey }) => {
    localStorage.removeItem(lifecycleKey);
    localStorage.removeItem(analyticsKey);
    localStorage.removeItem(diagnosticsKey);
    sessionStorage.removeItem(reloadKey);
  }, { lifecycleKey: LIFECYCLE_KEY, analyticsKey: ANALYTICS_KEY, diagnosticsKey: DIAGNOSTIC_QUEUE_KEY, reloadKey: RELOAD_INTENT_KEY });

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

  const result = await page.evaluate(({ lifecycleKey, diagnosticsKey, reloadKey }) => ({
    lifecycle: JSON.parse(localStorage.getItem(lifecycleKey) || "null"),
    diagnostics: JSON.parse(localStorage.getItem(diagnosticsKey) || "[]"),
    sessionIntent: JSON.parse(sessionStorage.getItem(reloadKey) || "null"),
  }), { lifecycleKey: LIFECYCLE_KEY, diagnosticsKey: DIAGNOSTIC_QUEUE_KEY, reloadKey: RELOAD_INTENT_KEY });

  expect(result.lifecycle?.reloadIntent?.reason).toBe("test-reload");
  expect(result.sessionIntent?.reason).toBe("test-reload");
  expect(result.sessionIntent?.status).toBeUndefined();
  expect(result.sessionIntent?.detail?.status).toBe(200);
  const intents = incidentsOfType(result.diagnostics, "intentional_reload");
  expect(intents).toHaveLength(1);
  expect(intents[0].payload.reason).toBe("test-reload");
});

test("Cascade queues JavaScript errors with recent gameplay breadcrumbs but not ordinary boots", async ({ page }) => {
  await page.addInitScript(({ diagnosticsKey, analyticsKey }) => {
    localStorage.removeItem(diagnosticsKey);
    localStorage.setItem(analyticsKey, JSON.stringify([
      { at: new Date(Date.now() - 100).toISOString(), type: "clear", level: 7, cascade: 2, specialTriggered: 2 },
      { at: new Date().toISOString(), type: "move", level: 7, movesRemaining: 11 },
    ]));
  }, { diagnosticsKey: DIAGNOSTIC_QUEUE_KEY, analyticsKey: ANALYTICS_KEY });
  await page.goto("/cascade.html?player=cascade-lifecycle-error");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  expect(await page.evaluate((diagnosticsKey) => JSON.parse(localStorage.getItem(diagnosticsKey) || "[]").length, DIAGNOSTIC_QUEUE_KEY)).toBe(0);
  await page.evaluate(() => window.dispatchEvent(new ErrorEvent("error", {
    message: "synthetic mobile renderer error",
    filename: "cascade-test.js",
    lineno: 17,
    colno: 3,
  })));
  const incidents = await page.evaluate((diagnosticsKey) => JSON.parse(localStorage.getItem(diagnosticsKey) || "[]"), DIAGNOSTIC_QUEUE_KEY);
  const errors = incidentsOfType(incidents, "javascript_error");
  expect(errors).toHaveLength(1);
  expect(errors[0].payload.error?.message).toContain("synthetic mobile renderer error");
  expect(errors[0].payload.breadcrumbs.some((event) => event.type === "clear" && event.cascade === 2)).toBe(true);
});

test("Cascade marks a normal pagehide as a clean renderer exit without creating a diagnostic incident", async ({ page }) => {
  await page.addInitScript(({ lifecycleKey, diagnosticsKey }) => {
    localStorage.removeItem(lifecycleKey);
    localStorage.removeItem(diagnosticsKey);
  }, { lifecycleKey: LIFECYCLE_KEY, diagnosticsKey: DIAGNOSTIC_QUEUE_KEY });

  await page.goto("/cascade.html?player=cascade-lifecycle-pagehide");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));

  const result = await page.evaluate(({ lifecycleKey, diagnosticsKey }) => ({
    lifecycle: JSON.parse(localStorage.getItem(lifecycleKey) || "null"),
    diagnostics: JSON.parse(localStorage.getItem(diagnosticsKey) || "[]"),
  }), { lifecycleKey: LIFECYCLE_KEY, diagnosticsKey: DIAGNOSTIC_QUEUE_KEY });
  expect(result.lifecycle?.cleanExit).toBe(true);
  expect(Number(result.lifecycle?.exitAt)).toBeGreaterThan(0);
  expect(result.diagnostics).toHaveLength(0);
});
