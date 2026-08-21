import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";
const stateKey = "scribbles-gameframe.cascade-state:v1";
const performanceKey = "scribbles-gameframe.cascade-performance:v1";
const soundKey = "scribbles-gameframe.cascade-sound:v1";
const effectsKey = "scribbles-gameframe.cascade-effects:v1";

async function prepare(page) {
  await mkdir(output, { recursive: true });
  await page.addInitScript(({ stateKey: key, performanceKey: perfKey, soundKey: audioKey, effectsKey: fxKey }) => {
    localStorage.setItem(audioKey, "off");
    localStorage.setItem(fxKey, "reduced");
    localStorage.setItem(key, JSON.stringify({
      level: 7,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 7,
      hammers: 2,
    }));
    localStorage.setItem(perfKey, JSON.stringify({
      starsByLevel: { "1": 3, "2": 3, "3": 2, "6": 2 },
      blitzBest: {},
      blitzStars: {},
      blitzSeen: {},
      pendingHammerRewards: 0,
    }));
  }, { stateKey, performanceKey, soundKey, effectsKey });
}

async function startActiveBlitz(page) {
  await page.goto("/cascade.html");
  await expect.poll(() => page.evaluate(() => typeof window.cascadeResearch?.startBlitz === "function")).toBe(true);
  await page.evaluate(() => window.cascadeResearch.startBlitz(5));
  await expect(page.locator("body")).toHaveClass(/cascade-blitz-mode/);
  await expect(page.locator("#blitz-overlay")).toBeVisible();
  await expect(page.locator("#blitz-callout")).toHaveText("BLITZ", { timeout: 4_000 });
  await expect(page.locator("#blitz-overlay")).not.toHaveClass(/is-countdown/);

  // Big cascades append this effect layer dynamically. Keep it in the test so
  // the active Blitz grid cannot regress by acquiring an implicit third row.
  await page.evaluate(() => {
    const wrap = document.querySelector(".cascade-board-wrap");
    if (!wrap || wrap.querySelector(".cascade-hype-layer")) return;
    const layer = document.createElement("div");
    layer.className = "cascade-hype-layer";
    layer.setAttribute("aria-hidden", "true");
    wrap.append(layer);
  });
}

async function expectActiveHudClearOfBoard(page) {
  const geometry = await page.evaluate(() => {
    const hud = document.querySelector("#blitz-overlay");
    const objective = document.querySelector(".cascade-objective");
    const board = document.querySelector("#board");
    const firstTile = document.querySelector(".cascade-tile");
    const hypeLayer = document.querySelector(".cascade-hype-layer");
    if (!hud || !objective || !board || !firstTile || !hypeLayer) return null;

    const hudRect = hud.getBoundingClientRect();
    const objectiveRect = objective.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    const firstTileRect = firstTile.getBoundingClientRect();
    const verticalOverlap = Math.max(
      0,
      Math.min(hudRect.bottom, boardRect.bottom) - Math.max(hudRect.top, boardRect.top),
    );

    return {
      verticalOverlap,
      hudBottom: hudRect.bottom,
      boardTop: boardRect.top,
      hudObjectiveTopDelta: Math.abs(hudRect.top - objectiveRect.top),
      firstTileTop: firstTileRect.top,
      objectiveVisibility: getComputedStyle(objective).visibility,
      hypePosition: getComputedStyle(hypeLayer).position,
    };
  });

  expect(geometry).toBeTruthy();
  expect(geometry.objectiveVisibility).toBe("hidden");
  expect(geometry.hypePosition).toBe("absolute");
  expect(geometry.hudObjectiveTopDelta).toBeLessThanOrEqual(2);
  expect(geometry.verticalOverlap).toBeLessThanOrEqual(0.5);
  expect(geometry.hudBottom).toBeLessThanOrEqual(geometry.boardTop + 0.5);
  expect(geometry.firstTileTop).toBeGreaterThanOrEqual(geometry.boardTop);
}

test("active Cascade Blitz HUD never covers the board across desktop, TV, and mobile", async ({ page }) => {
  await prepare(page);

  const cases = [
    { name: "desktop", width: 1440, height: 960 },
    { name: "tv-960x540", width: 960, height: 540 },
    { name: "mobile", width: 390, height: 844 },
  ];

  for (const viewport of cases) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await startActiveBlitz(page);
    await expectActiveHudClearOfBoard(page);
    await page.screenshot({
      path: `${output}/cascade-crush-blitz-${viewport.name}.png`,
      fullPage: true,
    });
  }
});
