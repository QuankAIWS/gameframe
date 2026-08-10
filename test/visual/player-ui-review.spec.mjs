import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";
const desktop = { width: 1440, height: 960 };
const mobile = { width: 390, height: 844 };
const bootSeenStorageKey = "scribbles-gameframe.boot-seen:v2";

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
  await expect(page.locator("#gameframe-session-badge")).toBeVisible();
  if (theme) await expect(bar).toHaveAttribute("data-theme", theme);
}

async function expectBoardFirstOnMobile(page, selector) {
  const viewport = page.viewportSize();
  if (!viewport || viewport.width > 720) return;
  const bounds = await page.locator(selector).boundingBox();
  if (!bounds) throw new Error(`${selector} did not produce layout bounds.`);
  expect(bounds.width).toBeGreaterThanOrEqual(viewport.width * .82);
}

async function captureBootSurface(page, viewport, mode, filename) {
  if (mode === "warm") {
    await page.addInitScript((key) => localStorage.setItem(key, "seen"), bootSeenStorageKey);
  }

  let releaseSession;
  let markSessionRequested;
  const sessionRequested = new Promise((resolve) => {
    markSessionRequested = resolve;
  });

  await page.route("**/api/session", async (route) => {
    markSessionRequested();
    await new Promise((resolve) => {
      releaseSession = resolve;
    });
    await route.continue();
  });

  await page.setViewportSize(viewport);
  const navigation = page.goto(`/?player=visual-review-${mode}-boot`);
  await sessionRequested;

  const boot = page.locator("#gameframe-boot");
  await expect(boot).toBeVisible();
  await expect(boot).toHaveAttribute("data-mode", mode);
  await expect(page.locator(".gameframe-boot-window-mode")).toHaveText(mode === "cold" ? "COLD START" : "WARM START");
  await expect(page.locator('[data-gameframe-boot-stage="session"]')).toHaveAttribute("data-state", "active");
  await expect(page.locator("#gameframe-boot-progress")).toHaveAttribute("aria-valuenow", "8");
  await page.screenshot({ path: `${output}/${filename}`, fullPage: true });

  releaseSession();
  await navigation;
  await expect(boot).toBeHidden({ timeout: 5_000 });
  await page.unroute("**/api/session");
}

async function openPlayerHub(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto("/?player=visual-review-player");
  await expect(page.locator("body.gameframe-game-hub-lobby")).toBeVisible();
  await expect(page.locator("#gameframe-boot")).toBeHidden({ timeout: 5_000 });
  await expectDestinationBar(page, "hub");
  await expect(page.locator(".hero")).toBeHidden();
  await expect(page.locator("#lobby .section-label")).toHaveText("GAMES");
  await expect(page.locator(".game-grid .game-card")).toHaveCount(6);
  await expect(page.locator(".game-card-play")).toHaveCount(6);
  await expect(page.locator('.game-card[href="/gameframe-rpg.html"]')).toHaveCount(1);
  await expect(page.locator('.game-card[href="/battle-simulator.html"]')).toHaveCount(1);
  await expect(page.locator('.game-card[href="/casual-games.html"]')).toHaveCount(1);
  await expect(page.locator('.game-card[href="/monster-master-rpg.html?campaign=monster-master-staging"]')).toHaveCount(0);
  await expect(page.locator('.game-card[href="/monster-master.html"]')).toHaveCount(0);
  await expect(page.locator('.game-card[href="/othello.html"]')).toHaveCount(1);
  await expect(page.locator('.game-card[href="/?game=american-checkers&menu=1"]')).toHaveCount(1);
  await expect(page.locator('.game-card[href="/?game=tic-tac-toe&menu=1"]')).toHaveCount(1);
  await expect(page.locator("#game-card-role-playing-games")).toContainText("Role-Playing Games");
  await expect(page.locator("#game-card-battle-simulator")).toContainText("Battle Simulator");
  await expect(page.locator("#game-card-casual-games")).toContainText("Casual Games");
  await expect(page.locator(".mode-grid")).toBeHidden();
  await expect(page.locator("#open-tactical-canary")).toHaveCount(0);
  await expect(page.getByText("Combat Canary", { exact: true })).toHaveCount(0);
}

