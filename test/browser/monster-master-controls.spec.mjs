import { expect, test } from "@playwright/test";

async function diagnostics(page) {
  return page.locator("#monster-master-details").evaluate((node) => JSON.parse(node.textContent));
}

async function openMonsterMaster(page, player, { mobile = false } = {}) {
  if (mobile) await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/monster-master.html?player=${player}`);
  await expect.poll(() => page.evaluate(() => Boolean(window.gameFrameMonsterController))).toBe(true);
  await page.locator("#monster-master-theo").click();
  await expect(page.locator("body.monster-master-match-active")).toBeVisible();
  await expect(page.locator("body.monster-master-pixi-ready")).toBeVisible();
  await expect(page.locator("#monster-master-pixi-canvas")).toBeVisible();
}

async function selectedDeploymentAction(page) {
  return page.evaluate(() => {
    const view = window.gameFrameMonsterController.getView();
    const state = JSON.parse(document.querySelector("#monster-master-details")?.textContent || "{}");
    return view.observation.legalActions.find((action) => (
      action.type === "deploy-unit" && action.unitId === state.selectedUnitId
    )) ?? null;
  });
}

async function dispatchBoardCoordinate(page, coordinate) {
  const dispatched = await page.evaluate(
    (target) => window.gameFrameMonsterPixiBridge.dispatchCoordinate(target),
    coordinate,
  );
  expect(dispatched).toBe(true);
}

test("Monster Master camera buttons and keyboard controls update the Pixi camera", async ({ page }) => {
  await openMonsterMaster(page, "monster-controls");

  const initial = await page.evaluate(() => window.gameFrameMonsterPixi.getCamera());
  await page.locator("#monster-master-zoom-in").click();
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterPixi.getCamera().zoom)).toBeGreaterThan(initial.zoom);

  const zoomed = await page.evaluate(() => window.gameFrameMonsterPixi.getCamera());
  await page.locator('[data-monster-master-pan-x="3"][data-monster-master-pan-y="0"]').click();
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterPixi.getCamera().x)).toBeGreaterThan(zoomed.x);

  await page.locator("#monster-master-center-field").click();
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterPixi.getCamera().x)).toBeCloseTo(11.5, 5);
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterPixi.getCamera().y)).toBeCloseTo(11.5, 5);

  const centered = await page.evaluate(() => window.gameFrameMonsterPixi.getCamera());
  await page.keyboard.press("KeyA");
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterPixi.getCamera().x)).not.toBe(centered.x);

  const quarter = await page.evaluate(() => window.gameFrameMonsterPixi.getCamera().quarter);
  await page.keyboard.press("KeyE");
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterPixi.getCamera().quarter)).toBe((quarter + 1) % 4);
  await page.keyboard.press("KeyQ");
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterPixi.getCamera().quarter)).toBe(quarter);

  await expect.poll(async () => (await diagnostics(page)).viewport.quarter).toBe(quarter);
});

test("mobile Monster Master deploys through the authoritative Pixi coordinate boundary without horizontal overflow", async ({ page }) => {
  await openMonsterMaster(page, "monster-mobile-deploy", { mobile: true });

  const action = await selectedDeploymentAction(page);
  expect(action).not.toBeNull();
  await dispatchBoardCoordinate(page, action.position);
  await expect(page.locator("#monster-master-revision")).toHaveText("Revision 2");
  await expect(page.locator("#monster-master-status")).toContainText("Stone Bulwark");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("Setup stops the active surface and allows a fresh battle", async ({ page }) => {
  await openMonsterMaster(page, "monster-reset");
  const firstMatchId = (await diagnostics(page)).matchId;

  const setup = page.locator("#gameframe-destination-bar #monster-master-new-match");
  await expect(setup).toBeVisible();
  await setup.click();
  await expect(page.locator("#monster-master-lobby")).toBeVisible();
  await expect(page.locator("#monster-master-match")).toBeHidden();
  await expect(page).not.toHaveURL(/match=/);

  await page.locator("#monster-master-theo").click();
  await expect.poll(async () => (await diagnostics(page)).matchId).not.toBe(firstMatchId);
  await expect(page.locator("#monster-master-match")).toBeVisible();
});

test("Monster Master uses the compatibility battlefield when the WebGL fallback is armed", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("gameframe:monster-master:legacy-renderer-fallback", "true");
  });
  await page.goto("/monster-master.html?player=monster-legacy-fallback");
  await expect.poll(() => page.evaluate(() => Boolean(window.gameFrameMonsterController))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterRendererMode)).toBe("legacy");
  await expect(page.locator("body.monster-master-legacy-fallback")).toBeVisible();
  await expect(page.locator("#monster-master-error")).toContainText("compatibility battlefield");
  await page.locator("#monster-master-theo").click();
  await expect(page.locator("#monster-master-canvas")).toBeVisible();
  await expect(page.locator("#monster-master-pixi-canvas")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterLegacyDrawCount ?? 0)).toBeGreaterThan(0);
});
