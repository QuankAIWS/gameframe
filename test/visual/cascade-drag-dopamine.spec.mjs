import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";

test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
});

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

test("Cascade drag pickup visibly follows the pointer", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/cascade.html?player=cascade-drag-visual");
  const move = await firstLegalMove(page);
  expect(move).toBeTruthy();
  const from = page.locator(`.cascade-tile[data-index="${move.from}"]`);
  const to = page.locator(`.cascade-tile[data-index="${move.to}"]`);
  const start = await center(from);
  const end = await center(to);

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + (end.x - start.x) * .72, start.y + (end.y - start.y) * .72, { steps: 5 });
  await expect(page.locator(".cascade-drag-ghost")).toBeVisible();
  await expect(to).toHaveClass(/is-drag-target/);
  await page.screenshot({ path: `${output}/cascade-drag-pickup-desktop.png`, fullPage: true });
  await page.mouse.up();
});

test("Cascade amplified reward burst escapes the board", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/cascade.html?player=cascade-vfx-visual");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  await page.evaluate(() => window.cascadeDopamineVfx.demo(3));
  await page.waitForTimeout(320);
  await expect(page.locator(".cascade-dopamine-canvas")).toBeVisible();
  await page.screenshot({ path: `${output}/cascade-dopamine-burst-desktop.png`, fullPage: true });
});
