import { expect, test } from "@playwright/test";

function uniquePlayer(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function selectActiveUnit(page) {
  const canvas = page.locator("#tactical-canvas");
  await canvas.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#tactical-destinations button").first()).toBeVisible();
}

async function moveFirstDestination(page) {
  await selectActiveUnit(page);
  await page.locator("#tactical-destinations button").first().click();
}

test("plays, pans, zooms, and resumes the tactical movement canary against ArenaBot", async ({ page }) => {
  const player = uniquePlayer("tactical-browser");
  await page.goto(`/tactical.html?player=${encodeURIComponent(player)}`);
  await page.getByRole("button", { name: "Race ArenaBot" }).click();

  await expect(page.locator("#tactical-match")).toBeVisible();
  await expect(page.locator("#tactical-canvas")).toBeVisible();
  await expect(page.locator("#tactical-revision")).toHaveText("Revision 0");
  await expect(page.locator("#tactical-round")).toHaveText("1");
  await expect(page.locator("#tactical-viewport-label")).toContainText("12×9");

  const beforePan = await page.locator("#tactical-viewport-label").textContent();
  await page.getByRole("button", { name: "Pan camera east" }).click();
  await expect(page.locator("#tactical-viewport-label")).not.toHaveText(beforePan);

  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.locator("#tactical-viewport-label")).toContainText("1.25×");
  await page.getByRole("button", { name: "Active" }).click();

  await moveFirstDestination(page);
  await expect(page.locator("#tactical-revision")).toHaveText("Revision 2");
  await expect(page.locator("#tactical-status")).toContainText("Your activation");
  const matchId = await page.locator("#tactical-match-id").textContent();

  await page.reload();
  await expect(page.locator("#tactical-match")).toBeVisible();
  await expect(page.locator("#tactical-revision")).toHaveText("Revision 2");
  await expect(page.locator("#tactical-match-id")).toHaveText(matchId);
  await expect(page.locator("#tactical-canvas")).toBeVisible();
});

test("two browser seats share and advance one tactical movement match", async ({ browser }) => {
  const alphaContext = await browser.newContext();
  const betaContext = await browser.newContext();
  const alpha = await alphaContext.newPage();
  const beta = await betaContext.newPage();

  try {
    await alpha.goto(`/tactical.html?player=${encodeURIComponent(uniquePlayer("tactical-alpha"))}`);
    await alpha.getByRole("button", { name: "Race a friend" }).click();
    await expect(alpha.locator("#tactical-invite-panel")).toBeVisible();
    const invite = await alpha.locator("#tactical-invite-link").inputValue();
    expect(invite).toContain("tactical.html");

    await beta.goto(invite);
    await expect(beta.locator("#tactical-match")).toBeVisible();
    await expect(beta.locator("#tactical-revision")).toHaveText("Revision 0");

    await moveFirstDestination(alpha);
    await expect(beta.locator("#tactical-status")).toContainText("Your activation");
    await moveFirstDestination(beta);
    await expect(alpha.locator("#tactical-revision")).toHaveText("Revision 2");

    await beta.reload();
    await expect(beta.locator("#tactical-revision")).toHaveText("Revision 2");
  } finally {
    await alphaContext.close();
    await betaContext.close();
  }
});

test("tactical Canvas controls remain usable without horizontal overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/tactical.html?player=${encodeURIComponent(uniquePlayer("tactical-mobile"))}`);
  await page.getByRole("button", { name: "Race ArenaBot" }).click();

  await expect(page.locator("#tactical-canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pan camera north" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom in" })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  await selectActiveUnit(page);
  await expect(page.locator("#tactical-destinations button").first()).toBeVisible();
});
