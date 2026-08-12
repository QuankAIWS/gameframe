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

async function center(locator) {
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function gridDistance(a, b) {
  return Math.abs(Math.floor(a / 8) - Math.floor(b / 8)) + Math.abs((a % 8) - (b % 8));
}

test("Cascade supports click-hold-drag-release swapping, cancellation, and existing click controls", async ({ page }) => {
  await page.goto("/cascade.html?player=cascade-drag-test");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  const move = await firstLegalMove(page);
  expect(move).toBeTruthy();
  const from = page.locator(`.cascade-tile[data-index="${move.from}"]`);
  const to = page.locator(`.cascade-tile[data-index="${move.to}"]`);
  const fromCenter = await center(from);
  const toCenter = await center(to);
  const movesBefore = Number(await page.locator("#moves").textContent());

  // A previous click selection must not hijack a later drag gesture.
  const preselectedIndex = Array.from({ length: 64 }, (_, index) => index)
    .find((index) => index !== move.from && index !== move.to && gridDistance(index, move.from) > 1);
  expect(preselectedIndex).not.toBeUndefined();
  const preselected = page.locator(`.cascade-tile[data-index="${preselectedIndex}"]`);
  await preselected.click();
  await expect(preselected).toHaveClass(/is-selected/);

  // Pulling back onto the starting tile before release cancels the gesture and clears that old selection.
  await page.mouse.move(fromCenter.x, fromCenter.y);
  await page.mouse.down();
  await page.mouse.move(toCenter.x, toCenter.y, { steps: 4 });
  await expect(to).toHaveClass(/is-drag-target/);
  await expect(page.locator(".cascade-tile.is-selected")).toHaveCount(0);
  await page.mouse.move(fromCenter.x, fromCenter.y, { steps: 4 });
  await expect(page.locator(".is-drag-target")).toHaveCount(0);
  await page.mouse.up();
  await expect(page.locator("#moves")).toHaveText(String(movesBefore));
  await expect(page.locator("#score")).toHaveText("0");

  // Releasing over the adjacent target executes the normal canonical swap path.
  await page.mouse.move(fromCenter.x, fromCenter.y);
  await page.mouse.down();
  await page.mouse.move(toCenter.x, toCenter.y, { steps: 4 });
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