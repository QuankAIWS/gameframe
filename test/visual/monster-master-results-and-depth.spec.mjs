import { test, expect } from "@playwright/test";

async function openMonsterMaster(page, player) {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`/monster-master.html?player=${player}`);
  await expect.poll(() => page.evaluate(() => Boolean(window.gameFrameMonsterController))).toBe(true);
  await page.locator("#monster-master-bot").click();
  await expect(page.locator("body.monster-master-match-active")).toBeVisible();
  await expect(page.locator("body.monster-master-pixi-ready")).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.gameFrameMonsterPixi?.getTerrainStats))).toBe(true);
  await expect.poll(() => page.evaluate(() => Boolean(window.gameFrameMonsterResults?.capture))).toBe(true);
}

test("Monster Master renders exact joined wall geometry inside the Pixi scene", async ({ page }, testInfo) => {
  await openMonsterMaster(page, "monster-terrain-geometry");

  await expect(page.locator("#monster-master-terrain-depth-canvas")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterPixi.getTerrainStats().wallCount)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterPixi.getTerrainStats().renderedFaces)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterPixi.getTerrainStats().culledFaces)).toBeGreaterThan(0);

  const result = await page.evaluate(() => {
    const view = window.gameFrameMonsterController.getView();
    const map = view.observation.board.map;
    const wallIndex = map.cells.findIndex((cell) => cell.terrain === "wall");
    const coordinate = { x: wallIndex % map.width, y: Math.floor(wallIndex / map.width) };
    const snapshot = window.gameFrameMonsterPixi.getGeometrySnapshot(coordinate);
    const stats = window.gameFrameMonsterPixi.getTerrainStats();
    const canvas = document.querySelector("#monster-master-pixi-canvas");
    return {
      snapshot,
      stats,
      canvas: {
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        pixelWidth: canvas.width,
        pixelHeight: canvas.height,
      },
    };
  });

  expect(result.snapshot.terrain).toBe("wall");
  expect(result.snapshot.visualHeight).toBe(29);
  expect(result.snapshot.baseCenter.y - result.snapshot.topCenter.y).toBe(29);
  expect(Math.max(...result.snapshot.topPolygon.map((point) => point.x)) - Math.min(...result.snapshot.topPolygon.map((point) => point.x))).toBe(72);
  expect(Math.max(...result.snapshot.topPolygon.map((point) => point.y)) - Math.min(...result.snapshot.topPolygon.map((point) => point.y))).toBe(36);
  expect(result.stats.groundObjects).toBe(1);
  expect(result.stats.renderedFaces).toBeLessThan(result.stats.wallCount * 2);
  expect(result.stats.renderedFaces + result.stats.culledFaces).toBeLessThanOrEqual(result.stats.wallCount * 2);
  expect(result.stats.worldObjectCount).toBe(result.stats.terrainObjects + result.stats.unitObjects);
  expect(result.canvas.width).toBeGreaterThan(900);
  expect(result.canvas.height).toBeGreaterThan(600);
  expect(result.canvas.pixelWidth).toBeGreaterThanOrEqual(result.canvas.width);
  expect(result.canvas.pixelHeight).toBeGreaterThanOrEqual(result.canvas.height);
  expect(result.canvas.pixelWidth / result.canvas.width).toBeLessThanOrEqual(1.51);

  await page.evaluate(() => window.gameFrameMonsterPixi.setGeometryDebug(true));
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterPixi.isGeometryDebugEnabled())).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("monster-master-terrain-geometry-debug-desktop.png"), fullPage: true });

  await page.evaluate(() => window.gameFrameMonsterPixi.setGeometryDebug(false));
  await page.screenshot({ path: testInfo.outputPath("monster-master-terrain-geometry-desktop.png"), fullPage: true });
});

test("Monster Master presents a terminal victory screen over the surviving battlefield", async ({ page }, testInfo) => {
  await openMonsterMaster(page, "monster-victory-screen");

  const resultScreen = page.locator("#monster-master-result-screen");
  await expect(resultScreen).toBeHidden();

  await page.evaluate(() => {
    const view = window.gameFrameMonsterController.getView();
    const yourId = view.observation.yourPlayerId;
    const deployedFriendly = view.observation.board.units.filter((unit) => unit.ownerId === yourId);
    const fallback = view.observation.rosters[yourId]?.[0];
    const friendlySurvivors = deployedFriendly.length > 0
      ? deployedFriendly
      : fallback
        ? [{ ...fallback, position: { x: 3, y: 3 } }]
        : [];
    const completed = {
      ...view,
      revision: view.revision + 1000,
      observation: {
        ...view.observation,
        board: {
          ...view.observation.board,
          units: friendlySurvivors,
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
  await expect(page.locator("#monster-master-status")).toHaveText("Your force won the duel.");
  await expect(page.locator("#monster-master-result-rematch")).toBeVisible();
  await expect(resultScreen.getByRole("link", { name: "Return home" })).toHaveAttribute("href", "/");
  await expect(page.locator("#monster-master-pixi-canvas")).toBeVisible();

  await page.waitForTimeout(900);
  await expect(resultScreen).toBeVisible();
  await expect(page.locator("#monster-master-status")).toHaveText("Your force won the duel.");
  await page.screenshot({ path: testInfo.outputPath("monster-master-victory-desktop.png"), fullPage: true });

  await page.evaluate(() => window.gameFrameMonsterResults.reset());
  await expect(resultScreen).toBeHidden();
});
