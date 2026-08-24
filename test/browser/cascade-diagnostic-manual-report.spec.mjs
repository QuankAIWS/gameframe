import { expect, test } from "@playwright/test";

const LIFECYCLE_KEY = "scribbles-gameframe.cascade-render-lifecycle:v1";
const ANALYTICS_KEY = "scribbles-gameframe.cascade-analytics:v1";
const DIAGNOSTIC_QUEUE_KEY = "scribbles-gameframe.cascade-diagnostics-queue:v1";
const MAX_DELIVERY_PAYLOAD_CHARS = 7_800;

function sessionBody(playerId, displayName = "Diagnostics Test") {
  return JSON.stringify({
    playerId,
    displayName,
    source: "development",
    admin: true,
  });
}

function seedPriorRenderer({ lifecycleKey, analyticsKey, diagnosticsKey, withBacklog = false }) {
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
  if (withBacklog) {
    localStorage.setItem(diagnosticsKey, JSON.stringify(Array.from({ length: 4 }, (_, index) => ({
      incidentId: `cascade-diagnostic:old:${index}`,
      at: new Date(now - (4 - index) * 1_000).toISOString(),
      type: "old_diagnostic",
      payload: { index },
    }))));
  }
}

test("Cascade manual visual report keeps renderer evidence below the delivery cutoff", async ({ page }) => {
  const posted = [];
  await page.route("**/api/session", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: sessionBody("cascade-manual-report-budget", "Manual Report Budget") });
  });
  await page.route("**/api/me/cascade/diagnostics", async (route) => {
    posted.push(JSON.parse(route.request().postData() || "{}"));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accepted: 1, duplicates: 0, storedIncidents: 1, retentionDays: 30, updatedAt: Date.now() }),
    });
  });
  await page.addInitScript(seedPriorRenderer, {
    lifecycleKey: LIFECYCLE_KEY,
    analyticsKey: ANALYTICS_KEY,
    diagnosticsKey: DIAGNOSTIC_QUEUE_KEY,
    withBacklog: false,
  });

  await page.goto("/cascade.html?player=cascade-manual-report-budget");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  const delivered = await page.evaluate(async () => {
    const report = window.cascadeLifecycleDiagnostics.reportVisualIssue("test-black-screen-budget");
    return window.cascadeDiagnosticsSync.flushIncident(report.incidentId);
  });
  expect(delivered).toBe(true);

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

test("Cascade manual visual report bypasses an older in-flight diagnostic batch", async ({ page }) => {
  const posted = [];
  let releaseOldBatch;
  const oldBatchGate = new Promise((resolve) => { releaseOldBatch = resolve; });
  await page.route("**/api/session", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: sessionBody("cascade-manual-report-priority", "Manual Report Priority") });
  });
  await page.route("**/api/me/cascade/diagnostics", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    posted.push(body);
    const incidents = body.incidents || [];
    if (incidents.some((incident) => incident.type === "old_diagnostic")) await oldBatchGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accepted: incidents.length, duplicates: 0, storedIncidents: incidents.length, retentionDays: 30, updatedAt: Date.now() }),
    });
  });
  await page.addInitScript(seedPriorRenderer, {
    lifecycleKey: LIFECYCLE_KEY,
    analyticsKey: ANALYTICS_KEY,
    diagnosticsKey: DIAGNOSTIC_QUEUE_KEY,
    withBacklog: true,
  });

  await page.goto("/cascade.html?player=cascade-manual-report-priority");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  await expect.poll(() => posted.some((body) => (body.incidents || []).some((incident) => incident.type === "old_diagnostic"))).toBe(true);

  const manualDelivery = page.evaluate(async () => {
    const report = window.cascadeLifecycleDiagnostics.reportVisualIssue("black-screen-with-backlog");
    return window.cascadeDiagnosticsSync.flushIncident(report.incidentId);
  });
  await expect.poll(() => posted.some((body) => (body.incidents || []).some((incident) => incident.type === "manual_visual_report"))).toBe(true);
  expect(await manualDelivery).toBe(true);

  releaseOldBatch();
  await expect.poll(() => page.evaluate((diagnosticsKey) => JSON.parse(localStorage.getItem(diagnosticsKey) || "[]").filter((incident) => incident.type === "manual_visual_report").length, DIAGNOSTIC_QUEUE_KEY)).toBe(0);
});

test("Cascade frame-gap probe ignores samples that cross a visibility transition", async ({ page }) => {
  await page.addInitScript(({ lifecycleKey, diagnosticsKey }) => {
    localStorage.removeItem(lifecycleKey);
    localStorage.removeItem(diagnosticsKey);
  }, { lifecycleKey: LIFECYCLE_KEY, diagnosticsKey: DIAGNOSTIC_QUEUE_KEY });
  await page.goto("/cascade.html?player=cascade-frame-gap-visibility");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  await page.evaluate(() => {
    const realRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    let held = null;
    window.__cascadeRestoreRaf = () => { window.requestAnimationFrame = realRequestAnimationFrame; };
    window.__cascadeReleaseHeldRaf = (offsetMs) => {
      const callback = held;
      held = null;
      if (callback) callback(performance.now() + offsetMs);
    };
    window.requestAnimationFrame = (callback) => {
      held = callback;
      return 1;
    };
  });
  await page.waitForTimeout(1_200);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.evaluate(() => {
    window.__cascadeReleaseHeldRaf(2_000);
    window.__cascadeRestoreRaf();
  });
  await page.waitForTimeout(50);

  const frameHealth = await page.evaluate(() => window.cascadeLifecycleDiagnostics.snapshot().frameHealth);
  expect(frameHealth.maxVisibleFrameGapMs).toBe(0);
  expect(frameHealth.recentVisibleFrameGaps).toHaveLength(0);
});
