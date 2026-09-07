import { mkdir } from "node:fs/promises";
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


test("Spider Solitaire presents the classic felt table on desktop", async ({ page }) => {
  await mkdir("visual-results/player-ui-review", { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/spider-solitaire.html");
  await page.evaluate((key) => localStorage.removeItem(key), saveKey);
  await page.reload();

  await expect(page.locator(".spider-scorebar")).toBeVisible();
  await expect(page.locator(".completed-slot")).toHaveCount(8);
  await expect(page.locator("#stock-pile .stock-card-back")).toHaveCount(5);

  const presentation = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const faceUp = getComputedStyle(document.querySelector(".spider-card.is-face-up"));
    const faceDown = getComputedStyle(document.querySelector(".spider-card.is-face-down"));
    const shellRect = document.querySelector(".spider-shell").getBoundingClientRect();
    const surfaceRect = document.querySelector(".spider-table-surface").getBoundingClientRect();
    return {
      bodyBackground: body.backgroundImage,
      faceUpBackground: faceUp.backgroundImage,
      faceDownBackground: faceDown.backgroundImage,
      boardWidth: document.querySelector("#spider-board").getBoundingClientRect().width,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      shellLeft: shellRect.left,
      shellRight: shellRect.right,
      shellHeight: shellRect.height,
      surfaceRight: surfaceRect.right,
    };
  });

  expect(presentation.bodyBackground).toContain("gradient");
  expect(presentation.faceUpBackground).toContain("gradient");
  expect(presentation.faceDownBackground).toContain("gradient");
  expect(presentation.boardWidth).toBeLessThanOrEqual(presentation.viewportWidth);
  expect(presentation.shellLeft).toBeGreaterThanOrEqual(-1);
  expect(presentation.shellRight).toBeLessThanOrEqual(presentation.viewportWidth + 1);
  expect(presentation.shellRight).toBeGreaterThanOrEqual(presentation.viewportWidth - 1);
  expect(presentation.shellHeight).toBeGreaterThanOrEqual(presentation.viewportHeight);
  expect(presentation.surfaceRight).toBeGreaterThanOrEqual(presentation.viewportWidth - 1);

  await page.locator("#deal-stock").click();
  await expect(page.locator("#stock-count")).toHaveText("4");

  const exposedDesktopRanks = await page.evaluate(() => {
    return [...document.querySelectorAll(".spider-column")].map((column) => {
      const faceUp = [...column.querySelectorAll(".spider-card.is-face-up")];
      const covered = faceUp.at(-2);
      const top = faceUp.at(-1);
      if (!covered || !top) return null;
      const coveredRect = covered.getBoundingClientRect();
      const topRect = top.getBoundingClientRect();
      const rank = covered.querySelector(".card-rank");
      const rankRect = rank.getBoundingClientRect();
      return {
        overlapReveal: topRect.top - coveredRect.top,
        rankBottom: rankRect.bottom,
        nextTop: topRect.top,
        rankFontSize: Number.parseFloat(getComputedStyle(rank).fontSize),
      };
    });
  });

  for (const card of exposedDesktopRanks) {
    expect(card).toBeTruthy();
    expect(card.overlapReveal).toBeGreaterThanOrEqual(35);
    expect(card.overlapReveal).toBeLessThanOrEqual(37);
    expect(card.rankBottom).toBeLessThanOrEqual(card.nextTop + 1);
    expect(card.rankFontSize).toBeGreaterThanOrEqual(24);
  }

  await page.screenshot({
    path: "visual-results/player-ui-review/spider-solitaire-desktop-1280x900.png",
    fullPage: true,
  });
});

test("Spider Solitaire fits all ten tableau columns on a phone and keeps covered ranks readable", async ({ page }) => {
  await mkdir("visual-results/player-ui-review", { recursive: true });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/spider-solitaire.html");
  await page.evaluate((key) => localStorage.removeItem(key), saveKey);
  await page.reload();

  const before = await page.evaluate(() => {
    const shellRect = document.querySelector(".spider-shell").getBoundingClientRect();
    return {
      bodyWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      shellLeft: shellRect.left,
      shellRight: shellRect.right,
      shellHeight: shellRect.height,
      scrollerWidth: document.querySelector(".spider-board-scroller").scrollWidth,
      scrollerClientWidth: document.querySelector(".spider-board-scroller").clientWidth,
      columns: [...document.querySelectorAll(".spider-column")].map((column) => {
        const rect = column.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width };
      }),
    };
  });

  expect(before.bodyWidth).toBeLessThanOrEqual(before.viewportWidth + 1);
  expect(before.shellLeft).toBeGreaterThanOrEqual(-1);
  expect(before.shellRight).toBeGreaterThanOrEqual(before.viewportWidth - 1);
  expect(before.shellRight).toBeLessThanOrEqual(before.viewportWidth + 1);
  expect(before.shellHeight).toBeGreaterThanOrEqual(before.viewportHeight);
  expect(before.scrollerWidth).toBeLessThanOrEqual(before.scrollerClientWidth + 1);
  expect(before.columns).toHaveLength(10);
  expect(before.columns[0].left).toBeGreaterThanOrEqual(-1);
  expect(before.columns[9].right).toBeLessThanOrEqual(361);
  expect(Math.min(...before.columns.map((column) => column.width))).toBeGreaterThan(30);

  await page.locator("#deal-stock").click();
  await expect(page.locator("#stock-count")).toHaveText("4");
  await expect(page.locator("#stock-pile .stock-card-back")).toHaveCount(4);

  const exposed = await page.evaluate(() => {
    return [...document.querySelectorAll(".spider-column")].map((column) => {
      const faceUp = [...column.querySelectorAll(".spider-card.is-face-up")];
      const covered = faceUp.at(-2);
      const top = faceUp.at(-1);
      if (!covered || !top) return null;
      const coveredRect = covered.getBoundingClientRect();
      const topRect = top.getBoundingClientRect();
      const rank = covered.querySelector(".card-rank").getBoundingClientRect();
      return {
        overlapReveal: topRect.top - coveredRect.top,
        rankBottom: rank.bottom,
        nextTop: topRect.top,
        rankText: covered.querySelector(".card-rank").textContent,
      };
    });
  });

  for (const card of exposed) {
    expect(card).toBeTruthy();
    expect(card.overlapReveal).toBeGreaterThanOrEqual(20);
    expect(card.overlapReveal).toBeLessThanOrEqual(23);
    expect(card.rankBottom).toBeLessThanOrEqual(card.nextTop + 1);
    expect(card.rankText).toMatch(/^(A|[2-9]|10|J|Q|K)$/);
  }

  await page.screenshot({
    path: "visual-results/player-ui-review/spider-solitaire-mobile-360x800.png",
    fullPage: true,
  });
});
