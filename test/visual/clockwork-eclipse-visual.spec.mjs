import { expect, test } from "@playwright/test";

async function assertViewportContract(page) {
  const result = await page.evaluate(() => {
    const root = document.documentElement;
    const board = document.querySelector("#board")?.getBoundingClientRect();
    const setup = document.querySelector("#new-match")?.getBoundingClientRect();
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollWidth: root.scrollWidth,
      scrollHeight: root.scrollHeight,
      board,
      setup,
    };
  });
  expect(result.scrollWidth).toBeLessThanOrEqual(result.width + 1);
  expect(result.scrollHeight).toBeLessThanOrEqual(result.height + 1);
  expect(result.board).not.toBeNull();
  expect(result.board.left).toBeGreaterThanOrEqual(-1);
  expect(result.board.top).toBeGreaterThanOrEqual(-1);
  expect(result.board.right).toBeLessThanOrEqual(result.width + 1);
  expect(result.board.bottom).toBeLessThanOrEqual(result.height + 1);
  expect(result.setup).not.toBeNull();
  expect(result.setup.right).toBeLessThanOrEqual(result.width + 1);
  expect(result.setup.bottom).toBeLessThanOrEqual(result.height + 1);
}

async function settle(page) {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

test("Clockwork Eclipse active match obeys the full-viewport contract", async ({ page }, testInfo) => {
  for (const viewport of [
    { width: 1440, height: 960, name: "desktop" },
    { width: 1366, height: 768, name: "short-desktop" },
    { width: 390, height: 844, name: "mobile" },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/?game=american-checkers&player=visual-clockwork-eclipse");
    await page.locator("#challenge-bot").click();
    await expect(page.locator("body")).toHaveClass(/checkers-premium-running/);
    await settle(page);
    await assertViewportContract(page);
    await page.screenshot({
      path: testInfo.outputPath(`40-clockwork-eclipse-${viewport.name}.png`),
      animations: "disabled",
    });
  }
});

test("Clockwork Eclipse preserves authoritative Checkers selection", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/?game=american-checkers&player=visual-clockwork-selection");
  await page.locator("#challenge-bot").click();
  await page.locator(".checkers-cell.selectable-piece").first().click();
  await expect(page.locator(".checkers-cell.legal-destination").first()).toBeVisible();
  await assertViewportContract(page);
  await page.screenshot({
    path: testInfo.outputPath("41-clockwork-eclipse-selection.png"),
    animations: "disabled",
  });
});
