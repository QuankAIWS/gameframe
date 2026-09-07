import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";

test("CardKit lab keeps every old-eyes rank fully inside its card", async ({ page }) => {
  await mkdir("visual-results/card-kit-review", { recursive: true });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/card-lab.html");

  await expect(page.getByRole("heading", { name: "CardKit Lab" })).toBeVisible();
  await expect(page.locator("#rank-gallery .card-lab-card")).toHaveCount(13);

  const evidence = await page.evaluate(() => {
    return [...document.querySelectorAll("#rank-gallery .card-lab-card")].map((card) => {
      const cardRect = card.getBoundingClientRect();
      const rank = card.querySelector(".card-kit-rank");
      const suit = card.querySelector(".card-kit-suit");
      const rankRect = rank.getBoundingClientRect();
      const suitRect = suit.getBoundingClientRect();
      return {
        rank: rank.textContent,
        cardTop: cardRect.top,
        cardLeft: cardRect.left,
        cardRight: cardRect.right,
        cardBottom: cardRect.bottom,
        rankTop: rankRect.top,
        rankLeft: rankRect.left,
        rankRight: rankRect.right,
        rankBottom: rankRect.bottom,
        suitTop: suitRect.top,
        suitRight: suitRect.right,
      };
    });
  });

  for (const card of evidence) {
    expect(card.rank).toMatch(/^(A|[2-9]|10|J|Q|K)$/);
    expect(card.rankTop).toBeGreaterThanOrEqual(card.cardTop + 1);
    expect(card.rankLeft).toBeGreaterThanOrEqual(card.cardLeft + 1);
    expect(card.rankRight).toBeLessThanOrEqual(card.cardRight - 1);
    expect(card.rankBottom).toBeLessThanOrEqual(card.cardBottom - 1);
    expect(card.suitTop).toBeGreaterThanOrEqual(card.cardTop + 1);
    expect(card.suitRight).toBeLessThanOrEqual(card.cardRight - 1);
  }

  await page.screenshot({
    path: "visual-results/card-kit-review/card-kit-lab-desktop-1366x768.png",
    fullPage: true,
  });
});

test("CardKit phone-width specimen keeps ten columns and readable ranks", async ({ page }) => {
  await mkdir("visual-results/card-kit-review", { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/card-lab.html");

  const evidence = await page.evaluate(() => {
    const tableau = document.querySelector("#phone-tableau");
    const columns = [...tableau.querySelectorAll(".card-lab-phone-column")];
    const ranks = [...tableau.querySelectorAll(".card-kit-rank")];
    return {
      viewportWidth: window.innerWidth,
      tableauWidth: tableau.getBoundingClientRect().width,
      columns: columns.map((column) => column.getBoundingClientRect().width),
      ranks: ranks.map((rank) => {
        const card = rank.closest(".card-lab-card").getBoundingClientRect();
        const rect = rank.getBoundingClientRect();
        return {
          text: rank.textContent,
          size: Number.parseFloat(getComputedStyle(rank).fontSize),
          top: rect.top,
          left: rect.left,
          right: rect.right,
          cardTop: card.top,
          cardLeft: card.left,
          cardRight: card.right,
        };
      }),
    };
  });

  expect(evidence.tableauWidth).toBeLessThanOrEqual(evidence.viewportWidth);
  expect(evidence.columns).toHaveLength(10);
  expect(Math.min(...evidence.columns)).toBeGreaterThan(30);
  for (const rank of evidence.ranks) {
    expect(rank.top).toBeGreaterThanOrEqual(rank.cardTop + 1);
    expect(rank.left).toBeGreaterThanOrEqual(rank.cardLeft + 1);
    expect(rank.right).toBeLessThanOrEqual(rank.cardRight - 1);
    expect(rank.size).toBeGreaterThanOrEqual(rank.text === "10" ? 17 : 20);
  }

  await page.screenshot({
    path: "visual-results/card-kit-review/card-kit-lab-mobile-390x844.png",
    fullPage: true,
  });
});
