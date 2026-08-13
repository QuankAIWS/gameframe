import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";
const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const PERFORMANCE_KEY = "scribbles-gameframe.cascade-performance:v1";
const TUTORIAL_KEY = "scribbles-gameframe.cascade-tutorial:v1";

test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
});

test("Cascade next-level refresh transition stays inside the game visual language", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(({ stateKey, performanceKey, tutorialKey }) => {
    localStorage.setItem(stateKey, JSON.stringify({
      level: 6,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 1,
      hammers: 2,
    }));
    localStorage.setItem(performanceKey, JSON.stringify({
      starsByLevel: { "5": 3 },
      blitzBest: {},
      blitzStars: {},
      blitzSeen: { "after-5": true },
      pendingHammerRewards: 0,
    }));
    localStorage.setItem(tutorialKey, JSON.stringify({ enabled: false, seen: {} }));
  }, { stateKey: STATE_KEY, performanceKey: PERFORMANCE_KEY, tutorialKey: TUTORIAL_KEY });

  await page.goto("/cascade.html");
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("gameframe:build-refresh", {
      detail: { loadedBuildId: "a", currentBuildId: "b", pendingBuildId: "b" },
    }));
  });
  await expect(page.locator("#cascade-build-refresh-curtain")).toBeVisible();
  await page.screenshot({
    path: `${output}/cascade-build-refresh-desktop.png`,
    fullPage: true,
  });
});
