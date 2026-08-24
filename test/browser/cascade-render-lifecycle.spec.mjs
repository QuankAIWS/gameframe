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

test("Cascade diagnostic delivery splits large queued incidents below the edge request limit", async ({ page }) => {
  const requestBodies = [];
  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        playerId: "cascade-diagnostics-batch",
        displayName: "Diagnostics Batch",
        source: "development",
        admin: false,
      }),
    });
  });
  await page.route("**/api/me/cascade/diagnostics", async (route) => {
    requestBodies.push(route.request().postData() || "");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accepted: 1, duplicates: 0, storedIncidents: 1, retentionDays: 30, updatedAt: Date.now() }),
    });
  });
  await page.addInitScript(({ lifecycleKey, diagnosticsKey }) => {
    localStorage.removeItem(lifecycleKey);
    const blob = "x".repeat(6_000);
    const incidents = Array.from({ length: 4 }, (_, index) => ({
      incidentId: `cascade-diagnostic:batch:${index}`,
      at: new Date(Date.now() + index).toISOString(),
      type: "synthetic_large_diagnostic",
      payload: { index, blob },
    }));
    localStorage.setItem(diagnosticsKey, JSON.stringify(incidents));
  }, { lifecycleKey: LIFECYCLE_KEY, diagnosticsKey: DIAGNOSTIC_QUEUE_KEY });

  await page.goto("/cascade.html?player=cascade-diagnostics-batch");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  await expect.poll(() => requestBodies.length, { timeout: 6_000 }).toBeGreaterThan(1);
  await expect.poll(() => page.evaluate((diagnosticsKey) => JSON.parse(localStorage.getItem(diagnosticsKey) || "[]").length, DIAGNOSTIC_QUEUE_KEY), { timeout: 6_000 }).toBe(0);

  expect(requestBodies.every((body) => body.length <= 15_000)).toBe(true);
  const delivered = requestBodies.flatMap((body) => JSON.parse(body).incidents || []);
  expect(delivered).toHaveLength(4);
});

test("Cascade manual visual report preserves prior renderer pressure and waits for upload", async ({ page }) => {
  const posted = [];
  let postCompleted = false;
  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        playerId: "cascade-manual-visual-report",
        displayName: "Manual Visual Report",
        source: "development",
        admin: true,
      }),
    });
  });
  await page.route("**/api/me/cascade/diagnostics", async (route) => {
    posted.push(JSON.parse(route.request().postData() || "{}"));
    await new Promise((resolve) => setTimeout(resolve, 120));
    postCompleted = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accepted: 1, duplicates: 0, storedIncidents: 1, retentionDays: 30, updatedAt: Date.now() }),
    });
  });
  await page.addInitScript(({ lifecycleKey, diagnosticsKey }) => {
    localStorage.removeItem(diagnosticsKey);
    localStorage.setItem(lifecycleKey, JSON.stringify({
      documentId: "prior-black-screen",
      openedAt: Date.now() - 12_000,
      lastSeenAt: Date.now() - 500,
      cleanExit: true,
      visibility: "visible",
      navigationType: "reload",
      wasDiscarded: false,
      reloadIntent: null,
      lastInteractionAt: Date.now() - 150,
      viewportResizeCount: 9,
      visualViewportResizeCount: 12,
      lastViewport: { width: 390, height: 844 },
      build: { loadedBuildId: "black-screen-build" },
      lastVfx: {
        at: Date.now() - 650,
        activeDomNodes: 483,
        peakDomNodes: 636,
        activeParticles: 360,
        peakParticles: 360,
        contextLosses: 0,
        visibleEffectGroups: 28,
        canvasDpr: 1.5,
        canvasBackingPixels: 740610,
        canvasMode: "adaptive",
        level: 17,
        moves: 8,
        interactionAgeMs: 70,
      },
      recentVfxSamples: [
        { at: Date.now() - 900, dom: 420, particles: 360, groups: 27, losses: 0, dpr: 1.5, pixels: 740610, level: 17, moves: 8 },
        { at: Date.now() - 650, dom: 483, particles: 360, groups: 28, losses: 0, dpr: 1.5, pixels: 740610, level: 17, moves: 8 },
      ],
      frameHealth: {
        maxVisibleFrameGapMs: 487,
        recentVisibleFrameGaps: [{ at: Date.now() - 700, gapMs: 487 }],
      },
      lastError: null,
    }));
  }, { lifecycleKey: LIFECYCLE_KEY, diagnosticsKey: DIAGNOSTIC_QUEUE_KEY });

  await page.goto("/cascade.html?player=cascade-manual-visual-report");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  await page.evaluate(async () => {
    window.cascadeLifecycleDiagnostics.reportVisualIssue("test-black-screen");
    await window.cascadeDiagnosticsSync.flush();
  });

  expect(postCompleted).toBe(true);
  const incidents = posted.flatMap((body) => body.incidents || []);
  const reports = incidentsOfType(incidents, "manual_visual_report");
  expect(reports).toHaveLength(1);
  expect(reports[0].payload.reason).toBe("test-black-screen");
  expect(reports[0].payload.previousRenderer?.documentId).toBe("prior-black-screen");
  expect(reports[0].payload.previousRenderer?.cleanExit).toBe(true);
  expect(reports[0].payload.previousRenderer?.lastVfx?.activeParticles).toBe(360);
  expect(reports[0].payload.previousRenderer?.recentVfxSamples).toHaveLength(2);
  expect(reports[0].payload.previousRenderer?.recentVfxSamples[1]?.groups).toBe(28);
  expect(reports[0].payload.previousRenderer?.frameHealth?.maxVisibleFrameGapMs).toBe(487);
  await expect.poll(() => page.evaluate((diagnosticsKey) => JSON.parse(localStorage.getItem(diagnosticsKey) || "[]").length, DIAGNOSTIC_QUEUE_KEY)).toBe(0);
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
