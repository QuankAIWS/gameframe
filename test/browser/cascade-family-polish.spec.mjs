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

  await page.locator("#booster-hammer").click();
  await page.locator('.cascade-tile[data-index="0"]').click();
  await expect(page.locator("#hammer-count")).toHaveText("1");

  const during = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), activeRunKey);
  expect(during).toEqual(before);

  const blitzState = await page.evaluate(() => window.cascadeBonusModes.getState());
  expect(blitzState.mode).toBe("weekly-blitz");
  expect(blitzState.hammers).toBe(1);
});

test("Cascade waits for Weekly Blitz score submission before restoring the normal board", async ({ page }) => {
  await installState(page, { level: 7, lives: 5 });
  await page.addInitScript(() => {
    window.__resolveWeeklyScore = null;
    window.fetch = async (url, options = {}) => {
      const target = String(url);
      if (target.includes("/api/weekly")) {
        return new Promise((resolve) => {
          window.__resolveWeeklyScore = () => resolve(new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }));
        });
      }
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    };
  });
  await page.goto("/cascade.html");
  const normal = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), activeRunKey);

  await page.locator("[data-weekly-start]").click();
  await showSyntheticBlitzComplete(page);
  await page.locator("#result-actions button").click();

  await expect.poll(() => page.evaluate(() => typeof window.__resolveWeeklyScore)).toBe("function");
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), activeRunKey)).toEqual(normal);

  await page.evaluate(() => window.__resolveWeeklyScore());
  await expect(page.locator("body")).not.toHaveClass(/cascade-blitz-mode/);
});

test("Cascade bounds a stalled Weekly score save and restores the normal board", async ({ page }) => {
  await installState(page, { level: 7, lives: 5 });
  await page.addInitScript(() => {
    window.fetch = async (url) => {
      if (String(url).includes("/api/weekly")) return new Promise(() => {});
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    };
  });
  await page.goto("/cascade.html");
  await page.locator("[data-weekly-start]").click();
  await showSyntheticBlitzComplete(page);
  await page.locator("#result-actions button").click();
  await expect(page.locator("body")).not.toHaveClass(/cascade-blitz-mode/, { timeout: 6_000 });
});

test("Cascade bonus play remains available at zero lives", async ({ page }) => {
  await installState(page, { level: 7, lives: 0, lastLifeAt: Date.now() });
  await page.goto("/cascade.html");
  await expect(page.locator("#life-lock")).toBeVisible();
  await page.locator("[data-weekly-start]").click();
  await expect(page.locator("body")).toHaveClass(/cascade-blitz-mode/);
});

test("Cascade terminal dialogs cannot be dismissed into a locked board with Escape", async ({ page }) => {
  await installState(page, { level: 7, lives: 5 });
  await page.goto("/cascade.html");
  await page.evaluate(() => {
    window.cascadeResearch.forceFailureForTest();
  });
  await expect(page.locator("#result-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#result-dialog")).toBeVisible();
});

test("Cascade hammer arming is explicit and does not spend inventory until a target is chosen", async ({ page }) => {
  await installState(page, { level: 7, lives: 5, hammers: 2 });
  await page.goto("/cascade.html");
  await page.locator("#booster-hammer").click();
  await expect(page.locator("#booster-hammer")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#hammer-count")).toHaveText("2");
});

test("Cascade family-facing settings and Weekly Blitz copy avoid developer terminology", async ({ page }) => {
  await installState(page, { level: 7, lives: 5 });
  await page.goto("/cascade.html");
  await expect(page.locator("#cascade-feedback-card")).toContainText(/sound/i);
  await expect(page.locator("#cascade-weekly-card")).toContainText(/blitz/i);
  await expect(page.locator("#cascade-feedback-card")).not.toContainText(/debug|developer|telemetry/i);
}
