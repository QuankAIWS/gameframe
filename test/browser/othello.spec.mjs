import { expect, test } from "@playwright/test";

test("Othello product surface exposes all themes and playable legal moves", async ({ page }) => {
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
  await expect(page.locator("#theme-title")).toHaveText("Living Garden");
});

test("Othello desktop product surfaces preserve the Discord safe zone", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });

  for (const theme of ["obsidian", "neon", "garden"]) {
    await page.goto(`/othello.html?theme=${theme}&state=midgame`);
    const geometry = await page.evaluate(() => {
      const safe = document.querySelector("#discord-safe-zone").getBoundingClientRect();
      const occupied = [
        document.querySelector(".brand-lockup"),
        document.querySelector(".play-layout"),
        document.querySelector(".command-bar"),
      ].map((element) => element.getBoundingClientRect());
      const intersects = occupied.some((rect) => !(
        rect.right <= safe.left || rect.left >= safe.right || rect.bottom <= safe.top || rect.top >= safe.bottom
      ));
      return { safeWidth: safe.width, safeHeight: safe.height, intersects };
    });
    expect(geometry.safeWidth).toBeGreaterThanOrEqual(180);
    expect(geometry.safeHeight).toBeGreaterThanOrEqual(70);
    expect(geometry.intersects).toBe(false);
  }
});

test("Othello mobile surface remains horizontally bounded", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/othello.html?theme=garden&state=midgame");
  await expect(page.locator("canvas")).toBeVisible();
  const bounds = await page.evaluate(() => ({
    scrollWidth: document.scrollingElement.scrollWidth,
    viewportWidth: window.innerWidth,
    canvasWidth: document.querySelector("#othello-board").getBoundingClientRect().width,
    darkRailHeight: document.querySelector(".score-rail-dark").getBoundingClientRect().height,
  }));
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.viewportWidth + 2);
  expect(bounds.canvasWidth).toBeLessThanOrEqual(bounds.viewportWidth - 16);
  expect(bounds.darkRailHeight).toBeLessThanOrEqual(80);
});
