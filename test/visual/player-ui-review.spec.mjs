import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";

async function prepareOutput() {
  await mkdir(output, { recursive: true });
}

async function openPlayerHub(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto("/?player=visual-review-player");
  await expect(page.locator("body.gameframe-game-hub-lobby")).toBeVisible();
  await expect(page.locator(".game-hub-topbar")).toBeVisible();
  await expect(page.locator(".hero > .eyebrow")).toBeHidden();
  await expect(page.locator(".hero > #game-title")).toBeHidden();
  await expect(page.locator(".hero > #hero-copy")).toBeHidden();
  await expect(page.locator("#game-hub-achievements")).toBeVisible();
  await expect(page.locator("#game-hub-achievements")).toBeDisabled();
  await expect(page.locator("#game-hub-achievements")).toContainText("Coming soon");
  await expect(page.locator("#open-monster-master")).toBeVisible();
  await expect(page.locator("#open-othello")).toBeVisible();
  await expect(page.locator("#select-checkers")).toBeVisible();
  await expect(page.locator("#select-tic-tac-toe")).toBeVisible();
  await expect(page.locator(".game-grid .game-card")).toHaveCount(4);
  await expect(page.locator(".game-card-visual")).toHaveCount(4);
  await expect(page.locator("#open-tactical-canary")).toHaveCount(0);
  await expect(page.getByText("Combat Canary", { exact: true })).toHaveCount(0);
}

async function openTicTacToe(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto("/?player=tic-noir-review-player");
  await expect(page.locator("body.gameframe-game-hub-lobby")).toBeVisible();
  await page.locator("#select-tic-tac-toe").click();
  await page.locator("#challenge-theo").click();
  await expect(page.locator("body.tic-tac-toe-noir-running")).toBeVisible();
  await expect(page.locator(".tic-noir-topbar")).toBeVisible();
  await expect(page.locator('.tic-noir-topbar a[href="/"]')).toHaveCount(2);
  await expect(page.locator(".tic-noir-control-rail")).toBeVisible();
  await expect(page.locator("#board.board-tic-tac-toe")).toBeVisible();
  await expect(page.locator("#board .tic-cell")).toHaveCount(9);
  await expect(page.locator(".hero")).toBeHidden();
}

async function openMonsterMaster(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto("/monster-master.html?player=visual-review-player");
  await expect(page.locator("#monster-master-lobby")).toBeVisible();
  await page.locator("#monster-master-theo").click();
  await expect(page.locator("body.monster-master-match-active")).toBeVisible();
  await expect(page.locator("#monster-master-roster-title")).toHaveText("Turn order");
  await expect(page.locator(".monster-master-roster-rail .tactical-player-grid")).toBeHidden();
  await expect(page.locator(".monster-master-turn-unit")).toHaveCount(6);
  await expect(page.locator('.combat-nav a[href="/combat.html"]')).toHaveCount(0);
  await expect(page.locator('.combat-nav a[href="/tactical.html"]')).toHaveCount(0);
}

test.beforeAll(prepareOutput);

test("capture the player game hub at desktop and mobile sizes", async ({ page }) => {
  await openPlayerHub(page, { width: 1440, height: 960 });
  await page.screenshot({ path: `${output}/game-hub-desktop.png`, fullPage: true });

  await openPlayerHub(page, { width: 390, height: 844 });
  await page.screenshot({ path: `${output}/game-hub-mobile.png`, fullPage: true });
});

test("capture Tic-Tac-Toe noir at desktop and mobile sizes", async ({ page }) => {
  await openTicTacToe(page, { width: 1440, height: 960 });
  await page.screenshot({ path: `${output}/tic-tac-toe-desktop.png`, fullPage: true });

  await openTicTacToe(page, { width: 390, height: 844 });
  await page.screenshot({ path: `${output}/tic-tac-toe-mobile.png`, fullPage: true });
});

test("capture Monster Master turn order and battlefield at desktop and mobile sizes", async ({ page }) => {
  await openMonsterMaster(page, { width: 1440, height: 960 });
  await page.screenshot({ path: `${output}/monster-master-desktop.png`, fullPage: true });

  await openMonsterMaster(page, { width: 390, height: 844 });
  await page.screenshot({ path: `${output}/monster-master-mobile.png`, fullPage: true });
});
