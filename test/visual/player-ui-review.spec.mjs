import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";

async function prepareOutput() {
  await mkdir(output, { recursive: true });
}

async function expectDestinationBar(page, theme = null) {
  const bar = page.locator("#gameframe-destination-bar");
  await expect(bar).toBeVisible();
  await expect(bar.locator('[data-gameframe-home][href="/"]')).toHaveCount(1);
  await expect(bar.getByRole("button", { name: /Achievements/i })).toBeDisabled();
  await expect(bar.getByText("Coming soon", { exact: true })).toBeVisible();
  await expect(bar.getByText("Games", { exact: true })).toHaveCount(0);
  if (theme) await expect(bar).toHaveAttribute("data-theme", theme);
}

async function openPlayerHub(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto("/?player=visual-review-player");
  await expect(page.locator("body.gameframe-game-hub-lobby")).toBeVisible();
  await expectDestinationBar(page, "hub");
  await expect(page.locator(".hero")).toBeHidden();
  await expect(page.locator(".game-grid .game-card")).toHaveCount(4);
  await expect(page.locator(".game-card-play")).toHaveCount(4);
  await expect(page.locator('.game-card[href="/monster-master.html"]')).toHaveCount(1);
  await expect(page.locator('.game-card[href="/othello.html"]')).toHaveCount(1);
  await expect(page.locator('.game-card[href="/?game=american-checkers&menu=1"]')).toHaveCount(1);
  await expect(page.locator('.game-card[href="/?game=tic-tac-toe&menu=1"]')).toHaveCount(1);
  await expect(page.locator(".mode-grid")).toBeHidden();
  await expect(page.locator("#open-tactical-canary")).toHaveCount(0);
  await expect(page.getByText("Combat Canary", { exact: true })).toHaveCount(0);
}

async function openTicTacToeMenu(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto("/?game=tic-tac-toe&menu=1&player=tic-menu-review-player");
  await expect(page.locator("body.gameframe-game-menu")).toBeVisible();
  await expectDestinationBar(page, "tic");
  await expect(page.locator(".game-menu-hero")).toBeVisible();
  await expect(page.locator(".game-grid")).toBeHidden();
  await expect(page.locator(".mode-grid")).toBeVisible();
  await expect(page.locator("#challenge-theo")).toBeVisible();
  await expect(page.locator("#create-human-match")).toBeVisible();
}

async function openTicTacToe(page, viewport) {
  await openTicTacToeMenu(page, viewport);
  await page.locator("#challenge-theo").click();
  await expect(page.locator("body.tic-tac-toe-noir-running")).toBeVisible();
  await expectDestinationBar(page, "tic");
  await expect(page.locator(".tic-noir-topbar")).toBeHidden();
  await expect(page.locator(".tic-noir-control-rail")).toBeVisible();
  await expect(page.locator("#board.board-tic-tac-toe")).toBeVisible();
  await expect(page.locator("#board .tic-cell")).toHaveCount(9);
  await expect(page.locator(".hero")).toBeHidden();
}

async function openOthello(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto("/othello.html?player=othello-review-player");
  await expectDestinationBar(page, "othello-obsidian");
  await expect(page.locator(".othello-app > .product-header")).toBeHidden();
  await expect(page.locator("#othello-game-menu")).toBeVisible();
  await expect(page.locator("#dark-score")).toHaveText("2");
  await expect(page.locator("#light-score")).toHaveText("2");
  await expect(page.locator("#move-number")).toHaveText("0 / 60");
  await expect(page.locator("#demo-move")).toHaveCount(0);
  await page.locator("#othello-play-theo").click();
  await expect(page.locator("#othello-game-menu")).toBeHidden();
  await expect(page.locator(".score-rail-dark > span")).toHaveText("You");
  await expect(page.locator(".score-rail-light > span")).toHaveText("Theo");

  const canvas = page.locator("#othello-board");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Othello canvas did not produce layout bounds.");
  await page.mouse.click(bounds.x + bounds.width * (429 / 960), bounds.y + bounds.height * (327 / 960));
  await expect(page.locator("#move-number")).toHaveText("2 / 60", { timeout: 4_000 });
  await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem("scribbles-gameframe.othello.local-match.v1")))).toBe(true);
}

async function openMonsterMaster(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto("/monster-master.html?player=visual-review-player");
  await expectDestinationBar(page, "monster");
  await expect(page.locator(".monster-master-shell > .hero")).toBeHidden();
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

test("capture the Tic-Tac-Toe game menu at desktop and mobile sizes", async ({ page }) => {
  await openTicTacToeMenu(page, { width: 1440, height: 960 });
  await page.screenshot({ path: `${output}/tic-tac-toe-menu-desktop.png`, fullPage: true });
  await openTicTacToeMenu(page, { width: 390, height: 844 });
  await page.screenshot({ path: `${output}/tic-tac-toe-menu-mobile.png`, fullPage: true });
});

test("capture Tic-Tac-Toe noir at desktop and mobile sizes", async ({ page }) => {
  await openTicTacToe(page, { width: 1440, height: 960 });
  await page.screenshot({ path: `${output}/tic-tac-toe-desktop.png`, fullPage: true });
  await openTicTacToe(page, { width: 390, height: 844 });
  await page.screenshot({ path: `${output}/tic-tac-toe-mobile.png`, fullPage: true });
});

test("play and capture Othello at desktop and mobile sizes", async ({ page }) => {
  await openOthello(page, { width: 1440, height: 960 });
  await page.screenshot({ path: `${output}/othello-desktop.png`, fullPage: true });
  await openOthello(page, { width: 390, height: 844 });
  await page.screenshot({ path: `${output}/othello-mobile.png`, fullPage: true });
});

test("capture Monster Master turn order and battlefield at desktop and mobile sizes", async ({ page }) => {
  await openMonsterMaster(page, { width: 1440, height: 960 });
  await page.screenshot({ path: `${output}/monster-master-desktop.png`, fullPage: true });
  await openMonsterMaster(page, { width: 390, height: 844 });
  await page.screenshot({ path: `${output}/monster-master-mobile.png`, fullPage: true });
});
