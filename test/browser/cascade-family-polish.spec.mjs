import { expect, test } from "@playwright/test";

const stateKey = "scribbles-gameframe.cascade-state:v1";
const activeRunKey = "scribbles-gameframe.cascade-active-run:v1";
const lifeQueueKey = "scribbles-gameframe.cascade-life-queue:v1";
const blitzReturnKey = "scribbles-gameframe.cascade-blitz-return:v1";

async function installState(page, { level = 6, lives = 5, lastLifeAt = Date.now(), streak = 0, hammers = 2 } = {}) {
  await page.addInitScript(({ key, state }) => {
    localStorage.setItem(key, JSON.stringify(state));
  }, {
    key: stateKey,
    state: { level, lives, lastLifeAt, streak, hammers },
  });
}

async function expectFourLivesAfterSafeReload(page) {
  // Life UI deliberately reloads a settled level when a queued life becomes ready.
  // Locator assertions survive that navigation; page.evaluate polling does not.
  // A legal move can generate a long cascade/presentation chain on a busy CI
  // runner, so keep this bounded but allow the full committed move to settle.
  await expect(page.locator("#lives")).toHaveText("♥♥♥♥", { timeout: 12_000 });
  expect(await page.evaluate((key) => Number(JSON.parse(localStorage.getItem(key))?.lives || 0), stateKey)).toBe(4);
}

async function showSyntheticBlitzComplete(page) {
  await page.evaluate(() => {
    const dialog = document.querySelector("#result-dialog");
    document.querySelector("#result-kicker").textContent = "BLITZ COMPLETE";
    document.querySelector("#result-title").textContent = "Test complete";
    const actions = document.querySelector("#result-actions");
    actions.replaceChildren();
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Continue";
    actions.append(button);
    if (!dialog.open) dialog.showModal();
  });
}

test("Cascade preserves an already-running life timer when another life is lost", async ({ page }) => {
  const startedAt = Date.now() - (5 * 60 * 1000);
  await installState(page, { level: 7, lives: 4, lastLifeAt: startedAt });
  await page.goto("/cascade.html");

  const result = await page.evaluate(({ stateKey, lifeQueueKey }) => {
    const before = JSON.parse(localStorage.getItem(stateKey));
    localStorage.setItem(stateKey, JSON.stringify({
      ...before,
      lives: before.lives - 1,
      lastLifeAt: Date.now(),
    }));
    const after = JSON.parse(localStorage.getItem(stateKey));
    return {
      before: before.lastLifeAt,
      after: after.lastLifeAt,
      queue: Number(localStorage.getItem(lifeQueueKey)),
    };
  }, { stateKey, lifeQueueKey });

  expect(result.after).toBe(result.before);
  expect(result.queue).toBe(result.before);
});

test("Cascade restores a partial life while the page remains open", async ({ page }) => {
  await installState(page, {
    level: 9,
    lives: 3,
    lastLifeAt: Date.now() - (10 * 60 * 1000) + 1_500,
  });
  await page.goto("/cascade.html");

  await expectFourLivesAfterSafeReload(page);
  await expect(page.locator("#level-number")).toHaveText("9");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
});

test("Cascade applies a ready life even when a harmless first tile is selected", async ({ page }) => {
  await installState(page, { level: 9, lives: 3, lastLifeAt: Date.now() });
  await page.goto("/cascade.html");
  await page.locator('.cascade-tile[data-index="0"]').click();
  await expect(page.locator('.cascade-tile[data-index="0"]')).toHaveClass(/is-selected/);

  await page.evaluate((key) => {
    localStorage.setItem(key, String(Date.now() - (10 * 60 * 1000) - 100));
  }, lifeQueueKey);

  await expectFourLivesAfterSafeReload(page);
  await expect(page.locator("#level-number")).toHaveText("9");
});

test("Cascade waits for an in-flight move to commit before applying a ready life", async ({ page }) => {
  await installState(page, { level: 9, lives: 3, lastLifeAt: Date.now() });
  await page.goto("/cascade.html");

  const move = await page.evaluate(async () => {
    const { listLegalMoves } = await import("/cascade-engine.js");
    const state = window.cascadeResearch.exportLevel();
    return { ...listLegalMoves(state.board)[0], movesBefore: state.movesRemaining };
  });
  expect(move.from).toBeGreaterThanOrEqual(0);
  expect(move.to).toBeGreaterThanOrEqual(0);

  await page.locator(`.cascade-tile[data-index="${move.from}"]`).click();
  await page.locator(`.cascade-tile[data-index="${move.to}"]`).click();
  await page.evaluate((key) => {
    localStorage.setItem(key, String(Date.now() - (10 * 60 * 1000) - 100));
    document.body.classList.toggle("cascade-test-life-tick");
  }, lifeQueueKey);

  await page.waitForTimeout(120);
  expect(await page.evaluate(() => window.cascadeResearch.exportLevel().movesRemaining)).toBe(move.movesBefore - 1);

  await expectFourLivesAfterSafeReload(page);
  expect(await page.evaluate(() => window.cascadeResearch.exportLevel().movesRemaining)).toBe(move.movesBefore - 1);
});

