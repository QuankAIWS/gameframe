import { test, expect } from "@playwright/test";

const bootSeenStorageKey = "scribbles-gameframe.boot-seen:v2";
const internalHomeReturnStorageKey = "scribbles-gameframe.internal-home-return:v1";

test("a first visit uses the cold terminal boot and only marks it seen after successful startup", async ({ page }) => {
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

  const navigation = page.goto("/?player=hub-cold-boot-test");
  await sessionRequested;

  await expect(page.locator("#gameframe-boot")).toBeVisible();
  await expect(page.locator("#gameframe-boot")).toHaveAttribute("data-mode", "cold");
  await expect(page.locator(".gameframe-boot-window-mode")).toHaveText("COLD START");
  await expect(page.locator('[data-gameframe-boot-stage="session"]')).toHaveAttribute("data-state", "active");
  await expect(page.locator("#gameframe-boot-progress")).toBeVisible();
  await expect(page.locator("#gameframe-boot-progress")).toHaveAttribute("aria-valuenow", "8");
  await expect(page.locator("#lobby")).toBeHidden();
  await expect(page.locator("#select-tic-tac-toe")).toHaveCount(0);
  await expect(page.locator("#gameframe-boot-message")).toContainText("NEGOTIATING PLAYER HANDSHAKE");
  expect(await page.evaluate((key) => localStorage.getItem(key), bootSeenStorageKey)).toBeNull();

  const brandBox = await page.locator(".gameframe-boot-ident").boundingBox();
  const statusBox = await page.locator(".gameframe-boot-layout").boundingBox();
  expect(brandBox).not.toBeNull();
  expect(statusBox).not.toBeNull();
  expect(brandBox.y + brandBox.height).toBeLessThanOrEqual(statusBox.y + 1);

  releaseSession();
  await navigation;

  await expect(page.locator("#gameframe-boot")).toBeHidden();
  await expect(page.locator("body.gameframe-game-hub-lobby")).toBeVisible();
  await expect(page.locator("#game-card-tic-tac-toe")).toBeVisible();
  await expect(page.locator(".mode-grid")).toBeHidden();
  expect(await page.evaluate((key) => localStorage.getItem(key), bootSeenStorageKey)).toBe("seen");
});

test("repeat visits use the compact warm terminal boot", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "seen"), bootSeenStorageKey);

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

  const navigation = page.goto("/?player=hub-warm-boot-test");
  await sessionRequested;

  await expect(page.locator("#gameframe-boot")).toBeVisible();
  await expect(page.locator("#gameframe-boot")).toHaveAttribute("data-mode", "warm");
  await expect(page.locator(".gameframe-boot-window-mode")).toHaveText("WARM START");
  await expect(page.locator(".gameframe-boot-telemetry")).toBeHidden();
  await expect(page.locator(".gameframe-boot-rail")).toBeHidden();
  await expect(page.locator("#lobby")).toBeHidden();
  await expect(page.locator("#gameframe-boot-message")).toContainText("VERIFYING PLAYER SESSION");

  releaseSession();
  await navigation;

  await expect(page.locator("#gameframe-boot")).toBeHidden();
  await expect(page.locator("body.gameframe-game-hub-lobby")).toBeVisible();
});

test("Home returns to the hub without replaying the terminal boot", async ({ page }) => {
  await page.goto("/othello.html?player=hub-home-return-test");
  await expect(page.locator("#gameframe-destination-bar")).toBeVisible();
  await expect(page.locator("#othello-game-menu")).toBeVisible();

  let releaseHomeSession;
  let markHomeSessionRequested;
  const homeSessionRequested = new Promise((resolve) => {
    markHomeSessionRequested = resolve;
  });
  await page.route("**/api/session", async (route) => {
    markHomeSessionRequested();
    await new Promise((resolve) => {
      releaseHomeSession = resolve;
    });
    await route.continue();
  });

  const homeNavigation = page.locator("#gameframe-destination-bar [data-gameframe-home]").click();
  await homeSessionRequested;

  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("html")).toHaveClass(/gameframe-internal-home-return/);
  await expect(page.locator("body.gameframe-booting")).toBeVisible();
  await expect(page.locator("#gameframe-boot")).toBeHidden();
  await expect(page.locator(".shell")).toBeVisible();
  expect(await page.evaluate((key) => sessionStorage.getItem(key), internalHomeReturnStorageKey)).toBeNull();

  releaseHomeSession();
  await homeNavigation;

  await expect(page.locator("body.gameframe-game-hub-lobby")).toBeVisible();
  await expect(page.locator("#game-card-othello")).toBeVisible();
  await expect(page.locator("#gameframe-boot")).toBeHidden();
});

test("the complete game cards open their game-specific menus", async ({ page }) => {
  await page.goto("/?player=hub-navigation-test");
  await expect(page.locator("#gameframe-destination-bar")).toBeVisible();
  await expect(page.locator(".mode-grid")).toBeHidden();
  await expect(page.locator("#game-card-tic-tac-toe")).toContainText("CPU Opponent");

  const ticCard = page.locator("#game-card-tic-tac-toe");
  await expect(ticCard).toHaveAttribute("href", "/?game=tic-tac-toe&menu=1");
  await expect(ticCard.locator(".game-card-play")).toHaveText("Play now");
  await ticCard.locator(".game-card-body").click();
  await expect(page).toHaveURL(/game=tic-tac-toe&menu=1/);
  await expect(page.locator("body.gameframe-game-menu")).toBeVisible();
  await expect(page.locator("#challenge-bot")).toBeVisible();
  await expect(page.locator("#bot-challenge-label")).toHaveText("Challenge CPU Opponent");
  await expect(page.locator("#create-human-match")).toBeVisible();

  await page.locator("#gameframe-destination-bar [data-gameframe-home]").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("body.gameframe-game-hub-lobby")).toBeVisible();

  await page.locator("#game-card-othello .game-card-visual").click();
  await expect(page).toHaveURL(/\/othello\.html$/);
  await expect(page.locator("#othello-game-menu")).toBeVisible();
  await expect(page.locator("#othello-play-bot")).toBeVisible();
  await expect(page.locator("#othello-play-bot")).toContainText("Challenge OthelloBot");
  await expect(page.locator("#othello-play-local")).toBeVisible();
});

test("the destination bar is the only product navigation header during play", async ({ page }) => {
  await page.goto("/?game=american-checkers&menu=1&player=checkers-navigation-test");
  await page.locator("#challenge-bot").click();
  await expect(page.locator("#match-panel")).toBeVisible();
  await expect(page.locator("body.gameframe-shared-match-running")).toBeVisible();
  await expect(page.locator("#gameframe-destination-bar")).toBeVisible();
  await expect(page.locator(".shell > .hero")).toBeHidden();

  const activeMatchId = (await page.locator("#match-id").textContent())?.trim();
  expect(activeMatchId).toBeTruthy();
  await page.evaluate((matchId) => {
    localStorage.setItem("scribbles-gameframe.recent-match", matchId);
  }, activeMatchId);

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("Leave this match");
    await dialog.accept();
  });
  await page.locator("#gameframe-destination-bar [data-gameframe-home]").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("body.gameframe-game-hub-lobby")).toBeVisible();
  await expect(page.locator("#match-panel")).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem("scribbles-gameframe.recent-match"))).toBeNull();

  await page.goto("/monster-master.html?player=monster-navigation-test");
  await expect(page.locator("#gameframe-destination-bar")).toBeVisible();
  await expect(page.locator(".monster-master-shell > .hero")).toBeHidden();
  await expect(page.locator("#monster-master-lobby")).toBeVisible();
});
