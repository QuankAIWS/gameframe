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

test("Cascade bounds DOM spectacle and batches geometry for a nuclear clear", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("scribbles-gameframe.cascade-sound:v1", "off");
    localStorage.setItem("scribbles-gameframe.cascade-effects:v1", "full");
  });
  await page.goto("/cascade.html?player=cascade-vfx-nuclear-test");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  const result = await page.evaluate(() => {
    const matched = Array.from({ length: 64 }, (_, index) => index);
    const triggeredSpecials = [
      ...Array.from({ length: 8 }, (_, index) => ({ index, special: "color" })),
      ...Array.from({ length: 8 }, (_, offset) => ({ index: 8 + offset, special: "bomb" })),
      ...Array.from({ length: 16 }, (_, offset) => ({
        index: 16 + offset,
        special: offset % 2 ? "stripe-v" : "stripe-h",
      })),
    ];

    window.cascadePresentationDirector.transitionClear({
      combo: "color-bomb",
      cascade: 6,
      matched,
      triggeredSpecials,
      createdSpecials: [],
    });

    return {
      stats: window.cascadePresentationDirector.getStats(),
      popBursts: document.querySelectorAll(".cascade-pop-burst").length,
      popSparks: document.querySelectorAll(".cascade-pop-spark").length,
      colorWashes: document.querySelectorAll(".cascade-color-wash").length,
      bombImpacts: document.querySelectorAll(".cascade-impact-bomb").length,
      stripeBeams: document.querySelectorAll(".cascade-stripe-beam").length,
    };
  });

  expect(result.popBursts).toBeLessThanOrEqual(12);
  expect(result.popSparks).toBeLessThanOrEqual(120);
  expect(result.colorWashes).toBeLessThanOrEqual(1);
  expect(result.bombImpacts).toBeLessThanOrEqual(4);
  expect(result.stripeBeams).toBeLessThanOrEqual(8);
  expect(result.stats.activeParticles).toBeLessThanOrEqual(result.stats.particleBudget);
  expect(result.stats.peakParticles).toBeLessThanOrEqual(result.stats.particleBudget);
  expect(result.stats.activeDomNodes).toBeLessThanOrEqual(170);
  expect(result.stats.peakDomNodes).toBeLessThanOrEqual(170);
  expect(result.stats.lastGeometryReads).toBeLessThanOrEqual(65);
  expect(result.stats.canvasCount).toBe(1);
  expect(result.stats.contextLosses).toBe(0);
});
