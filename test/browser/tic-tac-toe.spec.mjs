import { expect, test } from "@playwright/test";

function uniquePlayer(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function waitForEnabledCell(page, cell) {
  const target = page.locator(`[data-cell="${cell}"]`);
  await expect(target).toBeEnabled();
  return target;
}

test("completes and resumes a deterministic match against CPU Opponent", async ({ page }) => {
  const player = uniquePlayer("browser-test");
  await page.goto(`/?player=${encodeURIComponent(player)}`);

  await expect(page.getByRole("heading", { name: "Tic-Tac-Toe" })).toBeVisible();
  await page.getByRole("button", { name: "Challenge CPU Opponent" }).click();
  await expect(page.locator("#match-panel")).toBeVisible();
  await expect(page.locator("#revision")).toContainText("Revision 0");

  const firstMove = page.locator(".cell:enabled").first();
  await firstMove.click();
  await expect(page.locator("#revision")).not.toContainText("Revision 0");
  const marksBeforeRefresh = await page.locator(".cell[data-mark]:not([data-mark=''])").count();
  expect(marksBeforeRefresh).toBeGreaterThanOrEqual(2);

  await page.reload();
  await expect(page.locator("#match-panel")).toBeVisible();
  await expect(page.locator(".cell[data-mark]:not([data-mark=''])")).toHaveCount(marksBeforeRefresh);

  for (let turn = 0; turn < 6; turn += 1) {
    const status = await page.locator("#status").textContent();
    if (status?.includes("Match complete")) break;
    const legal = page.locator(".cell:enabled");
    if (await legal.count() === 0) break;
    await legal.first().click();
    await expect(page.locator("#status")).not.toHaveText("Submitting move…");
  }

  await expect(page.locator("#status")).toContainText(/Match complete|Draw/);
  await expect(page.locator(".cell:enabled")).toHaveCount(0);
});

test("two browser seats can share, refresh, and complete one match", async ({ browser }) => {
  const creatorContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const creator = await creatorContext.newPage();
  const guest = await guestContext.newPage();

  try {
    await creator.goto(`/?player=${encodeURIComponent(uniquePlayer("creator"))}`);
    await creator.getByRole("button", { name: "Play with a friend" }).click();
    await expect(creator.locator("#invite-panel")).toBeVisible();
    const invite = await creator.locator("#invite-link").inputValue();
    expect(invite).toContain("match=");
    expect(invite).toContain("player=guest-");

    await guest.goto(invite);
    await expect(guest.locator("#match-panel")).toBeVisible();

    await (await waitForEnabledCell(creator, 0)).click();
    await creator.reload();
    await expect(creator.locator('[data-cell="0"]')).toHaveText("X");

    await (await waitForEnabledCell(guest, 3)).click();
    await (await waitForEnabledCell(creator, 1)).click();
    await (await waitForEnabledCell(guest, 4)).click();
    await (await waitForEnabledCell(creator, 2)).click();

    await expect(creator.locator("#status")).toHaveText("You won. Match complete.");
    await expect(guest.locator("#status")).toHaveText("Opponent won. Match complete.");
    await expect(guest.locator('[data-cell="2"]')).toHaveText("X");
  } finally {
    await creatorContext.close();
    await guestContext.close();
  }
});

test("invalid resume links fail visibly and return to setup", async ({ page }) => {
  await page.goto(`/?player=${encodeURIComponent(uniquePlayer("unknown"))}&match=missing-match`);
  await expect(page.locator("#error-banner")).toContainText("Unknown match");
  await expect(page.locator("#lobby")).toBeVisible();
  await expect(page.locator("#match-panel")).toBeHidden();
});

test("mobile layout remains usable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/?player=${encodeURIComponent(uniquePlayer("mobile"))}`);
  await page.getByRole("button", { name: "Challenge CPU Opponent" }).click();

  await expect(page.locator("#board")).toBeVisible();
  await expect(page.locator(".player-card")).toHaveCount(2);
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
