import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("Cascade mobile play does not scroll the page away from the board after a match", async ({ page }) => {
  await page.goto("/cascade.html");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  const board = page.locator("#board");
  await board.scrollIntoViewIfNeeded();
  const scrollBeforeMove = await page.evaluate(() => window.scrollY);

  const move = await page.evaluate(async () => {
    const { listLegalMoves } = await import("/cascade-engine.js");
    const kinds = [...document.querySelectorAll(".cascade-tile")]
      .map((tile) => Number(tile.dataset.kind));
    return listLegalMoves(kinds)[0] ?? null;
  });

  expect(move).toBeTruthy();

  await page.locator(`.cascade-tile[data-index="${move.from}"]`).click();
  await page.locator(`.cascade-tile[data-index="${move.to}"]`).click();

  await expect.poll(async () => {
    const text = await page.locator("#score").textContent();
    return Number(String(text).replaceAll(",", ""));
  }, { timeout: 5_000 }).toBeGreaterThan(0);

  await expect.poll(async () => page.evaluate((baseline) => Math.abs(window.scrollY - baseline), scrollBeforeMove), {
    timeout: 2_000,
  }).toBeLessThan(8);

  await expect(board).toBeInViewport();
});

test("Cascade level tree shows the exact best stars on desktop and mobile", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("scribbles-gameframe.cascade-state:v1", JSON.stringify({
      level: 4,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 0,
      hammers: 2,
    }));
    localStorage.setItem("scribbles-gameframe.cascade-performance:v1", JSON.stringify({
      starsByLevel: { "1": 3, "2": 2, "3": 1 },
      blitzBest: {},
      blitzStars: {},
      blitzSeen: {},
      pendingHammerRewards: 0,
    }));
  });

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/cascade.html");

    const threeStars = page.locator('#level-map > li[data-level="1"] .cascade-map-stars');
    const twoStars = page.locator('#level-map > li[data-level="2"] .cascade-map-stars');
    const oneStar = page.locator('#level-map > li[data-level="3"] .cascade-map-stars');
    await expect(threeStars).toHaveText("★★★");
    await expect(twoStars).toHaveText("★★");
    await expect(oneStar).toHaveText("★");
    await expect(twoStars).toHaveAttribute("aria-label", "Best rating: 2 of 3 stars");
    await expect(threeStars).toBeVisible();
    await expect(twoStars).toBeVisible();
    await expect(oneStar).toBeVisible();

    const twoStarBounds = await twoStars.evaluate((badge) => {
      const cell = badge.closest("li");
      const badgeRect = badge.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();
      return {
        badgeLeft: badgeRect.left,
        badgeRight: badgeRect.right,
        badgeTop: badgeRect.top,
        badgeBottom: badgeRect.bottom,
        cellLeft: cellRect.left,
        cellRight: cellRect.right,
        cellTop: cellRect.top,
        cellBottom: cellRect.bottom,
      };
    });
    expect(twoStarBounds.badgeLeft).toBeGreaterThanOrEqual(twoStarBounds.cellLeft - 1);
    expect(twoStarBounds.badgeRight).toBeLessThanOrEqual(twoStarBounds.cellRight + 1);
    expect(twoStarBounds.badgeTop).toBeGreaterThanOrEqual(twoStarBounds.cellTop - 1);
    expect(twoStarBounds.badgeBottom).toBeLessThanOrEqual(twoStarBounds.cellBottom + 1);
  }
});
