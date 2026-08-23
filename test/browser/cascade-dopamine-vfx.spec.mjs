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

test("Cascade bounds DOM spectacle and keeps the cabinet visible through a nuclear clear", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
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

  await expect.poll(() => page.evaluate(() => window.cascadeVfxCompositorGuard?.getStats().applyCount || 0), {
    timeout: 2_000,
  }).toBeGreaterThan(0);

  const compositor = await page.evaluate(() => {
    const canvas = document.querySelector(".cascade-dopamine-canvas");
    const board = document.querySelector("#board");
    const map = document.querySelector(".cascade-map");
    const side = document.querySelector(".cascade-side");
    const canvasRect = canvas.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    const mapRect = map.getBoundingClientRect();
    const sideRect = side.getBoundingClientRect();
    const style = getComputedStyle(canvas);
    return {
      guard: window.cascadeVfxCompositorGuard.getStats(),
      canvas: { left: canvasRect.left, top: canvasRect.top, right: canvasRect.right, bottom: canvasRect.bottom, width: canvasRect.width, height: canvasRect.height },
      board: { left: boardRect.left, top: boardRect.top, right: boardRect.right, bottom: boardRect.bottom },
      map: { left: mapRect.left, top: mapRect.top, right: mapRect.right, bottom: mapRect.bottom },
      side: { left: sideRect.left, top: sideRect.top, right: sideRect.right, bottom: sideRect.bottom },
      mixBlendMode: style.mixBlendMode,
      backgroundColor: style.backgroundColor,
    };
  });

  expect(compositor.guard.guarded).toBe(true);
  expect(compositor.guard.coverage).toBeLessThan(.85);
  expect(compositor.guard.backingPixels).toBeLessThan(
    Math.round(1920 * compositor.guard.dpr) * Math.round(1080 * compositor.guard.dpr) * .85,
  );
  expect(compositor.mixBlendMode).toBe("screen");
  expect(compositor.backgroundColor).toBe("rgba(0, 0, 0, 0)");

  // Overscan must carry particles beyond the grid and across both cabinet rails.
  expect(compositor.canvas.left).toBeLessThanOrEqual(compositor.map.left);
  expect(compositor.canvas.right).toBeGreaterThanOrEqual(compositor.side.right);
  expect(compositor.canvas.left).toBeLessThan(compositor.board.left - 80);
  expect(compositor.canvas.right).toBeGreaterThan(compositor.board.right + 80);
  expect(compositor.canvas.top).toBeLessThan(compositor.board.top - 80);
  expect(compositor.canvas.bottom).toBeGreaterThan(compositor.board.bottom + 120);

  // A roomy desktop retains an uncovered upper strip; a compositor backing
  // failure therefore cannot black out the whole application/header anymore.
  expect(compositor.canvas.top).toBeGreaterThanOrEqual(72);

  // Capture the exact vulnerable moment: every candy is entering its clear-out
  // animation while the nuclear particle/DOM spectacle is still alive.
  await page.evaluate(() => {
    document.querySelectorAll(".cascade-tile").forEach((tile) => tile.classList.add("is-clearing"));
  });
  await page.waitForTimeout(135);
  await expect(page.locator(".cascade-game")).toBeVisible();
  await expect(page.locator(".cascade-board-wrap")).toBeVisible();
  expect(await page.evaluate(() => window.cascadePresentationDirector.getStats().activeParticles)).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath("cascade-nuclear-live.png"), fullPage: false });
});
