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
  await mkdir("visual-results/spider-solitaire-review", { recursive: true });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/spider-solitaire.html");
  await page.evaluate((key) => localStorage.removeItem(key), saveKey);
  await page.reload();

  await expect(page.locator("#gameframe-destination-bar")).toBeVisible();
  await expect(page.locator(".spider-scorebar")).toBeVisible();
  await expect(page.locator(".completed-slot")).toHaveCount(8);
  await expect(page.locator("#stock-pile .stock-card-back")).toHaveCount(5);

  const presentation = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const faceUp = getComputedStyle(document.querySelector(".spider-card.is-face-up"));
    const faceDown = getComputedStyle(document.querySelector(".spider-card.is-face-down"));
    const navRect = document.querySelector("#gameframe-destination-bar").getBoundingClientRect();
    const shellRect = document.querySelector(".spider-shell").getBoundingClientRect();
    const surfaceRect = document.querySelector(".spider-table-surface").getBoundingClientRect();
    const scrollerRect = document.querySelector(".spider-board-scroller").getBoundingClientRect();
    return {
      bodyBackground: body.backgroundImage,
      faceUpBackground: faceUp.backgroundImage,
      faceDownBackground: faceDown.backgroundImage,
      boardWidth: document.querySelector("#spider-board").getBoundingClientRect().width,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      shellLeft: shellRect.left,
      shellRight: shellRect.right,
      navBottom: navRect.bottom,
      shellTop: shellRect.top,
      shellBottom: shellRect.bottom,
      shellHeight: shellRect.height,
      surfaceRight: surfaceRect.right,
      scrollerBottom: scrollerRect.bottom,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
    };
  });

  expect(presentation.bodyBackground).toContain("gradient");
  expect(presentation.faceUpBackground).toContain("gradient");
  expect(presentation.faceDownBackground).toContain("gradient");
  expect(presentation.boardWidth).toBeLessThanOrEqual(presentation.viewportWidth);
  expect(presentation.shellLeft).toBeGreaterThanOrEqual(-1);
  expect(presentation.shellRight).toBeLessThanOrEqual(presentation.viewportWidth + 1);
  expect(presentation.shellRight).toBeGreaterThanOrEqual(presentation.viewportWidth - 1);
  expect(presentation.shellTop).toBeGreaterThanOrEqual(presentation.navBottom - 1);
  expect(presentation.shellBottom).toBeLessThanOrEqual(presentation.viewportHeight + 1);
  expect(presentation.scrollerBottom).toBeLessThanOrEqual(presentation.viewportHeight + 1);
  expect(presentation.surfaceRight).toBeGreaterThanOrEqual(presentation.viewportWidth - 1);
  expect(presentation.documentWidth).toBeLessThanOrEqual(presentation.viewportWidth + 1);
  expect(presentation.documentHeight).toBeLessThanOrEqual(presentation.viewportHeight + 1);

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
    expect(card.overlapReveal).toBeGreaterThanOrEqual(29);
    expect(card.overlapReveal).toBeLessThanOrEqual(35);
    expect(card.rankBottom).toBeLessThanOrEqual(card.nextTop + 1);
    expect(card.rankFontSize).toBeGreaterThanOrEqual(34);
  }

  await page.screenshot({
    path: "visual-results/spider-solitaire-review/spider-solitaire-desktop-1366x768.png",
    fullPage: false,
  });
});

