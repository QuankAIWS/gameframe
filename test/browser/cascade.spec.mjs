import { expect, test } from "@playwright/test";

test("Cascade resolves a legal move through the animated presentation layer", async ({ page }) => {
  await page.goto("/cascade.html");

  await expect(page.getByRole("heading", { name: "Cascade" })).toBeVisible();
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  const move = await page.evaluate(async () => {
    const { listLegalMoves } = await import("/cascade-engine.js");
    const board = [...document.querySelectorAll(".cascade-tile")]
      .map((tile) => Number(tile.dataset.kind));
    return listLegalMoves(board)[0] ?? null;
  });

  expect(move).toBeTruthy();

  await page.locator(`.cascade-tile[data-index="${move.from}"]`).click();
  await page.locator(`.cascade-tile[data-index="${move.to}"]`).click();

  await expect.poll(async () => {
    const text = await page.locator("#score").textContent();
    return Number(String(text).replaceAll(",", ""));
  }, { timeout: 5_000 }).toBeGreaterThan(0);

  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  await expect(page.locator(".cascade-score-pop, .cascade-burst")).toHaveCount(0, { timeout: 2_000 });
});
