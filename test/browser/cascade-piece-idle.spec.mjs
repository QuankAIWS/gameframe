import { expect, test } from "@playwright/test";

test("Cascade idles one color family at a time and yields immediately to input", async ({ page }) => {
  await page.goto("/cascade.html?player=cascade-idle-pulse-test");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  await expect.poll(() => page.locator(".cascade-tile.is-idle-pulse").count(), {
    timeout: 4_000,
  }).toBeGreaterThan(0);

  const pulseTiles = page.locator(".cascade-tile.is-idle-pulse");
  const pulseKinds = await pulseTiles.evaluateAll((tiles) => tiles.map((tile) => tile.dataset.kind));
  expect(new Set(pulseKinds).size).toBe(1);

  const pulseKind = pulseKinds[0];
  expect(await pulseTiles.count()).toBe(await page.locator(`.cascade-tile[data-kind="${pulseKind}"]`).count());

  const animatedKinds = await page.locator(".cascade-tile").evaluateAll((tiles) => tiles
    .filter((tile) => getComputedStyle(tile).animationName !== "none")
    .map((tile) => tile.dataset.kind));
  expect(new Set(animatedKinds)).toEqual(new Set([pulseKind]));
  expect(animatedKinds.length).toBeLessThan(32);

  expect(await page.locator(".cascade-tile").first().evaluate((tile) => getComputedStyle(tile).willChange)).toBe("auto");

  const target = pulseTiles.first();
  const box = await target.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.locator(".cascade-tile.is-idle-pulse")).toHaveCount(0);
  await page.mouse.up();
});
