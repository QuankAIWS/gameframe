import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";
const playerId = "account-menu-visual-player";
const desktop = { width: 1440, height: 960 };
const mobile = { width: 390, height: 844 };

async function installFixtures(page) {
  await page.addInitScript(() => {
    localStorage.setItem("scribbles-gameframe.boot-seen:v2", "seen");
  });

  await page.route("**/test-avatar.svg", (route) => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#ff78b6"/><circle cx="32" cy="26" r="12" fill="#fff5fb"/><path d="M12 58c3-13 12-19 20-19s17 6 20 19" fill="#73dfda"/></svg>',
  }));

  await page.route("**/api/session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      playerId,
      displayName: "Cascade Player",
      source: "discord",
      avatarUrl: "/test-avatar.svg",
    }),
  }));

  await page.route("**/api/me/feed", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      matches: [],
      invitations: [],
      favoriteGameIds: ["cascade"],
      themeId: "cascade-pop",
      themeConfigured: true,
    }),
  }));

  await page.route("**/api/me/progression", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ gamerLevel: 12, gamerXp: 1340, xpToNextLevel: 160, progress: .72 }),
  }));
}

async function capture(page, viewport, filename) {
  await installFixtures(page);
  await page.setViewportSize(viewport);
  await page.goto(`/?player=${playerId}`);
  await expect(page.locator("#gameframe-boot")).toBeHidden({ timeout: 5_000 });
  await expect(page.locator("html")).toHaveAttribute("data-gameframe-shell-theme", "cascade-pop");

  const trigger = page.locator("#gameframe-account-trigger");
  const panel = page.locator("#gameframe-account-panel");
  await expect(trigger).toBeVisible();
  await expect(trigger).toContainText("Cascade Player");
  await trigger.click();
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("menuitem", { name: /Log out/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  await page.screenshot({ path: `${output}/${filename}`, fullPage: false });
}

test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
});

test("capture Cascade Pop Discord account menu at desktop size", async ({ page }) => {
  await capture(page, desktop, "account-menu-cascade-desktop.png");
});

test("capture Cascade Pop Discord account menu at mobile size", async ({ page }) => {
  await capture(page, mobile, "account-menu-cascade-mobile.png");
});
