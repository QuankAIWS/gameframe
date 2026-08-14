import { test, expect } from "@playwright/test";

const playerId = "shared-shell-controls-test";
const identity = {
  playerId,
  displayName: "Shell Controls",
  source: "development",
  avatarUrl: null,
};

async function expectSharedControls(page) {
  const actions = page.locator("#gameframe-shell-actions");
  await expect(actions).toBeVisible();
  await expect(page.locator("#gameframe-theme-trigger")).toBeVisible();
  await expect(page.locator("#gameframe-alerts-trigger")).toBeVisible();
  await expect(page.locator("#gameframe-alerts-count")).toBeHidden();
  await expect(page.locator("#gameframe-session-badge")).toBeVisible();

  const childIds = await actions.locator(":scope > *").evaluateAll((nodes) => nodes.map((node) => node.id));
  expect(childIds.slice(0, 3)).toEqual([
    "gameframe-theme-control",
    "gameframe-alerts",
    "gameframe-session-badge",
  ]);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("scribbles-gameframe.boot-seen:v2", "seen");
  });

  await page.route("**/api/session", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(identity) });
  });
  await page.route("**/api/me/feed", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ invitations: [] }) });
  });
});

test("every shared destination exposes Theme, Alerts, and the player session together", async ({ page }) => {
  const destinations = [
    `/?player=${playerId}`,
    `/?catalog=1&player=${playerId}`,
    `/matches.html?player=${playerId}`,
    `/leaderboard.html?player=${playerId}`,
    `/profile.html?player=${playerId}`,
    `/othello.html?player=${playerId}`,
    `/?game=american-checkers&menu=1&player=${playerId}`,
  ];

  for (const destination of destinations) {
    await page.goto(destination);
    await expect(page.locator("#gameframe-destination-bar")).toBeVisible();
    await expectSharedControls(page);
  }
});

test("theme picker offers five presets and persists the selected shell theme across destinations", async ({ page }) => {
  await page.goto(`/leaderboard.html?player=${playerId}`);
  await expectSharedControls(page);

  await page.locator("#gameframe-theme-trigger").click();
  await expect(page.locator("#gameframe-theme-panel")).toBeVisible();
  await expect(page.locator("[data-theme-option]")).toHaveCount(5);
  await expect(page.locator('[data-theme-option="standard"]')).toContainText("GameFrame Green");
  await expect(page.locator('[data-theme-option="cascade-pop"]')).toContainText("Cascade Pop");
  await expect(page.locator('[data-theme-option="cyberpunk"]')).toContainText("Neon Grid");
  await expect(page.locator('[data-theme-option="clockwork"]')).toContainText("Clockwork");
  await expect(page.locator('[data-theme-option="deep-space"]')).toContainText("Deep Space");

  await page.locator('[data-theme-option="cascade-pop"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-gameframe-shell-theme", "cascade-pop");
  expect(await page.evaluate(() => localStorage.getItem("scribbles-gameframe.shell-theme:v1"))).toBe("cascade-pop");

  await page.goto(`/?player=${playerId}`);
  await expect(page.locator("html")).toHaveAttribute("data-gameframe-shell-theme", "cascade-pop");
  await expectSharedControls(page);

  await page.locator("#gameframe-theme-trigger").click();
  await page.locator('[data-theme-option="standard"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-gameframe-shell-theme", "standard");
});
