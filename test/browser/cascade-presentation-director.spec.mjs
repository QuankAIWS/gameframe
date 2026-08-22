import { expect, test } from "@playwright/test";

async function firstLegalMove(page) {
  return page.evaluate(async () => {
    const { listLegalMoves } = await import("/cascade-engine.js");
    const board = [...document.querySelectorAll(".cascade-tile")].map((tile) => Number(tile.dataset.kind));
    return listLegalMoves(board)[0] ?? null;
  });
}

async function stageVictoryChoice(page) {
  await page.evaluate(async () => {
    await window.cascadePresentationDirector.demoWin({
      moves: 4,
      scoreBeforeBonus: 1200,
      scoreAfterBonus: 1600,
      stars: 3,
      reward: { claimed: 1 },
    });

    const dialog = document.querySelector("#result-dialog");
    const kicker = document.querySelector("#result-kicker");
    const title = document.querySelector("#result-title");
    const copy = document.querySelector("#result-copy");
    const actions = document.querySelector("#result-actions");
    kicker.textContent = "LEVEL COMPLETE";
    title.textContent = "Level 1 cleared.";
    copy.textContent = "★★★ this run · best ★★★ · 400 bonus points from 4 unused moves. Streak: 1.";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "primary";
    button.textContent = "Continue";
    actions.replaceChildren(button);
    dialog.showModal();
  });
}

test("Cascade routes gameplay spectacle through one explicit presentation director", async ({ page }) => {
  await page.goto("/cascade.html?player=cascade-director-test");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  expect(await page.locator('script[src="/cascade-polish.js"]').count()).toBe(0);
  expect(await page.locator('script[src="/cascade-dopamine-vfx.js"]').count()).toBe(0);
  await expect(page.locator("#cascade-feedback-card > small")).toHaveText("SETTINGS");

  const move = await firstLegalMove(page);
  expect(move).toBeTruthy();
  await page.locator(`.cascade-tile[data-index="${move.from}"]`).click();
  await page.locator(`.cascade-tile[data-index="${move.to}"]`).click();

  await expect.poll(() => page.evaluate(() => window.cascadePresentationDirector?.getStats().transitions || 0), {
    timeout: 6_000,
  }).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.cascadePresentationDirector?.getStats().clears || 0), {
    timeout: 6_000,
  }).toBeGreaterThan(0);
  const stats = await page.evaluate(() => window.cascadePresentationDirector.getStats());
  expect(stats.canvasCount).toBe(1);
  expect(stats.peakParticles).toBeLessThanOrEqual(stats.particleBudget);
});

test("Cascade reward sequence cashes unused moves, fills stars, and surfaces earned hammer", async ({ page }) => {
  await page.goto("/cascade.html?player=cascade-reward-sequence-test");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  await page.evaluate(() => {
    window.__cascadeRewardDemo = window.cascadePresentationDirector.demoWin({
      moves: 4,
      scoreBeforeBonus: 1200,
      scoreAfterBonus: 1600,
      stars: 3,
      reward: { claimed: 1 },
    });
  });

  const stage = page.locator(".cascade-reward-stage");
  await expect(stage).toHaveClass(/is-active/);
  await expect(stage.locator(".cascade-reward-kicker")).toHaveText("LEVEL CLEARED");
  await expect(stage.locator(".cascade-reward-stars i.is-earned")).toHaveCount(3, { timeout: 5_000 });
  await expect(stage.locator("[data-reward-hammer]")).toContainText("hammer earned");

  await page.evaluate(() => window.__cascadeRewardDemo);
  await expect(stage).not.toHaveClass(/is-active/);
  await expect(stage).toHaveClass(/is-victory-continuous/);
  await expect(stage.locator(".cascade-reward-actions")).toHaveCount(1);
  await expect(stage.locator(".cascade-reward-actions")).toBeHidden();
  await expect(page.locator("#score")).toHaveText("1,600");
  expect(await page.evaluate(() => window.cascadePresentationDirector.getStats().rewardSequences)).toBe(1);
});

test("Cascade victory keeps the animated reward card and only reveals actions", async ({ page }) => {
  await page.goto("/cascade.html?player=cascade-single-victory-surface-test");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  await stageVictoryChoice(page);

  const stage = page.locator(".cascade-reward-stage");
  const dialog = page.locator("#result-dialog");
  const actions = stage.locator(".cascade-reward-actions");
  await expect(stage).not.toHaveClass(/is-active/);
  await expect(stage).toHaveClass(/is-victory-continuous/);
  await expect(stage).toHaveClass(/is-awaiting-choice/);
  await expect(dialog).not.toHaveAttribute("open", "");
  await expect(stage.locator(".cascade-reward-summary")).toHaveCount(0);
  await expect(stage.locator(".cascade-reward-stars i.is-earned")).toHaveCount(3);
  await expect(stage.locator("[data-reward-hammer]")).toContainText("hammer earned");
  await expect(actions.locator("button", { hasText: "Continue" })).toHaveCount(1);
  await expect(actions).toBeVisible();

  await page.waitForTimeout(550);
  await expect(stage).not.toHaveClass(/is-active/);
  await expect(stage).toHaveClass(/is-awaiting-choice/);
  await expect(dialog).not.toHaveAttribute("open", "");
  await expect(stage.locator(".cascade-reward-summary")).toHaveCount(0);
});
