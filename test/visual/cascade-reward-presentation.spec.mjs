import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";
const stateKey = "scribbles-gameframe.cascade-state:v1";
const soundKey = "scribbles-gameframe.cascade-sound:v1";
const effectsKey = "scribbles-gameframe.cascade-effects:v1";

test("Cascade reward cash-out stays legible inside a zoomed TV board", async ({ page }) => {
  await mkdir(output, { recursive: true });
  await page.addInitScript(({ stateKey: key, soundKey: audioKey, effectsKey: fxKey }) => {
    localStorage.setItem(audioKey, "off");
    localStorage.setItem(fxKey, "full");
    localStorage.setItem(key, JSON.stringify({
      level: 5,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 3,
      hammers: 2,
    }));
  }, { stateKey, soundKey, effectsKey });

  // Approximate a 1920×1080 television viewed at 200% browser zoom.
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto("/cascade.html");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  await page.evaluate(() => {
    window.__cascadeRewardVisual = window.cascadePresentationDirector.demoWin({
      moves: 7,
      scoreBeforeBonus: 4_250,
      scoreAfterBonus: 4_950,
      stars: 3,
      reward: { claimed: 1 },
    });
  });

  const stage = page.locator(".cascade-reward-stage");
  const panel = page.locator(".cascade-reward-panel");
  await expect(stage).toHaveClass(/is-active/);
  await expect(stage.locator(".cascade-reward-stars i.is-earned")).toHaveCount(2, { timeout: 5_000 });
  await expect(stage.locator(".cascade-reward-title")).toHaveText("Crushed it.");
  await expect(stage.locator(".cascade-reward-cashout")).toContainText("UNUSED MOVES");

  const geometry = await page.evaluate(() => {
    const stage = document.querySelector(".cascade-reward-stage")?.getBoundingClientRect();
    const panel = document.querySelector(".cascade-reward-panel")?.getBoundingClientRect();
    const boardWrap = document.querySelector(".cascade-board-wrap")?.getBoundingClientRect();
    if (!stage || !panel || !boardWrap) return null;
    return {
      panelInsideStage: panel.left >= stage.left - 1 && panel.right <= stage.right + 1 && panel.top >= stage.top - 1 && panel.bottom <= stage.bottom + 1,
      stageInsideBoard: stage.left >= boardWrap.left - 1 && stage.right <= boardWrap.right + 1 && stage.top >= boardWrap.top - 1 && stage.bottom <= boardWrap.bottom + 1,
      panelBottom: panel.bottom,
      viewportHeight: window.innerHeight,
    };
  });
  expect(geometry).toBeTruthy();
  expect(geometry.panelInsideStage).toBe(true);
  expect(geometry.stageInsideBoard).toBe(true);
  expect(geometry.panelBottom).toBeLessThanOrEqual(geometry.viewportHeight);

  await page.screenshot({ path: `${output}/cascade-reward-sequence-tv-zoom.png`, fullPage: true });
  await page.evaluate(() => window.__cascadeRewardVisual);
});
