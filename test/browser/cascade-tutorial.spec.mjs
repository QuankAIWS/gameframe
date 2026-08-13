import { expect, test } from "@playwright/test";

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

function cascadeState(level = 1) {
  return {
    level,
    lives: 5,
    lastLifeAt: Date.now(),
    streak: 0,
    hammers: 2,
  };
}

test("Cascade shows a themed first tip once and the checkbox disables future tips", async ({ page }) => {
  await page.goto("/cascade.html?player=tutorial-first&tutorials=force");

  const dialog = page.locator("#cascade-tutorial-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-tutorial-kicker]")).toHaveText("FIRST MOVE");
  await expect(dialog.locator("[data-tutorial-title]")).toHaveText("Match 3 to make them pop.");
  await expect(dialog.locator(".cascade-tutorial-visual.is-match")).toBeVisible();
  await expect(dialog.locator('.cascade-tutorial-game-tile[data-kind="1"]')).toHaveCount(3);
  await expect(dialog.locator(".cascade-tutorial-mini-tile")).toHaveCount(0);
  await expect(page.locator("#cascade-tutorial-toggle")).toHaveAttribute("aria-pressed", "true");

  await dialog.locator("[data-tutorial-disable]").check();
  await dialog.locator("[data-tutorial-continue]").click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("#cascade-tutorial-toggle")).toHaveText(/Tutorial tips off/);

  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), TUTORIAL_KEY);
  expect(saved.enabled).toBe(false);
  expect(saved.seen.match).toBe(true);

  await page.reload();
  await page.waitForTimeout(700);
  await expect(page.locator("#cascade-tutorial-dialog")).not.toBeVisible();
  await expect(page.locator("#cascade-tutorial-toggle")).toHaveAttribute("aria-pressed", "false");
});

test("Cascade introduces the striped special with the same tile and special mark used on the board", async ({ page }) => {
  await page.addInitScript(({ tutorialKey, stateKey }) => {
    localStorage.setItem(tutorialKey, JSON.stringify({ enabled: true, seen: { match: true } }));
    localStorage.setItem(stateKey, JSON.stringify({ level: 2, lives: 5, lastLifeAt: Date.now(), streak: 0, hammers: 2 }));
  }, { tutorialKey: TUTORIAL_KEY, stateKey: STATE_KEY });

  await page.goto("/cascade.html?player=tutorial-stripe&tutorials=force");
  await expect(page.locator("#level-number")).toHaveText("2");
  const dialog = page.locator("#cascade-tutorial-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-tutorial-kicker]")).toHaveText("NEW SPECIAL");
  await expect(dialog.locator("[data-tutorial-title]")).toHaveText("Four in a row makes a stripe.");
  await expect(dialog.locator('.cascade-tutorial-game-tile[data-special="stripe-h"] .cascade-special-mark')).toHaveCount(1);
  await expect(dialog.locator('.cascade-tutorial-game-tile[data-kind="0"]')).toHaveCount(5);
  await dialog.locator("[data-tutorial-continue]").click();
  await expect(dialog).not.toBeVisible();

  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}").seen?.stripe, TUTORIAL_KEY)).toBe(true);
});

test("Hammer tutorial appears before the booster arms, then resumes the click", async ({ page }) => {
  await page.addInitScript(({ tutorialKey, stateKey }) => {
    localStorage.setItem(tutorialKey, JSON.stringify({ enabled: true, seen: { match: true } }));
    localStorage.setItem(stateKey, JSON.stringify({ level: 1, lives: 5, lastLifeAt: Date.now(), streak: 0, hammers: 2 }));
  }, { tutorialKey: TUTORIAL_KEY, stateKey: STATE_KEY });

  await page.goto("/cascade.html?player=tutorial-hammer&tutorials=force");
  await page.waitForTimeout(500);
  await expect(page.locator("#cascade-tutorial-dialog")).not.toBeVisible();
  await page.locator("#booster-hammer").click();

  const dialog = page.locator("#cascade-tutorial-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-tutorial-title]")).toHaveText("The Hammer breaks one tile free.");
  await expect(dialog.locator(".cascade-tutorial-hammer-card.cascade-card button")).toContainText("Hammer");
  await expect(dialog.locator(".cascade-tutorial-game-tile.is-selected")).toHaveCount(1);
  await expect(page.locator("#board .cascade-tile.is-hammer-target")).toHaveCount(0);

  await dialog.locator("[data-tutorial-continue]").click();
  await expect(page.locator("#board .cascade-tile.is-hammer-target")).toHaveCount(64);
});

