import { expect, test } from "@playwright/test";

const PERSONALITY_BY_KIND = {
  "0": "cascade-idle-pink-squish",
  "1": "cascade-idle-cyan-tilt",
  "2": "cascade-idle-yellow-pop",
  "3": "cascade-idle-green-jelly",
  "4": "cascade-idle-purple-twinkle",
  "5": "cascade-idle-orange-pulse",
};

test("Cascade keeps ambient candy life staggered, bounded, and interruptible", async ({ page }) => {
  await page.goto("/cascade.html?player=cascade-idle-pulse-test");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  await expect.poll(() => page.locator(".cascade-tile.is-idle-life").count(), {
    timeout: 4_500,
  }).toBeGreaterThan(0);

  const firstBeat = await page.locator(".cascade-tile.is-idle-life").evaluateAll((tiles) => tiles.map((tile) => ({
    kind: tile.dataset.kind,
    animationName: getComputedStyle(tile).animationName,
    filter: getComputedStyle(tile).filter,
  })));

  expect(firstBeat.length).toBeGreaterThan(0);
  expect(firstBeat.length).toBeLessThanOrEqual(2);
  firstBeat.forEach(({ kind, animationName, filter }) => {
    expect(animationName).toContain(PERSONALITY_BY_KIND[kind]);
    expect(filter).toBe("none");
  });

  // Resting candy remains unpromoted; only the short scheduled beat owns an
  // animation timeline. This is the primary performance guardrail.
  const restingWillChange = await page.locator(".cascade-tile:not(.is-idle-life)").first()
    .evaluate((tile) => getComputedStyle(tile).willChange);
  expect(restingWillChange).toBe("auto");

  await expect.poll(() => page.locator(".cascade-tile.is-idle-life").count(), {
    timeout: 7_000,
  }).toBe(2);

  const density = await page.locator(".cascade-tile").evaluateAll((tiles) => {
    const active = tiles.filter((tile) => tile.classList.contains("is-idle-life"));
    const byKind = new Map();
    for (const tile of tiles) {
      const kind = tile.dataset.kind;
      byKind.set(kind, (byKind.get(kind) || 0) + 1);
    }
    return {
      activeCount: active.length,
      wholeFamilyAnimated: active.some((tile) => {
        const kind = tile.dataset.kind;
        return active.filter((candidate) => candidate.dataset.kind === kind).length === byKind.get(kind);
      }),
    };
  });

  expect(density.activeCount).toBe(2);
  expect(density.wholeFamilyAnimated).toBe(false);

  const activeTile = page.locator(".cascade-tile.is-idle-life").first();
  const box = await activeTile.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.locator(".cascade-tile.is-idle-life")).toHaveCount(0);
  await expect(page.locator(".cascade-board-wrap")).not.toHaveClass(/is-idle-attract/);
  await expect(page.locator(".cascade-status")).not.toHaveClass(/is-idle-attract/);
  await page.mouse.up();

  // Input owns the board for a real grace period. Ambient transforms must not
  // spring back while drag/swap/cascade presentation is still settling.
  await page.waitForTimeout(1_100);
  await expect(page.locator(".cascade-tile.is-idle-life")).toHaveCount(0);

  await expect.poll(async () => page.locator(".cascade-tile").evaluateAll((tiles) => tiles
    .filter((tile) => getComputedStyle(tile).animationName !== "none").length), {
    timeout: 2_000,
  }).toBeLessThanOrEqual(2);
});

test("Cascade deep idle adds a brief cabinet attract cue without waking the whole board", async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto("/cascade.html?player=cascade-idle-attract-test");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  await expect(page.locator(".cascade-board-wrap")).toHaveClass(/is-idle-attract/, {
    timeout: 9_500,
  });
  await expect(page.locator(".cascade-status")).toHaveClass(/is-idle-attract/);

  const animatedTiles = await page.locator(".cascade-tile").evaluateAll((tiles) => tiles
    .filter((tile) => getComputedStyle(tile).animationName !== "none").length);
  expect(animatedTiles).toBeLessThanOrEqual(2);

  await page.mouse.down(20, 20);
  await expect(page.locator(".cascade-board-wrap")).not.toHaveClass(/is-idle-attract/);
  await expect(page.locator(".cascade-status")).not.toHaveClass(/is-idle-attract/);
  await page.mouse.up();
});