async function openRolePlayingGames(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto("/gameframe-rpg.html");
  await expect(page.getByRole("heading", { name: "Persistent worlds. Real campaigns." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Monster Master RPG" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Monster Master RPG" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Create RPG/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /My Campaigns/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Import Campaign/ })).toBeDisabled();
  await expect(page.locator(".rpg-preview-engine")).toHaveCount(0);
}

async function openBattleSimulator(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto("/battle-simulator.html");
  await expect(page.getByRole("heading", { name: "Build the fight. Skip the campaign." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Monster Master Arena Battles" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Monster Master Arena" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Custom Battle/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Generate Battlefield/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Import Battle Pack/ })).toBeDisabled();
  await expect(page.locator(".rpg-preview-engine")).toHaveCount(0);
}

async function openSharedGameMenu(page, viewport, game, theme) {
  await page.setViewportSize(viewport);
  await page.goto(`/?game=${game}&menu=1&player=${game}-menu-review-player`);
  await expect(page.locator("body.gameframe-game-menu")).toBeVisible();
  await expectDestinationBar(page, theme);
  await expect(page.locator(".game-menu-hero")).toBeVisible();
  await expect(page.locator(".game-grid")).toBeHidden();
  await expect(page.locator(".mode-grid")).toBeVisible();
  await expect(page.locator("#challenge-bot")).toBeVisible();
  await expect(page.locator("#create-human-match")).toBeVisible();
}

async function openTicTacToeMenu(page, viewport) {
  await openSharedGameMenu(page, viewport, "tic-tac-toe", "tic");
}

async function openCheckersMenu(page, viewport) {
  await openSharedGameMenu(page, viewport, "american-checkers", "checkers");
}

async function openTicTacToe(page, viewport) {
  await openTicTacToeMenu(page, viewport);
  await page.locator("#challenge-bot").click();
  await expect(page.locator("body.tic-tac-toe-noir-running")).toBeVisible();
  await expectDestinationBar(page, "tic");
  await expect(page.locator(".tic-noir-topbar")).toBeHidden();
  await expect(page.locator(".tic-noir-control-rail")).toBeVisible();
  await expect(page.locator("#board.board-tic-tac-toe")).toBeVisible();
  await expect(page.locator("#board .tic-cell")).toHaveCount(9);
  await expect(page.locator(".hero")).toBeHidden();
  await expect(page.locator(".tic-noir-footer > a")).toBeHidden();
  await expectBoardFirstOnMobile(page, ".tic-noir-board-frame");
}

async function openCheckers(page, viewport) {
  await openCheckersMenu(page, viewport);
  await page.locator("#challenge-bot").click();
  await expect(page.locator("body.gameframe-shared-match-running")).toBeVisible();
  await expectDestinationBar(page, "checkers");
  await expect(page.locator("#board.board-checkers")).toBeVisible();
  await expect(page.locator("#board .checkers-cell")).toHaveCount(64);
  await expect(page.locator(".shell > .hero")).toBeHidden();
  await expectBoardFirstOnMobile(page, ".board-wrap");
}

async function openOthelloMenu(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto("/othello.html?player=othello-review-player");
  await expectDestinationBar(page, "othello-obsidian");
  await expect(page.locator(".othello-app > .product-header")).toBeHidden();
  await expect(page.locator("#othello-game-menu")).toBeVisible();
  await expect(page.locator("#othello-play-bot")).toBeVisible();
  await expect(page.locator("#othello-play-local")).toBeVisible();
  await expect(page.locator("#othello-resume")).toBeVisible();
  await expect(page.locator("#dark-score")).toHaveText("2");
  await expect(page.locator("#light-score")).toHaveText("2");
  await expect(page.locator("#move-number")).toHaveText("0 / 60");
  await expect(page.locator("#demo-move")).toHaveCount(0);
}

async function openOthello(page, viewport) {
  await openOthelloMenu(page, viewport);
  await page.locator("#othello-play-bot").click();
  await expect(page.locator("#othello-game-menu")).toBeHidden();
  await expect(page.locator(".score-rail-dark > span")).toHaveText("You");
  await expect(page.locator(".score-rail-light > span")).toHaveText("OthelloBot");
  await expectBoardFirstOnMobile(page, ".board-viewport");

  const canvas = page.locator("#othello-board");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Othello canvas did not produce layout bounds.");
  await page.mouse.click(bounds.x + bounds.width * (429 / 960), bounds.y + bounds.height * (327 / 960));
  await expect(page.locator("#move-number")).toHaveText("2 / 60", { timeout: 4_000 });
  await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem("scribbles-gameframe.othello.local-match.v1")))).toBe(true);
}

