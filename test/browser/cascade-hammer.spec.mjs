import { expect, test } from "@playwright/test";

const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const PERFORMANCE_KEY = "scribbles-gameframe.cascade-performance:v1";
const ACTIVE_RUN_KEY = "scribbles-gameframe.cascade-active-run:v1";

test("hammer inventory updates immediately and an iced target loses only one ice layer", async ({ page }) => {
  await page.addInitScript(({ stateKey, activeRunKey }) => {
    window.localStorage.removeItem(activeRunKey);
    window.localStorage.setItem(stateKey, JSON.stringify({
      level: 151,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 0,
      hammers: 2,
    }));
  }, { stateKey: STATE_KEY, activeRunKey: ACTIVE_RUN_KEY });

  await page.goto("/cascade.html");
  await expect(page.locator("#level-number")).toHaveText("151");
  await expect(page.locator("#hammer-count")).toHaveText("2");

  const before = await page.evaluate(() => {
    const snapshot = window.cascadeResearch.exportLevel();
    const index = snapshot.progress.ice.findIndex((layers) => layers > 0);
    if (index < 0) throw new Error("Level 151 did not expose an iced hammer target.");
    return {
      index,
      ice: snapshot.progress.ice[index],
      kind: snapshot.board[index],
      special: snapshot.specials[index],
      movesRemaining: snapshot.movesRemaining,
    };
  });

  await page.locator("#booster-hammer").click();
  const target = page.locator(`.cascade-tile[data-index="${before.index}"]`);
  await expect(target).toHaveClass(/is-hammer-target/);
  await target.click();

  expect((await page.locator("#hammer-count").textContent())?.trim()).toBe("1");
  expect(await page.evaluate(() => window.cascadeResearch.exportState()?.hammers)).toBe(1);

  await expect.poll(() => page.evaluate((targetIndex) => window.cascadeResearch.exportLevel().progress.ice[targetIndex], before.index), {
    timeout: 8_000,
  }).toBe(before.ice - 1);

  const after = await page.evaluate((index) => {
    const snapshot = window.cascadeResearch.exportLevel();
    return {
      ice: snapshot.progress.ice[index],
      kind: snapshot.board[index],
      special: snapshot.specials[index],
      movesRemaining: snapshot.movesRemaining,
    };
  }, before.index);

  expect(after.ice).toBe(before.ice - 1);
  expect(after.kind).toBe(before.kind);
  expect(after.special).toBe(before.special);
  expect(after.movesRemaining).toBe(before.movesRemaining);
});

test("banked rewards do not refill a spent hammer during an active level", async ({ page }) => {
  await page.addInitScript(({ stateKey, performanceKey, activeRunKey }) => {
    window.localStorage.removeItem(activeRunKey);
    window.localStorage.setItem(stateKey, JSON.stringify({
      level: 151,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 0,
      hammers: 6,
    }));
    window.localStorage.setItem(performanceKey, JSON.stringify({
      starsByLevel: {},
      blitzBest: {},
      blitzStars: {},
      blitzSeen: {},
      pendingHammerRewards: 3,
    }));
  }, { stateKey: STATE_KEY, performanceKey: PERFORMANCE_KEY, activeRunKey: ACTIVE_RUN_KEY });

  await page.goto("/cascade.html");
  await expect(page.locator("#hammer-count")).toHaveText("6");

  const targetIndex = await page.evaluate(() => {
    const snapshot = window.cascadeResearch.exportLevel();
    const index = snapshot.progress.ice.findIndex((layers) => layers > 0);
    if (index < 0) throw new Error("Level 151 did not expose an iced hammer target.");
    return index;
  });

  await page.locator("#booster-hammer").click();
  await page.locator(`.cascade-tile[data-index="${targetIndex}"]`).click();

  expect((await page.locator("#hammer-count").textContent())?.trim()).toBe("5");
  expect(await page.evaluate(() => window.cascadeResearch.exportState()?.hammers)).toBe(5);
  expect(await page.evaluate(() => window.cascadeResearch.exportPerformance()?.pendingHammerRewards)).toBe(3);

  await expect.poll(() => page.evaluate(() => Boolean(window.cascadeResearch.exportActiveRun())), {
    timeout: 8_000,
  }).toBe(true);

  await page.reload();
  await expect(page.locator("#hammer-count")).toHaveText("5");
  expect(await page.evaluate(() => window.cascadeResearch.exportState()?.hammers)).toBe(5);
  expect(await page.evaluate(() => window.cascadeResearch.exportPerformance()?.pendingHammerRewards)).toBe(3);
});
