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
  "memory-bloom": true,
  butterfly: true,
  drop: true,
  cage: true,
  "recall-lock": true,
  "enchanted-ground": true,
  "crystal-forge": true,
  "color-ward": true,
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
  await expect(page.locator("#cascade-help-toggle")).toBeVisible();

  await dialog.locator("[data-tutorial-disable]").check();
  await dialog.locator("[data-tutorial-continue]").click();
  await expect(dialog).not.toBeVisible();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), TUTORIAL_KEY);
  expect(saved.enabled).toBe(false);
  expect(saved.seen.match).toBe(true);

  await page.reload();
  await page.waitForTimeout(700);
  await expect(page.locator("#cascade-tutorial-dialog")).not.toBeVisible();
  await page.locator("#cascade-help-toggle").click();
  const help = page.locator("#cascade-context-help-dialog");
  await expect(help).toBeVisible();
  await expect(help.locator("[data-context-help-auto]")).not.toBeChecked();
  await help.locator("[data-context-help-close]").last().click();
});

test("Cascade does not gate the striped special to level two and keeps the live-tile tutorial visual", async ({ page }) => {
  await page.addInitScript(({ tutorialKey, stateKey }) => {
    localStorage.setItem(tutorialKey, JSON.stringify({ enabled: true, seen: { match: true } }));
    localStorage.setItem(stateKey, JSON.stringify({ level: 2, lives: 5, lastLifeAt: Date.now(), streak: 0, hammers: 2 }));
  }, { tutorialKey: TUTORIAL_KEY, stateKey: STATE_KEY });

  await page.goto("/cascade.html?player=tutorial-stripe&tutorials=force");
  await expect(page.locator("#level-number")).toHaveText("2");
  const dialog = page.locator("#cascade-tutorial-dialog");
  await page.waitForTimeout(500);
  await expect(dialog).not.toBeVisible();

  // Discovery behavior is covered by cascade-replay-discovery.spec.mjs. Here
  // retain the visual contract without reintroducing fixed-level gating.
  await page.evaluate(() => window.cascadeTutorial.show("stripe"));
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-tutorial-kicker]")).toHaveText("NEW SPECIAL");
  await expect(dialog.locator("[data-tutorial-title]")).toHaveText("Four in a row makes a stripe.");
  await expect(dialog.locator('.cascade-tutorial-game-tile[data-special="stripe-h"] .cascade-special-mark')).toHaveCount(1);
  await expect(dialog.locator('.cascade-tutorial-game-tile[data-kind="0"]')).toHaveCount(5);
  await dialog.locator("[data-tutorial-continue]").click();
  await expect(dialog).not.toBeVisible();

  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}").seen?.stripe, TUTORIAL_KEY)).toBe(true);
});

test("Memory Bloom tutorial appears on first Bloom encounter and explains the interaction", async ({ page }) => {
  await page.addInitScript(({ tutorialKey, stateKey }) => {
    localStorage.setItem(tutorialKey, JSON.stringify({
      enabled: true,
      seen: {
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
      },
    }));
    localStorage.setItem(stateKey, JSON.stringify({ level: 753, lives: 5, lastLifeAt: Date.now(), streak: 0, hammers: 2 }));
  }, { tutorialKey: TUTORIAL_KEY, stateKey: STATE_KEY });

  await page.goto("/cascade.html?player=tutorial-memory-bloom&tutorials=force");
  await expect(page.locator("#level-number")).toHaveText("753");
  const dialog = page.locator("#cascade-tutorial-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("data-tutorial", "memory-bloom");
  await expect(dialog.locator("[data-tutorial-title]")).toHaveText("Reveal one flower, then find its match.");
  await expect(dialog.locator("[data-tutorial-copy]")).toContainText("directly beside a closed flower");
  await expect(dialog.locator(".cascade-tutorial-game-tile.has-memory-bloom")).toHaveCount(2);
  await expect(dialog.locator(".cascade-bloom-mark.is-revealed")).toHaveCount(1);
  await expect(dialog.locator(".cascade-bloom-mark:not(.is-revealed)")).not.toHaveAttribute("data-bloom-symbol", /.+/);
  await dialog.locator("[data-tutorial-continue]").click();
  await expect(dialog).not.toBeVisible();
});

test("manual Help explains the current level even when automatic tips are off", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(({ tutorialKey, stateKey }) => {
    localStorage.setItem(tutorialKey, JSON.stringify({ enabled: false, seen: { "memory-bloom": true } }));
    localStorage.setItem(stateKey, JSON.stringify({ level: 753, lives: 5, lastLifeAt: Date.now(), streak: 0, hammers: 2 }));
  }, { tutorialKey: TUTORIAL_KEY, stateKey: STATE_KEY });

  await page.goto("/cascade.html?player=context-help-off&tutorials=force");
  await expect(page.locator("#cascade-tutorial-dialog")).not.toBeVisible();
  await expect(page.locator("#cascade-mobile-help-toggle")).toBeVisible();
  await page.locator("#cascade-mobile-help-toggle").click();

  const help = page.locator("#cascade-context-help-dialog");
  await expect(help).toBeVisible();
  await expect(help.locator("[data-context-help-kicker]")).toHaveText("LEVEL 753 HELP");
  await expect(help.locator('[data-context-help-current] [data-context-help-item="memory-bloom"]')).toHaveCount(1);
  await expect(help.locator("[data-context-help-auto]")).not.toBeChecked();
  await expect(help.locator(".cascade-context-help-basics")).not.toHaveAttribute("open", "");
  await help.locator("[data-context-help-close]").last().click();
  await expect(help).not.toBeVisible();
  await expect(page.locator("#cascade-tutorial-dialog")).not.toBeVisible();
});

