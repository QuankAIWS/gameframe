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
  await expect(page.locator(".garden-pad-a")).toHaveCSS("opacity", "1");
});

test("desktop shell reserves the Discord user-overlay safe zone and preserves the board crown", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/othello.html?theme=garden&state=midgame");

  const geometry = await page.evaluate(() => {
    const safe = document.querySelector("#discord-safe-zone").getBoundingClientRect();
    const candidates = [
      document.querySelector(".brand-lockup"),
      document.querySelector(".play-layout"),
      document.querySelector(".command-bar"),
    ].map((element) => element.getBoundingClientRect());
    const overlap = candidates.some((rect) => (
      rect.left < safe.right
      && rect.right > safe.left
      && rect.top < safe.bottom
      && rect.bottom > safe.top
    ));
    const crown = document.querySelector(".board-crown").getBoundingClientRect();
    return { overlap, crownTop: crown.top, crownHeight: crown.height };
  });

  expect(geometry.overlap).toBe(false);
  expect(geometry.crownTop).toBeGreaterThanOrEqual(0);
  expect(geometry.crownHeight).toBeGreaterThan(30);
});

test("Othello mobile surface remains horizontally bounded with compact score and command rows", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/othello.html?theme=garden&state=midgame");
  await expect(page.locator("canvas")).toBeVisible();

  const bounds = await page.evaluate(() => ({
    scrollWidth: document.scrollingElement.scrollWidth,
    viewportWidth: window.innerWidth,
    darkHeight: document.querySelector(".score-rail-dark").getBoundingClientRect().height,
    lightHeight: document.querySelector(".score-rail-light").getBoundingClientRect().height,
    crownTop: document.querySelector(".board-crown").getBoundingClientRect().top,
  }));

  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.viewportWidth + 2);
  expect(bounds.darkHeight).toBeLessThanOrEqual(72);
  expect(bounds.lightHeight).toBeLessThanOrEqual(72);
  expect(bounds.crownTop).toBeGreaterThanOrEqual(0);
});
