import { expect, test } from "@playwright/test";

async function firstLegalMove(page) {
  return page.evaluate(async () => {
    const { listLegalMoves } = await import("/cascade-engine.js");
    const board = [...document.querySelectorAll(".cascade-tile")]
      .map((tile) => Number(tile.dataset.kind));
    return listLegalMoves(board)[0] ?? null;
  });
}

test("Cascade emits large reward effects through one full-viewport screen-blended canvas", async ({ page }) => {
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
  expect(afterMatch.canvasMode).toBe("full-viewport-screen");
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

test("Cascade keeps full-range confetti and the cabinet visible through a nuclear clear", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => {
    localStorage.setItem("scribbles-gameframe.cascade-sound:v1", "off");
    localStorage.setItem("scribbles-gameframe.cascade-effects:v1", "full");
    // Exercise the backing-buffer cap on a high-DPI desktop while keeping the
    // CSS particle surface full-viewport.
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, get: () => 2 });
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
  expect(result.stats.activeParticles).toBe(result.stats.particleBudget);
  expect(result.stats.peakParticles).toBe(result.stats.particleBudget);
  expect(result.stats.activeSquares).toBeGreaterThan(0);
  expect(result.stats.activeRibbons).toBeGreaterThan(0);
  expect(result.stats.activeDomNodes).toBeLessThanOrEqual(170);
  expect(result.stats.peakDomNodes).toBeLessThanOrEqual(170);
  expect(result.stats.lastGeometryReads).toBeLessThanOrEqual(65);
  expect(result.stats.canvasCount).toBe(1);
  expect(result.stats.canvasMode).toBe("full-viewport-screen");
  expect(result.stats.contextLosses).toBe(0);
  expect(result.stats.canvasDpr).toBe(1.25);
  expect(result.stats.canvasBackingPixels).toBe(2400 * 1350);

  const compositor = await page.evaluate(() => {
    const canvas = document.querySelector(".cascade-dopamine-canvas");
    const canvasRect = canvas.getBoundingClientRect();
    const style = getComputedStyle(canvas);
    return {
      canvas: {
        left: canvasRect.left,
        top: canvasRect.top,
        right: canvasRect.right,
        bottom: canvasRect.bottom,
        width: canvasRect.width,
        height: canvasRect.height,
      },
      mixBlendMode: style.mixBlendMode,
      backgroundColor: style.backgroundColor,
      contain: style.contain,
    };
  });

  // The particle surface intentionally reaches every viewport edge again so
  // square/ribbon confetti cannot be clipped at the cabinet boundary.
  expect(compositor.canvas.left).toBe(0);
  expect(compositor.canvas.top).toBe(0);
  expect(compositor.canvas.right).toBe(1920);
  expect(compositor.canvas.bottom).toBe(1080);
  expect(compositor.canvas.width).toBe(1920);
  expect(compositor.canvas.height).toBe(1080);
  expect(compositor.mixBlendMode).toBe("screen");
  expect(compositor.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(compositor.contain).toBe("none");

  // Capture the vulnerable moment after particles have had time to travel well
  // outside the grid: candies are clearing while squares/ribbons remain active.
  await page.evaluate(() => {
    document.querySelectorAll(".cascade-tile").forEach((tile) => tile.classList.add("is-clearing"));
  });
  await page.waitForTimeout(220);
  await expect(page.locator(".cascade-game")).toBeVisible();
  await expect(page.locator(".cascade-board-wrap")).toBeVisible();
  const live = await page.evaluate(() => window.cascadePresentationDirector.getStats());
  expect(live.activeParticles).toBeGreaterThan(0);
  expect(live.activeSquares).toBeGreaterThan(0);
  expect(live.activeRibbons).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath("cascade-nuclear-live.png"), fullPage: false });
});
