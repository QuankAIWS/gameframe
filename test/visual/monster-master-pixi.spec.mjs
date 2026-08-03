import { test, expect } from "@playwright/test";

async function selectedDeploymentAction(page) {
  return page.evaluate(() => {
    const view = window.gameFrameMonsterController?.getView?.();
    let diagnostics = {};
    try {
      diagnostics = JSON.parse(document.querySelector("#monster-master-details")?.textContent || "{}");
    } catch {
      diagnostics = {};
    }
    if (!view || !diagnostics.selectedUnitId) return null;
    return view.observation.legalActions.find(
      (action) => action.type === "deploy-unit" && action.unitId === diagnostics.selectedUnitId,
    ) ?? null;
  });
}

test("Monster Master uses an idle-on-demand Pixi WebGL battlefield", async ({ page }, testInfo) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/monster-master.html?player=monster-pixi-regression");
  await expect.poll(() => page.evaluate(() => Boolean(window.gameFrameMonsterController))).toBe(true);
  await page.locator("#monster-master-theo").click();
  await expect(page.locator("body.monster-master-match-active")).toBeVisible();
  await expect(page.locator("body.monster-master-pixi-ready")).toBeVisible();

  const pixiCanvas = page.locator("#monster-master-pixi-canvas");
  const legacyCanvas = page.locator("#monster-master-canvas");
  await expect(pixiCanvas).toBeVisible();
  await expect(legacyCanvas).toHaveClass(/monster-master-legacy-canvas/);
  await expect.poll(() => legacyCanvas.evaluate((node) => getComputedStyle(node).visibility)).toBe("hidden");
  await expect(page.locator("#monster-master-motion-canvas")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterRendererMode)).toBe("pixi");
  await expect.poll(() => page.evaluate(() => Boolean(window.gameFrameMonsterPixi?.getView?.()))).toBe(true);

  const webgl = await pixiCanvas.evaluate((canvas) => Boolean(
    canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl"),
  ));
  expect(webgl).toBe(true);

  await page.waitForTimeout(400);
  const idleBefore = await page.evaluate(() => window.gameFrameMonsterPixi.getPerformance().renders);
  await page.waitForTimeout(600);
  const idleAfter = await page.evaluate(() => window.gameFrameMonsterPixi.getPerformance().renders);
  expect(idleAfter - idleBefore).toBeLessThanOrEqual(1);

  const cameraBefore = await page.evaluate(() => window.gameFrameMonsterPixi.getCamera());
  const rendersBeforePan = await page.evaluate(() => window.gameFrameMonsterPixi.getPerformance().renders);
  await page.locator('[data-monster-master-pan-x="3"][data-monster-master-pan-y="0"]').click();
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterPixi.getCamera().x)).toBeGreaterThan(cameraBefore.x);
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterPixi.getPerformance().renders)).toBeGreaterThan(rendersBeforePan);

  const quarterBefore = await page.evaluate(() => window.gameFrameMonsterPixi.getCamera().quarter);
  await page.locator("#monster-master-rotate-right").click();
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterPixi.getCamera().quarter)).not.toBe(quarterBefore);

  await page.locator("#monster-master-center-field").click();
  const previousRevision = await page.evaluate(() => window.gameFrameMonsterController.getView().revision);
  await page.locator('#monster-master-options [data-action-kind="deploy-unit"]').first().click();
  await expect.poll(() => selectedDeploymentAction(page)).not.toBeNull();
  const action = await selectedDeploymentAction(page);

  const roundTrip = await page.evaluate((coordinate) => {
    const point = window.gameFrameMonsterPixiBridge.worldToScreen(coordinate);
    return {
      point,
      picked: point ? window.gameFrameMonsterPixi.screenToTile(point) : null,
    };
  }, action.position);
  expect(roundTrip.point).not.toBeNull();
  expect(roundTrip.picked).toEqual(action.position);

  const dispatched = await page.evaluate(
    (coordinate) => window.gameFrameMonsterPixiBridge.dispatchCoordinate(coordinate),
    action.position,
  );
  expect(dispatched).toBe(true);
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterController.getView().revision), {
    timeout: 8_000,
  }).toBeGreaterThan(previousRevision);

  const performance = await page.evaluate(() => window.gameFrameMonsterPixi.getPerformance());
  expect(performance.renders).toBeGreaterThan(0);
  expect(performance.lastRenderMs).toBeLessThan(100);
  expect(pageErrors).toEqual([]);

  await page.screenshot({ path: testInfo.outputPath("monster-master-pixi-desktop.png"), fullPage: true });
});

test("Monster Master Pixi battlefield stays inside the mobile viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/monster-master.html?player=monster-pixi-mobile");
  await expect.poll(() => page.evaluate(() => Boolean(window.gameFrameMonsterController))).toBe(true);
  await page.locator("#monster-master-theo").click();
  await expect(page.locator("body.monster-master-match-active")).toBeVisible();
  await expect(page.locator("body.monster-master-pixi-ready")).toBeVisible();
  await expect(page.locator("#monster-master-pixi-canvas")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  const resolution = await page.locator("#monster-master-pixi-canvas").evaluate((canvas) => ({
    clientWidth: canvas.clientWidth,
    clientHeight: canvas.clientHeight,
    pixelWidth: canvas.width,
    pixelHeight: canvas.height,
  }));
  expect(resolution.pixelWidth / Math.max(1, resolution.clientWidth)).toBeLessThanOrEqual(1.26);
  expect(resolution.pixelHeight / Math.max(1, resolution.clientHeight)).toBeLessThanOrEqual(1.26);

  await page.screenshot({ path: testInfo.outputPath("monster-master-pixi-mobile.png"), fullPage: true });
});