test("Spider Solitaire keeps every covered desktop rank visible in a long in-progress stack", async ({ page }) => {
  await mkdir("visual-results/spider-solitaire-review", { recursive: true });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/spider-solitaire.html");
  await page.evaluate((key) => {
    const saved = JSON.parse(localStorage.getItem(key));
    const target = saved.state.tableau[0];
    for (let sourceIndex = 1; sourceIndex < saved.state.tableau.length && target.length < 18; sourceIndex += 1) {
      const source = saved.state.tableau[sourceIndex];
      while (source.length > 1 && target.length < 18) target.push(source.shift());
    }
    for (const card of target) card.faceUp = true;
    for (const column of saved.state.tableau) {
      if (column.length) column[column.length - 1].faceUp = true;
    }
    localStorage.setItem(key, JSON.stringify(saved));
  }, saveKey);
  await page.reload();

  const stackEvidence = await page.evaluate(() => {
    const nav = document.querySelector("#gameframe-destination-bar").getBoundingClientRect();
    const shell = document.querySelector(".spider-shell").getBoundingClientRect();
    const scroller = document.querySelector(".spider-board-scroller").getBoundingClientRect();
    const cards = [...document.querySelector(".spider-column").querySelectorAll(".spider-card.is-face-up")];
    return {
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      navBottom: nav.bottom,
      shellTop: shell.top,
      shellBottom: shell.bottom,
      lastBottom: cards.at(-1).getBoundingClientRect().bottom,
      lastHeight: cards.at(-1).getBoundingClientRect().height,
      scrollerBottom: scroller.bottom,
      cards: cards.slice(0, -1).map((card, index) => {
        const next = cards[index + 1];
        const cardRect = card.getBoundingClientRect();
        const nextRect = next.getBoundingClientRect();
        const rank = card.querySelector(".card-rank");
        const suit = card.querySelector(".card-suit");
        const rankRect = rank.getBoundingClientRect();
        const suitRect = suit.getBoundingClientRect();
        return {
          rank: rank.textContent,
          reveal: nextRect.top - cardRect.top,
          rankBottom: rankRect.bottom,
          suitBottom: suitRect.bottom,
          nextTop: nextRect.top,
          rankFontSize: Number.parseFloat(getComputedStyle(rank).fontSize),
        };
      }),
    };
  });

  expect(stackEvidence.cards.length).toBeGreaterThanOrEqual(17);
  expect(stackEvidence.documentWidth).toBeLessThanOrEqual(stackEvidence.viewportWidth + 1);
  expect(stackEvidence.documentHeight).toBeLessThanOrEqual(stackEvidence.viewportHeight + 1);
  expect(stackEvidence.shellTop).toBeGreaterThanOrEqual(stackEvidence.navBottom - 1);
  expect(stackEvidence.shellBottom).toBeLessThanOrEqual(stackEvidence.viewportHeight + 1);
  expect(stackEvidence.scrollerBottom).toBeLessThanOrEqual(stackEvidence.viewportHeight + 1);
  expect(stackEvidence.lastBottom).toBeLessThanOrEqual(stackEvidence.scrollerBottom + 1);
  expect(stackEvidence.lastHeight).toBeGreaterThanOrEqual(110);
  for (const card of stackEvidence.cards) {
    expect(card.rank).toMatch(/^(A|[2-9]|10|J|Q|K)$/);
    expect(card.rankBottom).toBeLessThanOrEqual(card.nextTop + 1);
    expect(card.suitBottom).toBeLessThanOrEqual(card.nextTop + 1);
    expect(card.rankFontSize).toBeGreaterThanOrEqual(27);
  }

  await page.screenshot({
    path: "visual-results/spider-solitaire-review/spider-solitaire-desktop-long-stack-1366x768.png",
    fullPage: false,
  });
});

test("Spider Solitaire fits all ten tableau columns on a phone and keeps covered ranks readable", async ({ page }) => {
  await mkdir("visual-results/spider-solitaire-review", { recursive: true });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/spider-solitaire.html");
  await page.evaluate((key) => localStorage.removeItem(key), saveKey);
  await page.reload();

  const before = await page.evaluate(() => {
    const navRect = document.querySelector("#gameframe-destination-bar").getBoundingClientRect();
    const shellRect = document.querySelector(".spider-shell").getBoundingClientRect();
    const scrollerRect = document.querySelector(".spider-board-scroller").getBoundingClientRect();
    return {
      bodyWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      navBottom: navRect.bottom,
      shellLeft: shellRect.left,
      shellRight: shellRect.right,
      shellTop: shellRect.top,
      shellBottom: shellRect.bottom,
      shellHeight: shellRect.height,
      scrollerBottom: scrollerRect.bottom,
      scrollerWidth: document.querySelector(".spider-board-scroller").scrollWidth,
      scrollerClientWidth: document.querySelector(".spider-board-scroller").clientWidth,
      documentHeight: document.documentElement.scrollHeight,
      columns: [...document.querySelectorAll(".spider-column")].map((column) => {
        const rect = column.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width };
      }),
    };
  });

  expect(before.bodyWidth).toBeLessThanOrEqual(before.viewportWidth + 1);
  expect(before.documentHeight).toBeLessThanOrEqual(before.viewportHeight + 1);
  expect(before.shellLeft).toBeGreaterThanOrEqual(-1);
  expect(before.shellRight).toBeGreaterThanOrEqual(before.viewportWidth - 1);
  expect(before.shellRight).toBeLessThanOrEqual(before.viewportWidth + 1);
  expect(before.shellTop).toBeGreaterThanOrEqual(before.navBottom - 1);
  expect(before.shellBottom).toBeLessThanOrEqual(before.viewportHeight + 1);
  expect(before.scrollerBottom).toBeLessThanOrEqual(before.viewportHeight + 1);
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
      const rankElement = covered.querySelector(".card-rank");
      const rank = rankElement.getBoundingClientRect();
      return {
        overlapReveal: topRect.top - coveredRect.top,
        rankBottom: rank.bottom,
        nextTop: topRect.top,
        rankText: rankElement.textContent,
        rankFontSize: Number.parseFloat(getComputedStyle(rankElement).fontSize),
      };
    });
  });

  for (const card of exposed) {
    expect(card).toBeTruthy();
    expect(card.overlapReveal).toBeGreaterThanOrEqual(20);
    expect(card.overlapReveal).toBeLessThanOrEqual(27);
    expect(card.rankBottom).toBeLessThanOrEqual(card.nextTop + 1);
    expect(card.rankText).toMatch(/^(A|[2-9]|10|J|Q|K)$/);
    expect(card.rankFontSize).toBeGreaterThanOrEqual(22);
  }

  await page.screenshot({
    path: "visual-results/spider-solitaire-review/spider-solitaire-mobile-360x800.png",
    fullPage: false,
  });
});

