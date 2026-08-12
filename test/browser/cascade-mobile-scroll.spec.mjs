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
