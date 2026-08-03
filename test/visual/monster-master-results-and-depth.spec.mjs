import { test, expect } from "@playwright/test";

async function openMonsterMaster(page, player) {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`/monster-master.html?player=${player}`);
  await expect.poll(() => page.evaluate(() => Boolean(window.gameFrameMonsterController))).toBe(true);
  await page.locator("#monster-master-theo").click();
  await expect(page.locator("body.monster-master-match-active")).toBeVisible();
  await expect(page.locator("body.monster-master-pixi-ready")).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.gameFrameMonsterTerrainDepth?.getStats))).toBe(true);
  await expect.poll(() => page.evaluate(() => Boolean(window.gameFrameMonsterResults?.capture))).toBe(true);
}

test("Monster Master restores visible wall height above the Pixi battlefield", async ({ page }, testInfo) => {
  await openMonsterMaster(page, "monster-terrain-depth");

  const depthCanvas = page.locator("#monster-master-terrain-depth-canvas");
  await expect(depthCanvas).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterTerrainDepth.getStats().wallCount)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterTerrainDepth.getStats().renderedFaces)).toBeGreaterThan(0);

  const geometry = await depthCanvas.evaluate((canvas) => ({
    width: canvas.clientWidth,
    height: canvas.clientHeight,
    pixelWidth: canvas.width,
    pixelHeight: canvas.height,
    zIndex: getComputedStyle(canvas).zIndex,
  }));
  expect(geometry.width).toBeGreaterThan(900);
  expect(geometry.height).toBeGreaterThan(600);
  expect(geometry.pixelWidth).toBeGreaterThan(geometry.width);
  expect(Number(geometry.zIndex)).toBeGreaterThan(1);

  await page.screenshot({ path: testInfo.outputPath("monster-master-terrain-depth-desktop.png"), fullPage: true });
});

test("Monster Master presents a terminal victory screen over the surviving battlefield", async ({ page }, testInfo) => {
  await openMonsterMaster(page, "monster-victory-screen");

  const resultScreen = page.locator("#monster-master-result-screen");
  await expect(resultScreen).toBeHidden();

  await page.evaluate(() => {
    const view = window.gameFrameMonsterController.getView();
    const yourId = view.observation.yourPlayerId;
    const completed = {
      ...view,
      revision: view.revision + 1000,
      observation: {
        ...view.observation,
        board: {
          ...view.observation.board,
          units: view.observation.board.units.filter((unit) => unit.ownerId === yourId),
        },
        activePlayerId: null,
        activeUnitId: null,
        legalActions: [],
        status: {
          lifecycle: "completed",
          winnerPlayerId: yourId,
          draw: false,
        },
      },
    };
    window.gameFrameMonsterResults.capture(completed);
  });

  await expect(resultScreen).toBeVisible();
  await expect(resultScreen).toHaveAttribute("data-result", "victory");
  await expect(page.locator("#monster-master-result-title")).toHaveText("Victory");
  await expect(page.locator("#monster-master-result-summary")).toContainText("opposing force has been eliminated");
  await expect(page.locator("#monster-master-result-friendly")).toHaveText(/^[1-3]$/);
  await expect(page.locator("#monster-master-result-enemy")).toHaveText("0");
  await expect(page.locator("#monster-master-result-rematch")).toBeVisible();
  await expect(resultScreen.getByRole("link", { name: "Return home" })).toHaveAttribute("href", "/");
  await expect(page.locator("#monster-master-pixi-canvas")).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath("monster-master-victory-desktop.png"), fullPage: true });

  await page.evaluate(() => window.gameFrameMonsterResults.capture(window.gameFrameMonsterController.getView()));
  await expect(resultScreen).toBeHidden();
});