test("Weekly Blitz tutorial appears before its timer starts, then resumes play", async ({ page }) => {
  await page.addInitScript(({ tutorialKey, stateKey }) => {
    localStorage.setItem(tutorialKey, JSON.stringify({ enabled: true, seen: { match: true, hammer: true } }));
    localStorage.setItem(stateKey, JSON.stringify({ level: 1, lives: 5, lastLifeAt: Date.now(), streak: 0, hammers: 2 }));
  }, { tutorialKey: TUTORIAL_KEY, stateKey: STATE_KEY });

  await page.goto("/cascade.html?player=tutorial-weekly&tutorials=force");
  await page.waitForTimeout(500);
  const weekly = page.locator("[data-weekly-start]");
  await expect(weekly).toBeVisible();
  await weekly.click();

  const dialog = page.locator("#cascade-tutorial-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-tutorial-title]")).toHaveText("Weekly Blitz is 30 seconds flat.");
  await expect(dialog.locator(".cascade-tutorial-weekly-card.cascade-weekly-card button")).toContainText("30s");
  await expect(page.locator("#blitz-overlay")).toBeHidden();

  await dialog.locator("[data-tutorial-continue]").click();
  await expect(page.locator("#blitz-overlay")).toBeVisible();
  await expect(page.locator("#blitz-clock")).toContainText(/^(30|29)$/);
});

test("every Cascade tutorial preview is built from live game tiles or live game cards", async ({ page }) => {
  await page.addInitScript(({ tutorialKey, stateKey, seenTips }) => {
    localStorage.setItem(tutorialKey, JSON.stringify({ enabled: true, seen: seenTips }));
    localStorage.setItem(stateKey, JSON.stringify({ level: 151, lives: 5, lastLifeAt: Date.now(), streak: 0, hammers: 2 }));
  }, { tutorialKey: TUTORIAL_KEY, stateKey: STATE_KEY, seenTips: ALL_SEEN });

  await page.goto("/cascade.html?player=tutorial-art-primitives&tutorials=force");
  await page.waitForFunction(() => Boolean(window.cascadeTutorial));
  const dialog = page.locator("#cascade-tutorial-dialog");
  const cases = [
    ["match", '.cascade-tutorial-game-tile[data-kind="1"]'],
    ["stripe", '.cascade-tutorial-game-tile[data-special="stripe-h"] .cascade-special-mark'],
    ["bomb", '.cascade-tutorial-game-tile[data-special="bomb"] .cascade-special-mark'],
    ["combo", '.cascade-tutorial-game-tile[data-special="stripe-v"] + .cascade-tutorial-game-tile[data-special="bomb"]'],
    ["color", '.cascade-tutorial-game-tile[data-special="color"] .cascade-special-mark'],
    ["ice", ".cascade-tutorial-game-tile.has-ice.ice-1"],
    ["collect", ".cascade-tutorial-collect-item .cascade-tile"],
    ["layered-ice", ".cascade-tutorial-game-tile.has-ice.ice-2"],
    ["hammer", ".cascade-tutorial-hammer-card.cascade-card button"],
    ["weekly", ".cascade-tutorial-weekly-card.cascade-weekly-card button"],
  ];

  for (const [id, selector] of cases) {
    await page.evaluate((tip) => window.cascadeTutorial.show(tip), id);
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("data-tutorial", id);
    await expect(dialog.locator(selector)).toHaveCount(id === "match" ? 3 : id === "collect" ? 2 : 1);
    await expect(dialog.locator(".cascade-tutorial-mini-tile")).toHaveCount(0);
    await dialog.locator("[data-tutorial-continue]").click();
    await expect(dialog).not.toBeVisible();
  }
});
