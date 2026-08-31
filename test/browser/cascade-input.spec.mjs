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

test("Cascade visibly picks up a dragged tile, supports cancellation, and preserves click controls", async ({ page }) => {
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

  // Crossing the drag threshold lifts a visible copy that follows the pointer while
  // the destination slot yields toward the incoming tile.
  await page.mouse.move(fromCenter.x, fromCenter.y);
  await page.mouse.down();
  await page.mouse.move(toCenter.x, toCenter.y, { steps: 4 });
  await expect(from).toHaveClass(/is-drag-origin/);
  await expect(to).toHaveClass(/is-drag-target/);
  await expect(page.locator(".cascade-drag-ghost")).toHaveCount(1);
  await expect(page.locator(".cascade-tile.is-selected")).toHaveCount(0);
  const ghostBox = await page.locator(".cascade-drag-ghost").boundingBox();
  expect(ghostBox).toBeTruthy();
  expect(Math.hypot(
    ghostBox.x + ghostBox.width / 2 - fromCenter.x,
    ghostBox.y + ghostBox.height / 2 - fromCenter.y,
  )).toBeGreaterThan(10);

  // Pulling back onto the starting tile before release cancels the move and returns
  // the lifted visual home without spending a move.
  await page.mouse.move(fromCenter.x, fromCenter.y, { steps: 4 });
  await expect(page.locator(".is-drag-target")).toHaveCount(0);
  await page.mouse.up();
  await expect(page.locator(".cascade-drag-ghost")).toHaveCount(0, { timeout: 1_000 });
  await expect(page.locator("#moves")).toHaveText(String(movesBefore));
  await expect(page.locator("#score")).toHaveText("0");

  // Releasing over the adjacent target executes the normal canonical swap path.
  await page.mouse.move(fromCenter.x, fromCenter.y);
  await page.mouse.down();
  await page.mouse.move(toCenter.x, toCenter.y, { steps: 4 });
  await expect(page.locator(".cascade-drag-ghost")).toHaveCount(1);
  await expect(to).toHaveClass(/is-drag-target/);
  await page.mouse.up();

  await expect.poll(async () => Number(String(await page.locator("#score").textContent()).replaceAll(",", "")), {
    timeout: 6_000,
  }).toBeGreaterThan(0);
  await expect(page.locator("#moves")).toHaveText(String(movesBefore - 1));
  await expect(page.locator(".is-drag-origin, .is-drag-target")).toHaveCount(0);
  await expect(page.locator(".cascade-drag-ghost")).toHaveCount(0, { timeout: 1_000 });

  // A legal opening move can legitimately clear an early level. If that
  // happens, finish the victory choice before checking ordinary board controls;
  // the Hammer is correctly disabled while the result is modal.
  const continueButton = page.locator("#result-actions button").filter({ hasText: "Continue" });
  if (await continueButton.isVisible().catch(() => false)) {
    await continueButton.click();
    await expect(page.locator("#result-dialog")).not.toBeVisible({ timeout: 8_000 });
  }

  // The score/move counters update before cascade presentation finishes. The
  // unified cabinet deliberately allows a longer reward presentation, so wait for
  // the real unlocked control state before proving click-then-click still works.
  await expect(page.locator("#booster-hammer")).toBeEnabled({ timeout: 15_000 });
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