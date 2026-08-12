import { expect, test } from "@playwright/test";

async function firstLegalMove(page) {
  return page.evaluate(async () => {
    const { listLegalMoves } = await import("/cascade-engine.js");
    const board = [...document.querySelectorAll(".cascade-tile")]
      .map((tile) => Number(tile.dataset.kind));
    return listLegalMoves(board)[0] ?? null;
  });
}

test("Cascade emits large reward effects through one bounded canvas layer", async ({ page }) => {
  await page.goto("/cascade.html?player=cascade-vfx-test");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  // Idle tiles should not all be permanently promoted to compositor layers.
  expect(await page.locator(".cascade-tile").first().evaluate((tile) => getComputedStyle(tile).willChange)).toBe("auto");

  const move = await firstLegalMove(page);
  expect(move).toBeTruthy();
  await page.locator(`.cascade-tile[data-index="${move.from}"]`).click();
  await page.locator(`.cascade-tile[data-index="${move.to}"]`).click();

  await expect.poll(() => page.evaluate(() => window.cascadeDopamineVfx?.getStats().bursts || 0), {
    timeout: 6_000,
  }).toBeGreaterThan(0);

  const afterMatch = await page.evaluate(() => window.cascadeDopamineVfx.getStats());
  expect(afterMatch.canvasCount).toBe(1);
  expect(afterMatch.particleBudget).toBe(360);
  expect(afterMatch.peakParticles).toBeGreaterThanOrEqual(20);
  expect(afterMatch.peakParticles).toBeLessThanOrEqual(afterMatch.particleBudget);
  await expect(page.locator(".cascade-dopamine-canvas")).toBeVisible();

  // Hammer the demo hook repeatedly: spectacle may saturate, but allocation must not.
  await page.evaluate(() => {
    for (let index = 0; index < 30; index += 1) window.cascadeDopamineVfx.demo(3);
  });
  const stressed = await page.evaluate(() => window.cascadeDopamineVfx.getStats());
  expect(stressed.canvasCount).toBe(1);
  expect(stressed.activeParticles).toBeLessThanOrEqual(stressed.particleBudget);
  expect(stressed.peakParticles).toBeLessThanOrEqual(stressed.particleBudget);
});