async function openMonsterMasterLobby(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto("/monster-master.html?player=visual-review-player");
  await expectDestinationBar(page, "monster");
  await expect(page.locator(".monster-master-shell > .hero")).toBeHidden();
  await expect(page.locator("#monster-master-lobby")).toBeVisible();
  await expect(page.locator("#monster-master-bot")).toBeVisible();
  await expect(page.locator("#monster-master-human")).toBeVisible();
}

async function openMonsterMaster(page, viewport) {
  await openMonsterMasterLobby(page, viewport);
  await page.locator("#monster-master-bot").click();
  await expect(page.locator("body.monster-master-match-active")).toBeVisible();
  await expect(page.locator("body.monster-master-pixi-ready")).toBeVisible();
  await expect(page.locator("#monster-master-roster-title")).toHaveText("Turn order");
  await expect(page.locator(".monster-master-roster-rail .tactical-player-grid")).toBeHidden();
  await expect(page.locator(".monster-master-turn-unit")).toHaveCount(6);
  await expect(page.locator('.combat-nav a[href="/combat.html"]')).toHaveCount(0);
  await expect(page.locator('.combat-nav a[href="/tactical.html"]')).toHaveCount(0);
  await expect(page.locator("#monster-master-pixi-canvas")).toBeVisible();
  await expect(page.locator("#monster-master-canvas")).toBeHidden();
}

async function openMonsterMasterRpg(page, viewport) {
  const campaignId = "campaign-visual-review";
  await page.unroute(`**/api/rpg/campaigns/${campaignId}/attach`).catch(() => undefined);
  await page.route(`**/api/rpg/campaigns/${campaignId}/attach`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      protocolVersion: 2,
      kind: "campaign.attached",
      campaignId,
      title: "The Academy Gate Incident",
      status: "active",
      playerId: "visual-rpg-player",
      role: "player",
      partyId: "party:keepers",
      gameframeCoordinationRevision: 6,
      presentationSequence: 8,
      linkedNarrativeRevision: 2,
      cursor: "visual-cursor",
      hasMore: false,
      events: [
        {
          eventId: "event:visual-scene",
          kind: "scene.presented",
          presentationSequence: 7,
          payload: { narration: "Rain rattles against the academy gate while the hazard lamp flashes an unauthorized transport warning." },
          createdAt: "2026-08-05T03:30:00.000Z",
        },
        {
          eventId: "event:visual-dialogue",
          kind: "dialogue.turn",
          presentationSequence: 8,
          payload: { speakerName: "Groundskeeper", dialogue: "That seal was reset less than an hour ago." },
          createdAt: "2026-08-05T03:30:01.000Z",
        },
      ],
    }),
  }));
  await page.setViewportSize(viewport);
  await page.goto(`/monster-master-rpg.html?player=visual-rpg-player&campaign=${campaignId}`);
  await expectDestinationBar(page, "monster");
  await expect(page.locator("#mm-rpg-campaign")).toBeVisible();
  await expect(page.locator("#mm-rpg-events .mm-rpg-event")).toHaveCount(2);
  await page.getByRole("button", { name: "Describe an in-world action" }).click();
  await expect(page.locator("#mm-rpg-action-form")).toHaveClass(/is-open/);
  await expect(page.locator("#mm-rpg-action")).toBeVisible();
}

test.beforeAll(prepareOutput);

test("capture cold boot at desktop size", async ({ page }) => {
  await captureBootSurface(page, desktop, "cold", "boot-cold-desktop.png");
});

test("capture cold boot at mobile size", async ({ page }) => {
  await captureBootSurface(page, mobile, "cold", "boot-cold-mobile.png");
});

test("capture warm boot at desktop size", async ({ page }) => {
  await captureBootSurface(page, desktop, "warm", "boot-warm-desktop.png");
});

