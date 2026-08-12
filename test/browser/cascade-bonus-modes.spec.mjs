import { expect, test } from "@playwright/test";

const PERFORMANCE_KEY = "scribbles-gameframe.cascade-performance:v1";

test("Quick Recall uses an accessible pace, shows entered colors, and stores a best result", async ({ page }) => {
  await page.goto("/cascade.html?player=quick-recall-test");
  await expect(page.locator("#cascade-weekly-card")).toBeVisible();

  await page.evaluate(() => window.cascadeBonusModes.startQuickRecall(8));
  const dialog = page.locator("#cascade-recall-dialog");
  const choices = dialog.locator("[data-recall-choices]");
  const stage = dialog.locator("[data-recall-stage]");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-recall-kicker]")).toHaveText("QUICK RECALL");

  // Round one deliberately remains in WATCH long enough for a casual player to follow it.
  await page.waitForTimeout(3_000);
  await expect(choices).toBeHidden();

  for (const [round, length] of [3, 4, 5].entries()) {
    await expect(choices).toBeVisible({ timeout: 8_000 });
    const buttons = choices.locator("button");
    await expect(buttons).toHaveCount(6);
    for (let index = 0; index < length; index += 1) {
      await buttons.nth(index % 6).click();
      if (index < length - 1) {
        await expect(stage.locator(".is-recall-entered")).toHaveCount(index + 1);
        await expect(stage.locator(".is-recall-entered").nth(index)).toHaveAttribute("data-kind", String(index % 6));
      }
    }
    if (round < 2) {
      await expect(choices).toBeHidden({ timeout: 3_000 });
    }
  }

  await expect(dialog.locator("[data-recall-kicker]")).toHaveText("QUICK RECALL COMPLETE", { timeout: 4_000 });
  await expect(dialog.locator("[data-recall-title]")).toContainText("% recalled");
  await expect(dialog.getByRole("button", { name: "Continue" })).toBeVisible();

  const stored = await page.evaluate((key) => {
    const performance = JSON.parse(localStorage.getItem(key) || "{}");
    return {
      seen: performance.recallSeen?.["recall-after-8"],
      best: performance.recallBest?.["recall-after-8"],
      stars: performance.blitzStars?.["recall-after-8"],
    };
  }, PERFORMANCE_KEY);
  expect(stored.seen).toBe(true);
  expect(stored.best.total).toBe(12);
  expect(stored.best.correct).toBeGreaterThanOrEqual(0);
  expect(stored.stars).toBeGreaterThanOrEqual(0);
});

test("Weekly Blitz uses a stable weekly event and deterministic starting board", async ({ page }) => {
  await page.goto("/cascade.html?player=weekly-blitz-test");
  const card = page.locator("#cascade-weekly-card");
  await expect(card).toBeVisible();
  await expect(card).toContainText("WEEKLY BLITZ");
  await expect(card).toContainText("everyone gets the same board this week");
  await expect(card).not.toContainText(/seed/i);

  const first = await page.evaluate(() => {
    const event = window.cascadeBonusModes.currentWeeklyEvent();
    window.cascadeBonusModes.startWeeklyBlitz();
    const state = window.cascadeResearch.exportLevel();
    return { event, board: state.board, mode: state.mode };
  });
  expect(first.mode).toBe("blitz");
  expect(first.board).toHaveLength(64);
  expect(first.event.modeId).toBe("weekly-blitz");
  expect(first.event.id).toContain(first.event.week);
  await expect(page.locator("#level-number")).toHaveText("B");
  await expect(page.locator("#target")).toHaveText("∞");
  await expect(page.locator("#moves")).toHaveText("∞");

  await page.reload();
  const second = await page.evaluate(() => {
    const event = window.cascadeBonusModes.currentWeeklyEvent();
    window.cascadeBonusModes.startWeeklyBlitz();
    const state = window.cascadeResearch.exportLevel();
    return { event, board: state.board, mode: state.mode };
  });
  expect(second.event.id).toBe(first.event.id);
  expect(second.event.seed).toBe(first.event.seed);
  expect(second.board).toEqual(first.board);
});