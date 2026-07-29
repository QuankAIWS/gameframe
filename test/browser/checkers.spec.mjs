import { expect, test } from "@playwright/test";

function uniquePlayer(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function selectCheckers(page) {
  await page.locator("#select-checkers").click();
  await expect(page.getByRole("heading", { name: "American Checkers" })).toBeVisible();
}

async function makeCheckersTurn(page) {
  const revision = page.locator("#revision");
  const before = await revision.textContent();
  const piece = page.locator(".checkers-cell.selectable-piece:enabled").first();
  await expect(piece).toBeEnabled();
  await piece.click();

  for (let step = 0; step < 12; step += 1) {
    const destination = page.locator(".checkers-cell.legal-destination:enabled").first();
    await expect(destination).toBeEnabled();
    await destination.click();
    await page.waitForFunction((previousRevision) => {
      const currentRevision = document.querySelector("#revision")?.textContent;
      const continuation = document.querySelector(".checkers-cell.legal-destination:enabled");
      return currentRevision !== previousRevision || Boolean(continuation);
    }, before);
    if (await revision.textContent() !== before) return;
  }
  throw new Error("Checkers turn did not commit after twelve path steps.");
}

test("plays and resumes a deterministic American Checkers match against Theo", async ({ page }) => {
  const player = uniquePlayer("checkers-browser");
  await page.goto(`/?player=${encodeURIComponent(player)}`);
  await selectCheckers(page);
  await page.getByRole("button", { name: "Challenge Theo" }).click();

  await expect(page.locator("#match-panel")).toBeVisible();
  await expect(page.locator("#match-game")).toHaveText("American Checkers");
  await expect(page.locator(".checkers-cell")).toHaveCount(64);
  await expect(page.locator(".piece-black")).toHaveCount(12);
  await expect(page.locator(".piece-red")).toHaveCount(12);
  await expect(page.locator("#revision")).toHaveText("Revision 0");

  await makeCheckersTurn(page);
  await expect(page.locator("#revision")).toHaveText("Revision 2");
  const occupiedBeforeRefresh = await page.locator(".checkers-piece").count();

  await page.reload();
  await expect(page.getByRole("heading", { name: "American Checkers" })).toBeVisible();
  await expect(page.locator("#match-panel")).toBeVisible();
  await expect(page.locator("#revision")).toHaveText("Revision 2");
  await expect(page.locator(".checkers-piece")).toHaveCount(occupiedBeforeRefresh);
  await expect(page.locator(".checkers-cell")).toHaveCount(64);
});

test("two browser seats share, play, and resume one Checkers match", async ({ browser }) => {
  const creatorContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const creator = await creatorContext.newPage();
  const guest = await guestContext.newPage();

  try {
    await creator.goto(`/?player=${encodeURIComponent(uniquePlayer("checkers-creator"))}`);
    await selectCheckers(creator);
    await creator.getByRole("button", { name: "Play with a friend" }).click();
    await expect(creator.locator("#invite-panel")).toBeVisible();
    const invite = await creator.locator("#invite-link").inputValue();
    expect(invite).toContain("game=american-checkers");

    await guest.goto(invite);
    await expect(guest.getByRole("heading", { name: "American Checkers" })).toBeVisible();
    await expect(guest.locator("#match-panel")).toBeVisible();
    await expect(guest.locator(".checkers-cell")).toHaveCount(64);

    await makeCheckersTurn(creator);
    await expect(guest.locator("#status")).toContainText("Your turn");
    await makeCheckersTurn(guest);
    await expect(creator.locator("#revision")).toHaveText("Revision 2");

    await creator.reload();
    await expect(creator.locator("#revision")).toHaveText("Revision 2");
    await expect(creator.locator(".checkers-piece")).toHaveCount(24);
  } finally {
    await creatorContext.close();
    await guestContext.close();
  }
});

test("American Checkers remains usable without horizontal overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/?player=${encodeURIComponent(uniquePlayer("checkers-mobile"))}`);
  await selectCheckers(page);
  await page.getByRole("button", { name: "Challenge Theo" }).click();

  await expect(page.locator(".checkers-cell")).toHaveCount(64);
  await expect(page.locator(".player-card")).toHaveCount(2);
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
