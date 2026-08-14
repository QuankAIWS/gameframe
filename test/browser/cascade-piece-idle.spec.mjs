import { expect, test } from "@playwright/test";

test("Cascade uses one sparse idle attract cue and yields immediately to input", async ({ page }) => {
  await page.goto("/cascade.html?player=cascade-idle-pulse-test");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  await expect.poll(() => page.locator(".cascade-tile.is-idle-twinkle").count(), {
    timeout: 7_000,
  }).toBe(1);

  const twinkle = page.locator(".cascade-tile.is-idle-twinkle");
  await expect(page.locator(".cascade-board-wrap")).toHaveClass(/is-idle-attract/);

  const animatedTiles = await page.locator(".cascade-tile").evaluateAll((tiles) => tiles
    .filter((tile) => getComputedStyle(tile).animationName !== "none")
    .map((tile) => tile.dataset.index));
  expect(animatedTiles).toHaveLength(1);

  // Resting tiles remain unpromoted; the attract cue is brief and event-style.
  expect(await page.locator(".cascade-tile").first().evaluate((tile) => getComputedStyle(tile).willChange)).toBe("auto");

  const box = await twinkle.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.locator(".cascade-tile.is-idle-twinkle")).toHaveCount(0);
  await expect(page.locator(".cascade-board-wrap")).not.toHaveClass(/is-idle-attract/);
  await page.mouse.up();
});
