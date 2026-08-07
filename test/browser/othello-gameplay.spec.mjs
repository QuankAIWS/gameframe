import { test, expect } from "@playwright/test";

async function openOthelloMenu(page) {
  await page.goto("/othello.html?theme=obsidian&player=othello-browser-test");
  await expect(page.locator("#gameframe-destination-bar")).toBeVisible();
  await expect(page.locator("#othello-game-menu")).toBeVisible();
  await expect(page.locator("#othello-play-bot")).toBeVisible();
  await expect(page.locator("#othello-play-local")).toBeVisible();
}

async function clickBoardCell(page, row, column) {
  const canvas = page.locator("#othello-board");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Othello canvas has no visible bounding box");

  // Obsidian uses a 72px internal margin and 102px cells on a 960px canvas.
  const internalX = 72 + (column + 0.5) * 102;
  const internalY = 72 + (row + 0.5) * 102;
  await page.mouse.click(
    box.x + internalX * box.width / 960,
    box.y + internalY * box.height / 960,
  );
}

test("Othello pass-and-play alternates legal turns", async ({ page }) => {
  await openOthelloMenu(page);
  await page.locator("#othello-play-local").click();
  await expect(page.locator("#othello-game-menu")).toBeHidden();
  await expect(page.locator("#dark-turn")).toHaveClass(/is-active/);

  await clickBoardCell(page, 2, 3);
  await expect(page.locator("#move-number")).toHaveText("1 / 60");
  await expect(page.locator("#light-turn")).toHaveClass(/is-active/);
  await expect(page.locator("#dark-score")).toHaveText("4");
  await expect(page.locator("#light-score")).toHaveText("1");

  await clickBoardCell(page, 2, 2);
  await expect(page.locator("#move-number")).toHaveText("2 / 60");
  await expect(page.locator("#dark-turn")).toHaveClass(/is-active/);
});

test("Othello GameFrameBot turns continue when persistence is unavailable", async ({ page }) => {
  await openOthelloMenu(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = function unavailableStorageWrite() {
      throw new DOMException("Storage blocked for test", "SecurityError");
    };
  });

  await page.locator("#othello-play-bot").click();
  await expect(page.locator("#othello-game-menu")).toBeHidden();
  await expect(page.locator("body")).toHaveAttribute("data-gameframe-storage-unavailable", "true");

  await clickBoardCell(page, 2, 3);

  // The human move is ply one; GameFrameBot must still answer even though saving threw.
  await expect(page.locator("#move-number")).toHaveText("2 / 60");
  await expect(page.locator("#dark-turn")).toHaveClass(/is-active/);
  await expect(page.locator("#turn-copy")).toContainText("Dark");

  const totalDiscs = Number(await page.locator("#dark-score").textContent())
    + Number(await page.locator("#light-score").textContent());
  expect(totalDiscs).toBe(6);
});
