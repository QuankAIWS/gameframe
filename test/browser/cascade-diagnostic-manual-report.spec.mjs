import { expect, test } from "@playwright/test";

const LIFECYCLE_KEY = "scribbles-gameframe.cascade-render-lifecycle:v1";
const ANALYTICS_KEY = "scribbles-gameframe.cascade-analytics:v1";
const DIAGNOSTIC_QUEUE_KEY = "scribbles-gameframe.cascade-diagnostics-queue:v1";
const MAX_DELIVERY_PAYLOAD_CHARS = 7_800;

test("Cascade manual visual report keeps renderer evidence below the delivery cutoff", async ({ page }) => {
  const posted = [];
  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        playerId: "cascade-manual-report-budget",
        displayName: "Manual Report Budget",
        source: "development",
        admin: true,
      }),
    });
  });
  await page.route("**/api/me/cascade/diagnostics", async (route) => {
    posted.push(JSON.parse(route.request().postData() || "{}"));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accepted: 1, duplicates: 0, storedIncidents: 1, retentionDays: 30, updatedAt: Date.now() }),
    });
  });
  await page.addInitScript(({ lifecycleKey, analyticsKey, diagnosticsKey }) => {
    localStorage.removeItem(diagnosticsKey);
    const now = Date.now();
    const sample = (index) => ({
      at: now - (8 - index) * 250,
      dom: 420 + index * 8,
      particles: 360,
      groups: 24 + (index % 5),
      losses: 0,
      dpr: 1.5,
      pixels: 740610,
      level: 17,
      moves: 8,
    });
    localStorage.setItem(lifecycleKey, JSON.stringify({
      documentId: "prior-black-screen-budget",
      openedAt: now - 12_000,
      lastSeenAt: now - 400,
      cleanExit: true,
      visibility: "visible",
      navigationType: "reload",
      wasDiscarded: false,
      reloadIntent: null,
      lastInteractionAt: now - 100,
      viewportResizeCount: 14,
      visualViewportResizeCount: 18,
      lastViewport: { width: 390, height: 844 },
      build: {
        loadedBuildId: "401fc023b253d6b5e98ec67411b0224fc511ee3e",
        currentBuildId: "401fc023b253d6b5e98ec67411b0224fc511ee3e",
        status: "current",
        source: "cloudflare",
      },
      lastVfx: {
        at: now - 250,
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
      recentVfxSamples: Array.from({ length: 8 }, (_, index) => sample(index)),
      frameHealth: {
        maxVisibleFrameGapMs: 487,
        recentVisibleFrameGaps: Array.from({ length: 6 }, (_, index) => ({
          at: now - (6 - index) * 180,
          gapMs: 180 + index * 60,
        })),
      },
      lastError: null,
    }));
    localStorage.setItem(analyticsKey, JSON.stringify(Array.from({ length: 18 }, (_, index) => ({
      at: new Date(now - (18 - index) * 100).toISOString(),
      type: "clear",
      mode: "normal",
      level: 17,
      cascade: 2 + (index % 4),
      combo: index % 2 ? "stripe-bomb" : "color-bomb",
      matched: 9 + index,
      specialCreated: 1,
      specialTriggered: 3,
      score: 12000 + index * 500,
      movesRemaining: 8,
    }))));
  }, { lifecycleKey: LIFECYCLE_KEY, analyticsKey: ANALYTICS_KEY, diagnosticsKey: DIAGNOSTIC_QUEUE_KEY });

  await page.goto("/cascade.html?player=cascade-manual-report-budget");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  await page.evaluate(async () => {
    window.cascadeLifecycleDiagnostics.reportVisualIssue("test-black-screen-budget");
    await window.cascadeDiagnosticsSync.flush();
  });

  const incidents = posted.flatMap((body) => body.incidents || []);
  const report = incidents.find((incident) => incident.type === "manual_visual_report");
  expect(report).toBeTruthy();
  expect(JSON.stringify(report.payload).length).toBeLessThanOrEqual(MAX_DELIVERY_PAYLOAD_CHARS);
  expect(report.payload.breadcrumbs).toHaveLength(4);
  expect(report.payload.previousRenderer?.recentVfxSamples).toHaveLength(4);
  expect(report.payload.previousRenderer?.recentVfxSamples.at(-1)?.particles).toBe(360);
  expect(report.payload.previousRenderer?.frameHealth?.recentVisibleFrameGaps).toHaveLength(3);
  expect(report.payload.previousRenderer?.frameHealth?.maxVisibleFrameGapMs).toBe(487);
});
