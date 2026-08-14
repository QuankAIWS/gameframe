import { expect, test } from "@playwright/test";

async function firstLegalMove(page) {
  return page.evaluate(async () => {
    const { listLegalMoves } = await import("/cascade-engine.js");
    const board = [...document.querySelectorAll(".cascade-tile")].map((tile) => Number(tile.dataset.kind));
    return listLegalMoves(board)[0] ?? null;
  });
}

test("Cascade routes gameplay spectacle through one explicit presentation director", async ({ page }) => {
  await page.goto("/cascade.html?player=cascade-director-test");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  expect(await page.locator('script[src="/cascade-polish.js"]').count()).toBe(0);
  expect(await page.locator('script[src="/cascade-dopamine-vfx.js"]').count()).toBe(0);
  await expect(page.locator("#cascade-feedback-card > small")).toHaveText("SETTINGS");

  const move = await firstLegalMove(page);
  expect(move).toBeTruthy();
  await page.locator(`.cascade-tile[data-index="${move.from}"]`).click();
  await page.locator(`.cascade-tile[data-index="${move.to}"]`).click();

  await expect.poll(() => page.evaluate(() => window.cascadePresentationDirector?.getStats().transitions || 0), {
    timeout: 6_000,
  }).toBeGreaterThan(0);
  const stats = await page.evaluate(() => window.cascadePresentationDirector.getStats());
  expect(stats.clears).toBeGreaterThan(0);
  expect(stats.canvasCount).toBe(1);
  expect(stats.peakParticles).toBeLessThanOrEqual(stats.particleBudget);
});

test("Cascade reward sequence cashes unused moves, fills stars, and surfaces earned hammer", async ({ page }) => {
  await page.goto("/cascade.html?player=cascade-reward-sequence-test");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  await page.evaluate(() => {
    window.__cascadeRewardDemo = window.cascadePresentationDirector.demoWin({
      moves: 4,
      scoreBeforeBonus: 1200,
      scoreAfterBonus: 1600,
      stars: 3,
      reward: { claimed: 1 },
    });
  });

  const stage = page.locator(".cascade-reward-stage");
  await expect(stage).toHaveClass(/is-active/);
  await expect(stage.locator(".cascade-reward-kicker")).toHaveText("LEVEL CLEARED");
  await expect(stage.locator(".cascade-reward-stars i.is-earned")).toHaveCount(3, { timeout: 5_000 });
  await expect(stage.locator("[data-reward-hammer]")).toContainText("hammer earned");

  await page.evaluate(() => window.__cascadeRewardDemo);
  await expect(stage).not.toHaveClass(/is-active/);
  await expect(page.locator("#score")).toHaveText("1,600");
  expect(await page.evaluate(() => window.cascadePresentationDirector.getStats().rewardSequences)).toBe(1);
});
