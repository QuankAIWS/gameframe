import { test, expect } from "@playwright/test";

const playerId = "discord-account-chip-test";

async function installAccountFixtures(page) {
  let themeId = "standard";
  let logoutRequests = 0;

  await page.addInitScript(() => {
    localStorage.setItem("scribbles-gameframe.boot-seen:v2", "seen");
  });

  await page.route("**/api/session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      playerId,
      displayName: "Discord Player",
      source: "discord",
      avatarUrl: "/favicon.ico",
    }),
  }));

  await page.route("**/api/me/feed", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      matches: [],
      invitations: [],
      favoriteGameIds: [],
      themeId,
      themeConfigured: true,
    }),
  }));

  await page.route("**/api/me/progression", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ gamerLevel: 1, gamerXp: 0, xpToNextLevel: 100, progress: 0 }),
  }));

  await page.route("**/api/me/preferences", async (route) => {
    const body = route.request().postDataJSON();
    if (typeof body?.themeId === "string") themeId = body.themeId;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ favoriteGameIds: [], themeId, themeConfigured: true }),
    });
  });

  await page.route("**/auth/logout", async (route) => {
    logoutRequests += 1;
    await route.fulfill({ status: 204, body: "" });
  });

  return { logoutCount: () => logoutRequests };
}

test("authenticated GameFrame session renders as a compact themed account chip with logout in its menu", async ({ page }) => {
  const state = await installAccountFixtures(page);
  await page.goto(`/?player=${playerId}`);

  const chip = page.locator("#gameframe-session-badge");
  const trigger = page.locator("#gameframe-account-trigger");
  const panel = page.locator("#gameframe-account-panel");

  await expect(chip).toBeVisible();
  await expect(trigger).toBeVisible();
  await expect(trigger).toContainText("Discord Player");
  await expect(trigger.locator("img")).toHaveCount(1);
  await expect(chip.getByText("Discord session", { exact: true })).toHaveCount(0);
  await expect(chip.getByText("Log out", { exact: true })).toHaveCount(0);
  await expect(page.locator("body > #gameframe-account-panel")).toHaveCount(1);
  await expect(panel).toBeHidden();

  const initialBackground = await trigger.evaluate((node) => getComputedStyle(node).backgroundColor);
  await page.locator("#gameframe-theme-trigger").click();
  await page.locator('[data-theme-option="cascade-pop"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-gameframe-shell-theme", "cascade-pop");
  await expect.poll(() => trigger.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe(initialBackground);
  await expect.poll(() => trigger.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe("rgba(255, 247, 252, 0.9)");

  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Discord Player");
  await expect(panel).toContainText("GameFrame account");

  const logout = panel.getByRole("menuitem", { name: /Log out/ });
  await expect(logout).toBeVisible();
  await logout.click();
  await expect.poll(state.logoutCount).toBe(1);
});
