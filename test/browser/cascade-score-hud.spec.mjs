import { expect, test } from "@playwright/test";

const stateKey = "scribbles-gameframe.cascade-state:v1";

async function prepare(page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({
      level: 58,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 4,
      hammers: 2,
    }));
  }, stateKey);
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto("/cascade.html?player=cascade-score-hud-test");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
}

test("Cascade score reel counts upward and the life tray always keeps five visible slots", async ({ page }) => {
  await prepare(page);

  const score = page.locator("#score");
  const scoreVisual = page.locator("#score > .cascade-score-value");
  const lives = page.locator("#lives");
  const lifeSlots = page.locator("#lives > .cascade-life-heart");

  await expect(scoreVisual).toHaveText("0");
  await expect(lifeSlots).toHaveCount(5);
  await expect(page.locator("#lives > .cascade-life-heart.is-full")).toHaveCount(5);
  await expect(lives).toHaveAttribute("aria-label", "5 of 5 lives");

  const livesBox = await lives.boundingBox();
  expect(livesBox).toBeTruthy();
  for (const slot of await lifeSlots.all()) {
    const box = await slot.boundingBox();
    expect(box).toBeTruthy();
    expect(box.x).toBeGreaterThanOrEqual(livesBox.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(livesBox.x + livesBox.width + 1);
  }

  await page.evaluate(() => {
    document.querySelector("#score").textContent = "1,250";
  });
  await expect(score).toHaveAttribute("data-score-target", "1250");
  await expect(score).toHaveClass(/is-counting/);
  await page.waitForTimeout(120);
  const midScore = Number((await scoreVisual.textContent()).replaceAll(",", ""));
  expect(midScore).toBeGreaterThan(0);
  expect(midScore).toBeLessThan(1250);
  await expect(scoreVisual).toHaveText("1,250", { timeout: 1500 });
  await expect(score).not.toHaveClass(/is-counting/);

  const stats = await page.evaluate(() => window.cascadeHudPolish.getStats());
  expect(stats.scoreTargetValue).toBe(1250);
  expect(stats.scoreVisualValue).toBe(1250);
  expect(stats.scorePaints).toBeGreaterThan(3);
  expect(stats.lifeSlots).toBe(5);

  await page.evaluate(() => {
    document.querySelector("#lives").textContent = "♥♥♥";
  });
  await expect(lifeSlots).toHaveCount(5);
  await expect(page.locator("#lives > .cascade-life-heart.is-full")).toHaveCount(3);
  await expect(page.locator("#lives > .cascade-life-heart.is-empty")).toHaveCount(2);
  await expect(lives).toHaveAttribute("aria-label", "3 of 5 lives");
});
