import { test, expect } from "@playwright/test";

const saveKey = "scribbles-gameframe.spider-solitaire:v1";

test("Spider Solitaire loads, persists a stock deal, and restarts the same seeded deal", async ({ page }) => {
  await page.goto("/spider-solitaire.html");
  await page.evaluate((key) => localStorage.removeItem(key), saveKey);
  await page.reload();

  await expect(page.getByRole("heading", { name: "Spider Solitaire" })).toBeVisible();
  await expect(page.locator("#spider-board .spider-column")).toHaveCount(10);
  await expect(page.locator("#spider-board .spider-card")).toHaveCount(54);
  await expect(page.locator("#spider-board .spider-card.is-face-up")).toHaveCount(10);
  await expect(page.locator("#stock-count")).toHaveText("5");
  await expect(page.locator("#move-count")).toHaveText("0");

  const dealId = (await page.locator("#deal-id").textContent())?.trim();
  expect(dealId).toBeTruthy();

  await page.locator("#deal-stock").click();
  await expect(page.locator("#stock-count")).toHaveText("4");
  await expect(page.locator("#move-count")).toHaveText("1");
  await expect(page.locator("#spider-board .spider-card")).toHaveCount(64);

  await page.reload();
  await expect(page.locator("#stock-count")).toHaveText("4");
  await expect(page.locator("#move-count")).toHaveText("1");
  await expect(page.locator("#deal-id")).toHaveText(dealId);
  await expect(page.getByRole("status")).toContainText("Saved deal resumed");

  await page.locator("#restart-game").click();
  await expect(page.locator("#stock-count")).toHaveText("5");
  await expect(page.locator("#move-count")).toHaveText("0");
  await expect(page.locator("#spider-board .spider-card")).toHaveCount(54);
  await expect(page.locator("#deal-id")).toHaveText(dealId);
});