test("context Help stays unavailable during the timed Weekly Blitz", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(({ tutorialKey, stateKey, seenTips }) => {
    localStorage.setItem(tutorialKey, JSON.stringify({ enabled: true, seen: seenTips }));
    localStorage.setItem(stateKey, JSON.stringify({ level: 18, lives: 5, lastLifeAt: Date.now(), streak: 0, hammers: 2 }));
  }, { tutorialKey: TUTORIAL_KEY, stateKey: STATE_KEY, seenTips: ALL_SEEN });

  await page.goto("/cascade.html?player=context-help-blitz&tutorials=force");
  await page.waitForFunction(() => Boolean(window.cascadeResearch?.startBlitz && window.cascadeTutorial?.openHelp));
  await page.evaluate(() => window.cascadeResearch.startBlitz(5));
  await expect(page.locator("body")).toHaveClass(/cascade-blitz-mode/);

  await expect(page.locator("#cascade-help-toggle")).toBeDisabled();
  await expect(page.locator("#cascade-mobile-help-toggle")).toBeDisabled();
  await expect(page.locator("#cascade-mobile-help-toggle")).toHaveAttribute("title", /available after this timed Blitz/i);

  const opened = await page.evaluate(() => window.cascadeTutorial.openHelp());
  expect(opened).toBe(false);
  await expect(page.locator("#cascade-context-help-dialog")).toHaveCount(0);
});

test("context Help shows every special objective on a mixed level", async ({ page }) => {
  await page.addInitScript(({ tutorialKey, stateKey, seenTips }) => {
    localStorage.setItem(tutorialKey, JSON.stringify({ enabled: true, seen: seenTips }));
    localStorage.setItem(stateKey, JSON.stringify({ level: 851, lives: 5, lastLifeAt: Date.now(), streak: 0, hammers: 2 }));
  }, { tutorialKey: TUTORIAL_KEY, stateKey: STATE_KEY, seenTips: ALL_SEEN });

  await page.goto("/cascade.html?player=context-help-mixed&tutorials=force");
  await page.waitForFunction(() => Boolean(window.cascadeTutorial));
  expect(await page.evaluate(() => window.cascadeTutorial.currentHelpIds())).toEqual(["memory-bloom", "enchanted-ground"]);

  await page.locator("#cascade-help-toggle").click();
  const current = page.locator("#cascade-context-help-dialog [data-context-help-current]");
  await expect(current.locator('[data-context-help-item="memory-bloom"]')).toHaveCount(1);
  await expect(current.locator('[data-context-help-item="enchanted-ground"]')).toHaveCount(1);
  await expect(current.locator("[data-context-help-item]")).toHaveCount(2);
});

test("turning automatic tips back on from Help queues the current mechanic reminder", async ({ page }) => {
  await page.addInitScript(({ tutorialKey, stateKey }) => {
    localStorage.setItem(tutorialKey, JSON.stringify({ enabled: false, seen: {} }));
    localStorage.setItem(stateKey, JSON.stringify({ level: 753, lives: 5, lastLifeAt: Date.now(), streak: 0, hammers: 2 }));
  }, { tutorialKey: TUTORIAL_KEY, stateKey: STATE_KEY });

  await page.goto("/cascade.html?player=context-help-reenable&tutorials=force");
  await page.locator("#cascade-help-toggle").click();
  const help = page.locator("#cascade-context-help-dialog");
  await help.locator("[data-context-help-auto]").check();
  await help.locator("[data-context-help-close]").last().click();

  const tip = page.locator("#cascade-tutorial-dialog");
  await expect(tip).toBeVisible();
  await expect(tip).toHaveAttribute("data-tutorial", "memory-bloom");
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
    ["memory-bloom", ".cascade-tutorial-game-tile.has-memory-bloom .cascade-bloom-mark.is-revealed"],
    ["butterfly", '.cascade-tutorial-game-tile[data-special="fish"] .cascade-special-mark'],
    ["drop", ".cascade-tutorial-game-tile.has-drop-object .cascade-drop-object"],
    ["cage", ".cascade-tutorial-game-tile.has-cage .cascade-lock-mark"],
    ["recall-lock", ".cascade-tutorial-game-tile.has-recall-lock .cascade-lock-mark.is-revealed"],
    ["enchanted-ground", ".cascade-tutorial-game-tile.has-enchanted-ground .cascade-ground-mark"],
    ["crystal-forge", ".cascade-tutorial-game-tile.has-producer .cascade-producer-mark"],
    ["color-ward", ".cascade-tutorial-game-tile.has-color-ward .cascade-color-ward-mark"],
  ];

  for (const [id, selector] of cases) {
    await page.evaluate((tip) => window.cascadeTutorial.show(tip), id);
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("data-tutorial", id);
    const expectedCount = id === "match" ? 3 : id === "collect" || id === "crystal-forge" ? 2 : 1;
    await expect(dialog.locator(selector)).toHaveCount(expectedCount);
    await expect(dialog.locator(".cascade-tutorial-mini-tile")).toHaveCount(0);
    await dialog.locator("[data-tutorial-continue]").click();
    await expect(dialog).not.toBeVisible();
  }
});
