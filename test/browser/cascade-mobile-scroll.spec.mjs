import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

async function expectOlderEyeComposition(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto("/cascade.html");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  await expect(page.locator("#cascade-mobile-menu-toggle")).toBeVisible();
  await expect(page.locator("#booster-hammer")).toBeVisible();
  await expect(page.locator("#cascade-weekly-card")).toBeVisible();
  await expect(page.locator(".cascade-map")).toBeHidden();

  const geometry = await page.evaluate(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, bottom: box.bottom, right: box.right };
    };
    const firstTile = document.querySelector(".cascade-tile");
    const tileBox = firstTile?.getBoundingClientRect();
    return {
      board: rect("#board"),
      hammer: rect("#booster-hammer"),
      blitz: rect("#cascade-weekly-card"),
      menu: rect("#cascade-mobile-menu-toggle"),
      movesFont: Number.parseFloat(getComputedStyle(document.querySelector("#moves")).fontSize),
      objectiveFont: Number.parseFloat(getComputedStyle(document.querySelector("#objective-label")).fontSize),
      tileWidth: tileBox?.width ?? 0,
      tileHeight: tileBox?.height ?? 0,
      scrollHeight: document.documentElement.scrollHeight,
    };
  });

  expect(geometry.board).toBeTruthy();
  expect(geometry.hammer).toBeTruthy();
  expect(geometry.blitz).toBeTruthy();
  expect(geometry.menu).toBeTruthy();
  expect(geometry.board.width).toBeGreaterThanOrEqual(viewport.width - 10);
  expect(geometry.board.right).toBeLessThanOrEqual(viewport.width + 1);
  expect(geometry.hammer.height).toBeGreaterThanOrEqual(52);
  expect(geometry.blitz.height).toBeGreaterThanOrEqual(52);
  expect(geometry.menu.height).toBeGreaterThanOrEqual(44);
  expect(geometry.movesFont).toBeGreaterThanOrEqual(28);
  expect(geometry.objectiveFont).toBeGreaterThanOrEqual(15);
  expect(geometry.tileWidth).toBeGreaterThanOrEqual(viewport.width === 360 ? 40 : 44);
  expect(geometry.tileHeight).toBeGreaterThanOrEqual(viewport.width === 360 ? 44 : 48);
  expect(Math.max(geometry.hammer.bottom, geometry.blitz.bottom)).toBeLessThanOrEqual(viewport.height + 1);
  expect(geometry.scrollHeight).toBeLessThanOrEqual(viewport.height + 1);
}

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

test("Cascade keeps the full older-eye play surface above the fold on common phones", async ({ page }) => {
  await expectOlderEyeComposition(page, { width: 390, height: 844 });
  await expectOlderEyeComposition(page, { width: 360, height: 800 });
});

test("Cascade mobile game menu owns progress and secondary preferences", async ({ page }) => {
  await page.goto("/cascade.html");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  await expect(page.locator("#level-stars")).not.toBeVisible();
  await expect(page.locator("#streak")).not.toBeVisible();
  await expect(page.locator("#cascade-feedback-card")).not.toBeVisible();

  const toggle = page.locator("#cascade-mobile-menu-toggle");
  await toggle.click();
  const menu = page.locator("#cascade-mobile-menu");
  await expect(menu).toBeVisible();
  await expect(menu.locator("#level-stars")).toBeVisible();
  await expect(menu.locator("#streak")).toBeVisible();
  await expect(menu.locator("#cascade-feedback-card")).toBeVisible();
  await expect(menu.getByRole("link", { name: "All games" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Close game menu" })).toHaveCSS("min-height", "48px");

  await menu.getByRole("button", { name: "Close game menu" }).click();
  await expect(menu).not.toBeVisible();
  await expect(page.locator("#booster-hammer")).toBeVisible();
});

test("Cascade keeps exact best-star data while portrait play hides the level tree", async ({ page }) => {
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

  await page.setViewportSize({ width: 1280, height: 900 });
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

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cascade.html");
  await expect(page.locator(".cascade-map")).toBeHidden();
  await expect(threeStars).toHaveText("★★★");
  await expect(twoStars).toHaveText("★★");
  await expect(oneStar).toHaveText("★");
  await expect(twoStars).toHaveAttribute("aria-label", "Best rating: 2 of 3 stars");
});