test("Spider Solitaire keeps a long mobile stack fully visible with old-eye ranks", async ({ page }) => {
  await mkdir("visual-results/spider-solitaire-review", { recursive: true });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/spider-solitaire.html");
  await page.evaluate((key) => {
    const saved = JSON.parse(localStorage.getItem(key));
    const target = saved.state.tableau[0];
    for (let sourceIndex = 1; sourceIndex < saved.state.tableau.length && target.length < 20; sourceIndex += 1) {
      const source = saved.state.tableau[sourceIndex];
      while (source.length > 1 && target.length < 20) target.push(source.shift());
    }
    for (const card of target) card.faceUp = true;
    for (const column of saved.state.tableau) {
      if (column.length) column[column.length - 1].faceUp = true;
    }
    localStorage.setItem(key, JSON.stringify(saved));
  }, saveKey);
  await page.reload();

  const evidence = await page.evaluate(() => {
    const nav = document.querySelector("#gameframe-destination-bar").getBoundingClientRect();
    const shell = document.querySelector(".spider-shell").getBoundingClientRect();
    const scroller = document.querySelector(".spider-board-scroller").getBoundingClientRect();
    const cards = [...document.querySelector(".spider-column").querySelectorAll(".spider-card.is-face-up")];
    return {
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      navBottom: nav.bottom,
      shellTop: shell.top,
      shellBottom: shell.bottom,
      lastBottom: cards.at(-1).getBoundingClientRect().bottom,
      lastHeight: cards.at(-1).getBoundingClientRect().height,
      scrollerBottom: scroller.bottom,
      cards: cards.slice(0, -1).map((card, index) => {
        const next = cards[index + 1];
        const rank = card.querySelector(".card-rank");
        return {
          nextTop: next.getBoundingClientRect().top,
          rankBottom: rank.getBoundingClientRect().bottom,
          rankFontSize: Number.parseFloat(getComputedStyle(rank).fontSize),
        };
      }),
    };
  });

  expect(evidence.cards.length).toBeGreaterThanOrEqual(19);
  expect(evidence.documentWidth).toBeLessThanOrEqual(evidence.viewportWidth + 1);
  expect(evidence.documentHeight).toBeLessThanOrEqual(evidence.viewportHeight + 1);
  expect(evidence.shellTop).toBeGreaterThanOrEqual(evidence.navBottom - 1);
  expect(evidence.shellBottom).toBeLessThanOrEqual(evidence.viewportHeight + 1);
  expect(evidence.scrollerBottom).toBeLessThanOrEqual(evidence.viewportHeight + 1);
  expect(evidence.lastBottom).toBeLessThanOrEqual(evidence.scrollerBottom + 1);
  expect(evidence.lastHeight).toBeGreaterThanOrEqual(79);
  for (const card of evidence.cards) {
    expect(card.rankBottom).toBeLessThanOrEqual(card.nextTop + 1);
    expect(card.rankFontSize).toBeGreaterThanOrEqual(22);
  }

  await page.screenshot({
    path: "visual-results/spider-solitaire-review/spider-solitaire-mobile-long-stack-360x800.png",
    fullPage: false,
  });
});


test("one-suit Spider prioritizes giant ranks with a small spade cue", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/spider-solitaire.html");
  await page.evaluate((key) => localStorage.removeItem(key), saveKey);
  await page.reload();

  const face = await page.evaluate(() => {
    const board = document.querySelector("#spider-board");
    const card = document.querySelector(".spider-card.is-face-up");
    const rank = card.querySelector(".card-rank");
    const suit = card.querySelector(".card-suit");
    const rankStyle = getComputedStyle(rank);
    const suitStyle = getComputedStyle(suit);
    return {
      difficulty: board.dataset.difficulty,
      rankSize: Number.parseFloat(rankStyle.fontSize),
      suitSize: Number.parseFloat(suitStyle.fontSize),
      suitText: suit.textContent,
      centerVisible: getComputedStyle(card.querySelector(".card-center")).display !== "none",
    };
  });

  expect(face.difficulty).toBe("1");
  expect(face.rankSize).toBeGreaterThanOrEqual(22);
  expect(face.suitSize).toBeLessThanOrEqual(9);
  expect(face.suitText).toBe("♠");
  expect(face.centerVisible).toBe(false);
});