test("capture warm boot at mobile size", async ({ page }) => {
  await captureBootSurface(page, mobile, "warm", "boot-warm-mobile.png");
});

test("capture the player Games hub at desktop and mobile sizes", async ({ page }) => {
  await openPlayerHub(page, desktop);
  await page.screenshot({ path: `${output}/game-hub-desktop.png`, fullPage: true });
  await openPlayerHub(page, mobile);
  await page.screenshot({ path: `${output}/game-hub-mobile.png`, fullPage: true });
});

test("capture Role-Playing Games and Battle Simulator at desktop and mobile sizes", async ({ page }) => {
  await openRolePlayingGames(page, desktop);
  await page.screenshot({ path: `${output}/role-playing-games-desktop.png`, fullPage: true });
  await openRolePlayingGames(page, mobile);
  await page.screenshot({ path: `${output}/role-playing-games-mobile.png`, fullPage: true });

  await openBattleSimulator(page, desktop);
  await page.screenshot({ path: `${output}/battle-simulator-desktop.png`, fullPage: true });
  await openBattleSimulator(page, mobile);
  await page.screenshot({ path: `${output}/battle-simulator-mobile.png`, fullPage: true });
});

test("capture the Monster Master RPG campaign shell at desktop and mobile sizes", async ({ page }) => {
  await openMonsterMasterRpg(page, desktop);
  await page.screenshot({ path: `${output}/monster-master-rpg-desktop.png`, fullPage: true });
  await openMonsterMasterRpg(page, mobile);
  await page.screenshot({ path: `${output}/monster-master-rpg-mobile.png`, fullPage: true });
});

test("capture both shared game menus at desktop and mobile sizes", async ({ page }) => {
  await openTicTacToeMenu(page, desktop);
  await page.screenshot({ path: `${output}/tic-tac-toe-menu-desktop.png`, fullPage: true });
  await openTicTacToeMenu(page, mobile);
  await page.screenshot({ path: `${output}/tic-tac-toe-menu-mobile.png`, fullPage: true });

  await openCheckersMenu(page, desktop);
  await page.screenshot({ path: `${output}/checkers-menu-desktop.png`, fullPage: true });
  await openCheckersMenu(page, mobile);
  await page.screenshot({ path: `${output}/checkers-menu-mobile.png`, fullPage: true });
});

test("capture both shared game matches at desktop and mobile sizes", async ({ page }) => {
  await openTicTacToe(page, desktop);
  await page.screenshot({ path: `${output}/tic-tac-toe-desktop.png`, fullPage: true });
  await openTicTacToe(page, mobile);
  await page.screenshot({ path: `${output}/tic-tac-toe-mobile.png`, fullPage: true });

  await openCheckers(page, desktop);
  await page.screenshot({ path: `${output}/checkers-desktop.png`, fullPage: true });
  await openCheckers(page, mobile);
  await page.screenshot({ path: `${output}/checkers-mobile.png`, fullPage: true });
});

test("capture the Othello menu and playable board at desktop and mobile sizes", async ({ page }) => {
  await openOthelloMenu(page, desktop);
  await page.screenshot({ path: `${output}/othello-menu-desktop.png`, fullPage: true });
  await openOthelloMenu(page, mobile);
  await page.screenshot({ path: `${output}/othello-menu-mobile.png`, fullPage: true });

  await openOthello(page, desktop);
  await page.screenshot({ path: `${output}/othello-desktop.png`, fullPage: true });
  await openOthello(page, mobile);
  await page.screenshot({ path: `${output}/othello-mobile.png`, fullPage: true });
});

test("capture the Monster Master lobby and battlefield at desktop and mobile sizes", async ({ page }) => {
  await openMonsterMasterLobby(page, desktop);
  await page.screenshot({ path: `${output}/monster-master-lobby-desktop.png`, fullPage: true });
  await openMonsterMasterLobby(page, mobile);
  await page.screenshot({ path: `${output}/monster-master-lobby-mobile.png`, fullPage: true });

  await openMonsterMaster(page, desktop);
  await page.screenshot({ path: `${output}/monster-master-desktop.png`, fullPage: true });
  await openMonsterMaster(page, mobile);
  await page.screenshot({ path: `${output}/monster-master-mobile.png`, fullPage: true });
});