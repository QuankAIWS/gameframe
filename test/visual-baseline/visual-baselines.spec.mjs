import { expect, test } from "@playwright/test";

function discordSession(playerId, displayName) {
  return {
    authenticated: true,
    playerId,
    source: "discord",
    displayName,
    avatarUrl: null,
  };
}

async function settlePage(page) {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    window.scrollTo(0, 0);
  });
}

test("main lobby desktop composition", async ({ page }) => {
  await page.goto("/?player=visual-board-user");
  await expect(page.locator("#lobby")).toBeVisible();
  await settlePage(page);
  await expect(page).toHaveScreenshot("main-lobby-desktop.png", { fullPage: true });
});

test("main lobby mobile composition", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?player=visual-board-user");
  await expect(page.locator("#lobby")).toBeVisible();
  await settlePage(page);
  await expect(page).toHaveScreenshot("main-lobby-mobile.png", { fullPage: true });
});

test("hosted authentication gate composition", async ({ page }) => {
  await page.route("**/api/session", (route) => route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ error: "authentication_required", message: "Authentication required." }),
  }));
  await page.goto("/");
  await expect(page.locator("#gameframe-auth-gate")).toBeVisible();
  await settlePage(page);
  await expect(page).toHaveScreenshot("hosted-authentication-gate.png", { fullPage: true });
});

test("invitation error composition", async ({ page }) => {
  await page.route("**/api/session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(discordSession("discord:111", "Synthetic Inviter")),
  }));
  await page.goto("/invite.html");
  await expect(page.locator("#invite-claim-status")).toHaveText("The invitation could not be claimed.");
  await settlePage(page);
  await expect(page).toHaveScreenshot("invitation-claim-error.png", { fullPage: true });
});
