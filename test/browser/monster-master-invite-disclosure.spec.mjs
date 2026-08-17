import { expect, test } from "@playwright/test";

test("keeps the local Monster Master invite available without expanding it over gameplay", async ({ page }) => {
  await page.goto("/monster-master.html?player=monster-master-invite-disclosure");
  await page.locator("#monster-master-human").click();

  const disclosure = page.locator("#monster-master-invite-panel");
  await expect(disclosure).toBeVisible();
  await expect(disclosure).not.toHaveAttribute("open", "");
  await expect(disclosure.locator("summary")).toHaveText("Second-trainer battle invite");

  await disclosure.locator("summary").dispatchEvent("click");
  await expect(disclosure).toHaveAttribute("open", "");
  await expect(page.locator("#monster-master-invite-link")).toHaveValue(/monster-master\.html.*match=/);
  await expect(page.locator("#monster-master-copy-invite")).toBeVisible();

  await disclosure.locator("summary").dispatchEvent("click");
  await expect(disclosure).not.toHaveAttribute("open", "");
});
