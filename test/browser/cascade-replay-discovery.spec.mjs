import { expect, test } from "@playwright/test";

const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const PERFORMANCE_KEY = "scribbles-gameframe.cascade-performance:v1";
const TUTORIAL_KEY = "scribbles-gameframe.cascade-tutorial:v1";

async function installProgress(page, { level = 10, stars = { "4": 1 }, tutorialEnabled = false } = {}) {
  await page.addInitScript(({ stateKey, performanceKey, tutorialKey, initialLevel, initialStars, enabled }) => {
    window.localStorage.setItem(stateKey, JSON.stringify({
      level: initialLevel,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 0,
      hammers: 2,
    }));
    window.localStorage.setItem(performanceKey, JSON.stringify({
      starsByLevel: initialStars,
      blitzBest: {},
      blitzStars: {},
      blitzSeen: {},
      pendingHammerRewards: 0,
    }));
    window.localStorage.setItem(tutorialKey, JSON.stringify({ enabled, seen: {} }));
  }, {
    stateKey: STATE_KEY,
    performanceKey: PERFORMANCE_KEY,
    tutorialKey: TUTORIAL_KEY,
    initialLevel: level,
    initialStars: stars,
    enabled: tutorialEnabled,
  });
}

test("Cascade tutorial teaches a special when the special is actually discovered", async ({ page }) => {
  await installProgress(page, { level: 6, stars: {}, tutorialEnabled: true });
  await page.goto("/cascade.html");
  await expect(page.locator("#level-number")).toHaveText("6");
  await expect(page.locator("#cascade-tutorial-dialog")).toHaveCount(0);

  await page.evaluate(() => {
    const tile = document.querySelector("#board .cascade-tile");
    tile.dataset.special = "stripe-h";
    tile.classList.add("has-special");
  });

  const tutorial = page.locator("#cascade-tutorial-dialog");
  await expect(tutorial).toBeVisible({ timeout: 2_000 });
  await expect(tutorial).toHaveAttribute("data-tutorial", "stripe");
  await expect(tutorial.locator("[data-tutorial-title]")).toContainText("Four in a row makes a stripe");
});

test("Cascade can replay a cleared level and return to the saved campaign frontier", async ({ page }) => {
  await installProgress(page, { level: 10, stars: { "4": 1 } });
  await page.goto("/cascade.html");
  await expect(page.locator("#level-number")).toHaveText("10");

  await page.locator('#level-map > li[data-level="4"]').click();
  await expect(page).toHaveURL(/\breplay=4\b/);
  await expect(page.locator("#level-number")).toHaveText("4");
  await expect.poll(() => page.evaluate(() => window.cascadeReplay.frontier())).toBe(10);

  await page.evaluate(() => window.cascadeReplay.finish());
  await expect(page).not.toHaveURL(/\breplay=/);
  await expect(page.locator("#level-number")).toHaveText("10");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("scribbles-gameframe.cascade-state:v1")).level)).toBe(10);
});

test("Cascade repeated frontier failures can suggest improving an older low-star level", async ({ page }) => {
  await installProgress(page, { level: 10, stars: { "4": 1, "8": 2 } });
  await page.goto("/cascade.html");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.evaluate(() => {
      const dialog = document.querySelector("#result-dialog");
      document.querySelector("#result-kicker").textContent = "OUT OF MOVES";
      document.querySelector("#result-actions").replaceChildren();
      dialog.showModal();
    });
    await expect(page.locator("#result-dialog")).toBeVisible();
    if (attempt < 2) {
      await page.evaluate(() => document.querySelector("#result-dialog").close());
    }
  }

  const improvement = page.locator("#result-actions [data-improve-old-level]");
  await expect(improvement).toBeVisible();
  await expect(improvement).toContainText("Improve level 4 (1/3 ★)");
});

test("Cascade victory actions live on the polished reward stage instead of a second generic modal", async ({ page }) => {
  // The active campaign frontier is level 10, so any stored best must belong to
  // an already-cleared level below it. Seeding stars for level 10 would describe
  // a completed level while simultaneously claiming it is still the frontier.
  await installProgress(page, { level: 10, stars: { "9": 2 } });
  await page.goto("/cascade.html");

  await page.evaluate(async () => {
    await window.cascadePresentationDirector.demoWin({ moves: 3, stars: 2 });
    const actions = document.querySelector("#result-actions");
    const continueButton = document.createElement("button");
    continueButton.type = "button";
    continueButton.textContent = "Continue";
    actions.replaceChildren(continueButton);
    document.querySelector("#result-kicker").textContent = "LEVEL COMPLETE";
    document.querySelector("#result-copy").textContent = "Two-star clear.";
    document.querySelector("#result-dialog").showModal();
  });

  await expect(page.locator("#result-dialog")).not.toHaveAttribute("open", "");
  const stage = page.locator(".cascade-reward-stage.is-awaiting-choice");
  await expect(stage).toBeVisible();
  await expect(stage).not.toHaveClass(/is-active/);
  await expect(stage.locator(".cascade-reward-summary")).toHaveCount(0);
  await expect(stage.locator(".cascade-reward-stars i.is-earned")).toHaveCount(2);
  await expect(stage.getByRole("button", { name: "Replay for more stars" })).toBeVisible();
  await expect(stage.getByRole("button", { name: "Continue" })).toBeVisible();
});
