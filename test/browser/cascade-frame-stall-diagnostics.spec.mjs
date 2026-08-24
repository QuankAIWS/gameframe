import { expect, test } from "@playwright/test";

const LIFECYCLE_KEY = "scribbles-gameframe.cascade-render-lifecycle:v1";
const DIAGNOSTIC_QUEUE_KEY = "scribbles-gameframe.cascade-diagnostics-queue:v1";

function sessionBody(playerId) {
  return JSON.stringify({
    playerId,
    displayName: "Frame Stall Diagnostics",
    source: "development",
    admin: true,
  });
}

async function holdAnimationFramesWithActiveVfx(page) {
  await page.evaluate(() => {
    const originalDirector = window.cascadePresentationDirector;
    const originalRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    const held = [];
    window.__cascadeFrameStallOriginalDirector = originalDirector;
    window.cascadePresentationDirector = {
      ...originalDirector,
      getStats() {
        return {
          ...originalDirector.getStats(),
          activeDomNodes: 36,
          peakDomNodes: 420,
          activeParticles: 360,
          peakParticles: 360,
          contextLosses: 0,
          canvasDpr: 1.5,
          canvasBackingPixels: 740610,
          canvasMode: "full-viewport-screen",
        };
      },
    };
    window.requestAnimationFrame = (callback) => {
      held.push(callback);
      return held.length;
    };
    window.__cascadeReleaseFrameStall = (offsetMs = 180) => {
      const callbacks = held.splice(0);
      window.requestAnimationFrame = originalRequestAnimationFrame;
      const frameAt = performance.now() + offsetMs;
      for (const callback of callbacks) callback(frameAt);
      return callbacks.length;
    };
  });
  await page.waitForTimeout(320);
  return page.evaluate(() => window.__cascadeReleaseFrameStall(180));
}

async function restoreDirector(page) {
  await page.evaluate(() => {
    if (window.__cascadeFrameStallOriginalDirector) {
      window.cascadePresentationDirector = window.__cascadeFrameStallOriginalDirector;
      delete window.__cascadeFrameStallOriginalDirector;
    }
    delete window.__cascadeReleaseFrameStall;
  });
}

test("Cascade captures active VFX at a visible frame stall without spamming diagnostics", async ({ page }) => {
  const posted = [];
  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: sessionBody("cascade-frame-stall-diagnostics"),
    });
  });
  await page.route("**/api/me/cascade/diagnostics", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    posted.push(body);
    const incidents = body.incidents || [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accepted: incidents.length,
        duplicates: 0,
        storedIncidents: incidents.length,
        retentionDays: 30,
        updatedAt: Date.now(),
      }),
    });
  });
  await page.addInitScript(({ lifecycleKey, diagnosticsKey }) => {
    localStorage.removeItem(lifecycleKey);
    localStorage.removeItem(diagnosticsKey);
  }, { lifecycleKey: LIFECYCLE_KEY, diagnosticsKey: DIAGNOSTIC_QUEUE_KEY });

  await page.goto("/cascade.html?player=cascade-frame-stall-diagnostics");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  await page.waitForTimeout(1_100);

  expect(await holdAnimationFramesWithActiveVfx(page)).toBeGreaterThan(0);
  await expect.poll(() => posted.flatMap((body) => body.incidents || []).filter((incident) => incident.type === "visible_frame_stall").length).toBe(1);

  const incident = posted.flatMap((body) => body.incidents || []).find((candidate) => candidate.type === "visible_frame_stall");
  expect(incident).toBeTruthy();
  expect(incident.payload.gapMs).toBeGreaterThanOrEqual(120);
  expect(incident.payload.stallVfx?.activeParticles).toBe(360);
  expect(incident.payload.stallVfx?.activeDomNodes).toBe(36);
  expect(incident.payload.stallVfx?.peakDomNodes).toBe(420);
  expect(incident.payload.stallVfx?.contextLosses).toBe(0);
  expect(incident.payload.stallVfx?.canvasDpr).toBe(1.5);

  const firstSnapshot = await page.evaluate(() => window.cascadeLifecycleDiagnostics.snapshot());
  expect(firstSnapshot.frameHealth.maxVisibleFrameGapMs).toBeGreaterThanOrEqual(120);
  expect(firstSnapshot.frameHealth.recentVisibleFrameGaps.at(-1)?.vfx?.particles).toBe(360);
  expect(firstSnapshot.lastVfx?.activeParticles).toBe(360);

  expect(await holdAnimationFramesWithActiveVfx(page)).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  const stallIncidents = posted.flatMap((body) => body.incidents || []).filter((candidate) => candidate.type === "visible_frame_stall");
  expect(stallIncidents).toHaveLength(1);

  const secondSnapshot = await page.evaluate(() => window.cascadeLifecycleDiagnostics.snapshot());
  expect(secondSnapshot.frameHealth.recentVisibleFrameGaps.length).toBeGreaterThanOrEqual(2);
  expect(secondSnapshot.frameHealth.recentVisibleFrameGaps.at(-1)?.vfx?.particles).toBe(360);

  await restoreDirector(page);
});