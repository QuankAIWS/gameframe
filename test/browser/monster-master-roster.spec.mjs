import { expect, test } from "@playwright/test";

const trainerContentIds = new Set([
  "vanguard-trainer-v1",
  "commander-trainer-v1",
  "arcanic-trainer-v1",
  "medic-trainer-v1",
  "caller-trainer-v1",
]);

test("Arena picker uses approved art and starts the selected roster", async ({ page }) => {
  await page.goto("/monster-master.html?player=monster-roster-picker");

  const picker = page.locator("#monster-master-roster-builder");
  await expect(picker).toBeVisible();
  await expect(picker.locator(".mm-roster-card")).toHaveCount(10);
  await expect(picker.locator('img[src*="/assets/monster-master/trainers/"]')).toHaveCount(5);
  await expect(picker.locator('img[src*="/assets/monster-master/creatures/"]')).toHaveCount(5);

  await picker.locator('[data-content-id="caller-trainer-v1"]').click();
  await picker.locator('[data-content-id="voidshard-reaver-v1"]').click();
  await picker.locator('[data-content-id="mossmaw-colossus-v1"]').click();

  await expect(picker.locator('[data-content-id="caller-trainer-v1"]')).toHaveAttribute("aria-pressed", "true");
  await expect(picker.locator('[data-content-id="voidshard-reaver-v1"]')).toHaveAttribute("aria-pressed", "true");
  await expect(picker.locator('[data-content-id="mossmaw-colossus-v1"]')).toHaveAttribute("aria-pressed", "true");
  await expect(picker.locator('[aria-pressed="true"]')).toHaveCount(4);

  await page.locator("#monster-master-bot").click();
  await expect(page.locator("body.monster-master-match-active")).toBeVisible();
  await expect(page.locator("#monster-master-roster-list")).toContainText("Caller");
  await expect(page.locator("#monster-master-roster-list")).toContainText("Voidshard Reaver");
  await expect(page.locator("#monster-master-roster-list")).toContainText("Mossmaw Colossus");

  const rosters = await page.evaluate(() => window.gameFrameMonsterController.getView().observation.rosters);
  const human = rosters["monster-roster-picker"];
  const bot = rosters["gameframe-bot"];
  expect(human.map((unit) => unit.contentId)).toEqual([
    "caller-trainer-v1",
    "stormcrest-skitter-v1",
    "voidshard-reaver-v1",
    "mossmaw-colossus-v1",
  ]);
  expect(bot).toHaveLength(4);
  expect(trainerContentIds.has(bot[0].contentId)).toBe(true);
  expect(new Set(bot.slice(1).map((unit) => unit.contentId)).size).toBe(3);
});
