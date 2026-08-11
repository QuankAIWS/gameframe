import { expect, test } from "@playwright/test";

const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const PERFORMANCE_KEY = "scribbles-gameframe.cascade-performance:v1";
const ACTIVE_RUN_KEY = "scribbles-gameframe.cascade-active-run:v1";

async function installState(page, { level, hammers = 2, performance = null }) {
  await page.addInitScript(({ stateKey, performanceKey, targetLevel, hammerCount, savedPerformance }) => {
    localStorage.setItem(stateKey, JSON.stringify({
      level: targetLevel,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 0,
      hammers: hammerCount,
    }));
    if (savedPerformance) localStorage.setItem(performanceKey, JSON.stringify(savedPerformance));
  }, {
    stateKey: STATE_KEY,
    performanceKey: PERFORMANCE_KEY,
    targetLevel: level,
    hammerCount: hammers,
    savedPerformance: performance,
  });
}

async function firstLegalMove(page) {
  return page.evaluate(async () => {
    const { listLegalMoves } = await import("/cascade-engine.js");
    const board = [...document.querySelectorAll(".cascade-tile")].map((tile) => Number(tile.dataset.kind));
    return listLegalMoves(board)[0] ?? null;
  });
}

function exportedRun(page) {
  return page.evaluate(() => {
    const current = window.cascadeResearch.exportLevel();
    return {
      level: current.level.level,
      score: current.score,
      movesRemaining: current.movesRemaining,
      board: current.board,
      specials: current.specials,
      progress: current.progress,
    };
  });
}

test("Cascade resumes the exact settled normal-level board after a page reload", async ({ page }) => {
  await installState(page, { level: 31 });
  await page.goto("/cascade.html");
  await expect(page.locator("#level-number")).toHaveText("31");

  const move = await firstLegalMove(page);
  expect(move).toBeTruthy();
  await page.locator(`.cascade-tile[data-index="${move.from}"]`).click();
  await page.locator(`.cascade-tile[data-index="${move.to}"]`).click();

  await expect.poll(() => page.evaluate(() => window.cascadeResearch.exportActiveRun()?.score || 0), { timeout: 8_000 }).toBeGreaterThan(0);
  await expect(page.locator(".cascade-score-pop")).toHaveCount(0, { timeout: 3_000 });
  const before = await exportedRun(page);

  await page.reload();
  await expect(page.locator("#level-number")).toHaveText("31");
  const after = await exportedRun(page);

  expect(after).toEqual(before);
  await expect.poll(() => page.evaluate(() => window.cascadeResearch.exportEvents().filter((event) => event.type === "level_resume").length)).toBeGreaterThan(0);
});

test("Cascade allows spending multiple owned hammers in the same level without spending moves", async ({ page }) => {
  await installState(page, { level: 300, hammers: 2 });
  await page.goto("/cascade.html");
  await expect(page.locator("#moves")).toHaveText("24");
  await expect(page.locator("#hammer-count")).toHaveText("2");

  await page.locator("#booster-hammer").click();
  await page.locator('.cascade-tile[data-index="0"]').click();
  await expect(page.locator("#hammer-count")).toHaveText("1", { timeout: 8_000 });
  await expect(page.locator("#booster-hammer")).toBeEnabled({ timeout: 8_000 });
  await expect(page.locator("#moves")).toHaveText("24");

  await page.locator("#booster-hammer").click();
  await page.locator('.cascade-tile[data-index="1"]').click();
  await expect(page.locator("#hammer-count")).toHaveText("0", { timeout: 8_000 });
  await expect(page.locator("#moves")).toHaveText("24");
});

test("Cascade labels progression stars as best ratings and distinguishes a lower replay result", async ({ page }) => {
  await installState(page, {
    level: 1,
    hammers: 1,
    performance: {
      starsByLevel: { "1": 3 },
      blitzBest: {},
      blitzStars: {},
      blitzSeen: {},
      pendingHammerRewards: 0,
    },
  });
  await page.goto("/cascade.html");

  await expect(page.locator('#level-map > li[data-level="1"] .cascade-map-stars')).toHaveAttribute("aria-label", "Best rating: 3 of 3 stars");
  await page.evaluate(({ key }) => {
    const run = window.cascadeResearch.exportActiveRun();
    run.score = 1085;
    run.movesRemaining = 1;
    localStorage.setItem(key, JSON.stringify(run));
  }, { key: ACTIVE_RUN_KEY });

  await page.reload();
  await expect(page.locator("#score")).toHaveText("1,085");
  await expect(page.locator("#moves")).toHaveText("1");
  await page.locator("#booster-hammer").click();
  await page.locator('.cascade-tile[data-index="0"]').click();

  await expect(page.locator("#result-dialog")).toBeVisible({ timeout: 8_000 });
  await expect(page.locator("#result-copy")).toContainText("★☆☆ this run · best ★★★");
});