test("Cascade Weekly Blitz preserves the normal board underneath it", async ({ page }) => {
  await installState(page, { level: 7, lives: 5 });
  await page.goto("/cascade.html");
  await expect.poll(() => page.evaluate(() => Boolean(window.cascadeBonusModes))).toBe(true);

  const before = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), activeRunKey);
  expect(before?.level).toBe(7);

  await page.locator("[data-weekly-start]").click();
  await expect(page.locator("body")).toHaveClass(/cascade-blitz-mode/);
  await expect.poll(
    () => page.evaluate((key) => sessionStorage.getItem(key), blitzReturnKey),
  ).not.toBeNull();

  await showSyntheticBlitzComplete(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator("#level-number")).toHaveText("7");
  await expect.poll(
    () => page.evaluate((key) => sessionStorage.getItem(key), blitzReturnKey),
  ).toBeNull();

  const after = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), activeRunKey);
  expect(after?.level).toBe(before.level);
  expect(after?.board).toEqual(before.board);
  expect(after?.specials).toEqual(before.specials);
  expect(after?.score).toBe(before.score);
  expect(after?.movesRemaining).toBe(before.movesRemaining);
});

test("Cascade waits for Weekly Blitz score submission before restoring the normal board", async ({ page }) => {
  await installState(page, { level: 7, lives: 5 });
  await page.goto("/cascade.html");
  await expect.poll(() => page.evaluate(() => Boolean(window.cascadeBonusModes))).toBe(true);

  await page.locator("[data-weekly-start]").click();
  await expect(page.locator("body")).toHaveClass(/cascade-blitz-mode/);
  await page.evaluate(() => {
    document.querySelector("[data-weekly-status]").textContent = "Saving weekly score…";
  });
  await showSyntheticBlitzComplete(page);

  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saving score…", exact: true })).toBeDisabled();
  await page.waitForTimeout(100);
  await expect(page.locator("body")).toHaveClass(/cascade-blitz-mode/);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), blitzReturnKey)).not.toBeNull();

  await page.evaluate(() => {
    document.querySelector("[data-weekly-status]").textContent = "New weekly best saved.";
  });
  await expect(page.locator("#level-number")).toHaveText("7", { timeout: 4_000 });
  await expect.poll(
    () => page.evaluate((key) => sessionStorage.getItem(key), blitzReturnKey),
  ).toBeNull();
});

test("Cascade bounds a stalled Weekly score save and restores the normal board", async ({ page }) => {
  await installState(page, { level: 7, lives: 5 });
  await page.goto("/cascade.html");
  await expect.poll(() => page.evaluate(() => Boolean(window.cascadeBonusModes))).toBe(true);

  await page.locator("[data-weekly-start]").click();
  await page.evaluate(() => {
    document.querySelector("[data-weekly-status]").textContent = "Saving weekly score…";
  });
  await showSyntheticBlitzComplete(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(page.locator("#level-number")).toHaveText("7", { timeout: 6_500 });
  await expect.poll(
    () => page.evaluate((key) => sessionStorage.getItem(key), blitzReturnKey),
  ).toBeNull();
});

test("Cascade bonus play remains available at zero lives", async ({ page }) => {
  await installState(page, { level: 12, lives: 0, lastLifeAt: Date.now() });
  await page.goto("/cascade.html");

  await expect(page.locator("#life-lock")).toBeVisible();
  await expect(page.locator(".cascade-tile").first()).toBeDisabled();
  await page.locator("[data-weekly-start]").click();
  await expect(page.locator("body")).toHaveClass(/cascade-blitz-mode/);
  await expect(page.locator("#life-lock")).toBeHidden();
  await expect(page.locator(".cascade-tile").first()).toBeEnabled();
  await expect(page.locator("#booster-hammer")).toBeDisabled();
});

test("Cascade terminal dialogs cannot be dismissed into a locked board with Escape", async ({ page }) => {
  await installState(page, { level: 8, lives: 5, hammers: 0 });
  await page.goto("/cascade.html");

  await page.locator("#booster-hammer").click();
  await expect(page.locator("#result-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#result-dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Got it" })).toBeVisible();
});

test("Cascade hammer arming is explicit and does not spend inventory until a target is chosen", async ({ page }) => {
  await installState(page, { level: 8, lives: 5, hammers: 2 });
  await page.goto("/cascade.html");

  await page.locator("#booster-hammer").click();
  await expect(page.locator(".cascade-tile.is-hammer-target")).toHaveCount(64);
  await expect(page.locator("#hammer-count")).toHaveText("2");
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).hammers, stateKey)).toBe(2);
});

test("Cascade family-facing settings and Weekly Blitz copy avoid developer terminology", async ({ page }) => {
  await installState(page, { level: 6, lives: 5 });
  await page.goto("/cascade.html");

  await expect(page.locator("#cascade-feedback-card > small")).toHaveText("SETTINGS");
  await expect(page.locator("[data-weekly-copy]")).toContainText("everyone gets the same board this week");
  await expect(page.locator("[data-weekly-copy]")).not.toContainText(/seed/i);
  await expect.poll(() => page.evaluate(() => Boolean(window.cascadeFamilyPolish))).toBe(true);
});
