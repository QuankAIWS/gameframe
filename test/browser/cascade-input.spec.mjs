import { expect, test } from "@playwright/test";

const STATE_KEY = "scribbles-gameframe.cascade-state:v1";

async function firstLegalMove(page) {
  return page.evaluate(async () => {
    const { listLegalMoves } = await import("/cascade-engine.js");
    const board = [...document.querySelectorAll(".cascade-tile")]
      .map((tile) => Number(tile.dataset.kind));
    return listLegalMoves(board)[0] ?? null;
  });
}

test("Cascade supports click-hold-drag-release swapping without breaking click controls", async ({ page }) => {
  await page.goto("/cascade.html?player=cascade-drag-test");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  const move = await firstLegalMove(page);
  expect(move).toBeTruthy();
  const from = page.locator(`.cascade-tile[data-index="${move.from}"]`);
  const to = page.locator(`.cascade-tile[data-index="${move.to}"]`);
  const fromBox = await from.boundingBox();
  const toBox = await to.boundingBox();
  expect(fromBox).toBeTruthy();
  expect(toBox).toBeTruthy();

  const movesBefore = Number(await page.locator("#moves").textContent());
  await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, { steps: 4 });
  await expect(to).toHaveClass(/is-drag-target/);
  await page.mouse.up();

  await expect.poll(async () => Number(String(await page.locator("#score").textContent()).replaceAll(",", "")), {
    timeout: 6_000,
  }).toBeGreaterThan(0);
  await expect(page.locator("#moves")).toHaveText(String(movesBefore - 1));
  await expect(page.locator(".is-drag-origin, .is-drag-target")).toHaveCount(0);

  // Existing click-then-click selection remains available after a drag.
  await page.locator(".cascade-tile").first().click();
  await expect(page.locator(".cascade-tile").first()).toHaveClass(/is-selected/);
});

test("using a hammer immediately decrements the visible count and persists inventory", async ({ page }) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({
      level: 1,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 0,
      hammers: 2,
    }));
  }, STATE_KEY);

  await page.goto("/cascade.html?player=cascade-hammer-test");
  await expect(page.locator("#hammer-count")).toHaveText("2");
  const movesBefore = await page.locator("#moves").textContent();

  await page.locator("#booster-hammer").click();
  const target = page.locator(".cascade-tile.is-hammer-target").first();
  await expect(target).toBeVisible();
  await target.click();

  await expect(page.locator("#hammer-count")).toHaveText("1", { timeout: 500 });
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}").hammers, STATE_KEY), {
    timeout: 8_000,
  }).toBe(1);
  await expect(page.locator("#moves")).toHaveText(movesBefore);
});
