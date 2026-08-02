import { expect, test } from "@playwright/test";

test("Othello product surface exposes all procedural themes and playable legal moves", async ({ page }) => {
  await page.goto("/othello.html?theme=obsidian&state=opening");
  await expect(page.getByRole("heading", { name: "Othello" })).toBeVisible();
  await expect(page.locator("#legal-count")).toHaveText("4");
  await expect(page.locator("canvas")).toBeVisible();

  await page.getByRole("button", { name: "Neon Circuit" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-theme", "neon");
  await expect(page.locator("#theme-title")).toHaveText("Neon Circuit");

  await page.getByRole("button", { name: "Play one move" }).click();
  await expect(page.locator("#move-number")).toHaveText("1 / 60");

  await page.getByRole("button", { name: "Living Garden" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-theme", "garden");
});

test("desktop shell reserves the Discord user-overlay safe zone", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/othello.html?theme=obsidian&state=midgame");

  const overlap = await page.evaluate(() => {
    const safe = document.querySelector("#discord-safe-zone").getBoundingClientRect();
    const candidates = [
      document.querySelector(".brand-lockup"),
      document.querySelector(".play-layout"),
      document.querySelector(".command-bar"),
    ].map((element) => element.getBoundingClientRect());
    return candidates.some((rect) => rect.left < safe.right && rect.right > safe.left && rect.top < safe.bottom && rect.bottom > safe.top);
  });
  expect(overlap).toBe(false);
});

test("Othello mobile surface remains horizontally bounded", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/othello.html?theme=garden&state=midgame");
  await expect(page.locator("canvas")).toBeVisible();
  const bounds = await page.evaluate(() => ({
    scrollWidth: document.scrollingElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.viewportWidth + 2);
});
