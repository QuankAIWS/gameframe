import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";
const TUTORIAL_KEY = "scribbles-gameframe.cascade-tutorial:v1";
const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const ALL_SEEN = Object.freeze({
  match: true,
  stripe: true,
  bomb: true,
  combo: true,
  color: true,
  ice: true,
  collect: true,
  "layered-ice": true,
  hammer: true,
  weekly: true,
});

async function seed(page, level) {
  await page.addInitScript(({ tutorialKey, stateKey, levelNumber, seenTips }) => {
    localStorage.setItem(tutorialKey, JSON.stringify({ enabled: true, seen: seenTips }));
    localStorage.setItem(stateKey, JSON.stringify({
      level: levelNumber,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 0,
      hammers: 2,
    }));
  }, { tutorialKey: TUTORIAL_KEY, stateKey: STATE_KEY, levelNumber: level, seenTips: ALL_SEEN });
}

const tutorialCases = [
  { id: "match", level: 1, viewport: { width: 1100, height: 800 } },
  { id: "stripe", level: 2, viewport: { width: 1100, height: 800 } },
  { id: "bomb", level: 3, viewport: { width: 1100, height: 800 } },
  { id: "combo", level: 4, viewport: { width: 1100, height: 800 } },
  { id: "color", level: 5, viewport: { width: 1100, height: 800 } },
  { id: "ice", level: 31, viewport: { width: 390, height: 844 } },
  { id: "collect", level: 61, viewport: { width: 390, height: 844 } },
  { id: "layered-ice", level: 151, viewport: { width: 390, height: 844 } },
  { id: "hammer", level: 1, viewport: { width: 1100, height: 800 } },
  { id: "weekly", level: 1, viewport: { width: 390, height: 844 } },
];

test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
});

for (const { id, level, viewport } of tutorialCases) {
  test(`Cascade ${id} tutorial uses the live game art`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await seed(page, level);
    await page.goto(`/cascade.html?player=tutorial-visual-${id}&tutorials=force`);
    await page.waitForFunction(() => Boolean(window.cascadeTutorial));
    await page.evaluate((tip) => window.cascadeTutorial.show(tip), id);

    const dialog = page.locator("#cascade-tutorial-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("data-tutorial", id);
    await expect(dialog.locator(`.cascade-tutorial-visual.is-${id}`)).toBeVisible();
    await expect(dialog.locator(".cascade-tutorial-mini-tile")).toHaveCount(0);
    await page.screenshot({ path: `${output}/cascade-tutorial-${id}-${viewport.width <= 500 ? "mobile" : "desktop"}.png`, fullPage: false });
  });
}
