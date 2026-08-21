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

test("legacy banked hammer rewards are deleted and never refill spent inventory", async ({ page }) => {
  await page.addInitScript(({ stateKey, performanceKey, activeRunKey }) => {
    const seedKey = "cascade-hammer-legacy-bank-test-seeded";
    if (window.sessionStorage.getItem(seedKey) === "1") return;
    window.sessionStorage.setItem(seedKey, "1");
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
  expect(await page.evaluate(() => Object.hasOwn(window.cascadeResearch.exportPerformance() || {}, "pendingHammerRewards"))).toBe(false);

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
  expect(await page.evaluate(() => Object.hasOwn(window.cascadeResearch.exportPerformance() || {}, "pendingHammerRewards"))).toBe(false);

  await expect.poll(() => page.evaluate(() => Boolean(window.cascadeResearch.exportActiveRun())), {
    timeout: 8_000,
  }).toBe(true);

  await page.reload();
  await expect(page.locator("#hammer-count")).toHaveText("5");
  expect(await page.evaluate(() => window.cascadeResearch.exportState()?.hammers)).toBe(5);
  expect(await page.evaluate(() => Object.hasOwn(window.cascadeResearch.exportPerformance() || {}, "pendingHammerRewards"))).toBe(false);
});

test("one Cascade result can grant at most one hammer and full-inventory overflow is discarded", async ({ page }) => {
  await page.goto("/cascade.html");

  const cases = await page.evaluate(async () => {
    const { resolveStarHammerReward } = await import("/cascade-hammer-economy.js");
    return {
      full: resolveStarHammerReward({ hammers: 6, previousStars: 9, nextStars: 10 }),
      afterSpendWithoutNewStars: resolveStarHammerReward({ hammers: 4, previousStars: 10, nextStars: 10 }),
      available: resolveStarHammerReward({ hammers: 4, previousStars: 19, nextStars: 20 }),
      malformedLargeJump: resolveStarHammerReward({ hammers: 0, previousStars: 0, nextStars: 30 }),
    };
  });

  expect(cases.full).toEqual({ hammers: 6, earned: 1, granted: 0, discarded: 1 });
  expect(cases.afterSpendWithoutNewStars).toEqual({ hammers: 4, earned: 0, granted: 0, discarded: 0 });
  expect(cases.available).toEqual({ hammers: 5, earned: 1, granted: 1, discarded: 0 });
  expect(cases.malformedLargeJump).toEqual({ hammers: 1, earned: 1, granted: 1, discarded: 0 });
});
