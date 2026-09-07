import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";

const saveKey = "scribbles-gameframe.spider-solitaire:v1";

test("Spider Solitaire loads, persists a stock deal, and restarts the same seeded deal", async ({ page }) => {
  await page.goto("/spider-solitaire.html");
  await page.evaluate((key) => localStorage.removeItem(key), saveKey);
  await page.reload();

  await expect(page.locator(".spider-page-heading")).toHaveText("Spider Solitaire");
  await expect(page.locator("#spider-board .spider-column")).toHaveCount(10);
  await expect(page.locator("#spider-board .spider-card")).toHaveCount(54);
  await expect(page.locator("#spider-board .spider-card.is-face-up")).toHaveCount(10);
  await expect(page.locator("#stock-count")).toHaveText("5");
  await expect(page.locator("#move-count")).toHaveText("0");

  const dealId = (await page.locator("#deal-id").textContent())?.trim();
  expect(dealId).toBeTruthy();

  await page.locator("#desktop-deal-stock").click();
  await expect(page.locator("#stock-count")).toHaveText("4");
  await expect(page.locator("#move-count")).toHaveText("1");
  await expect(page.locator("#spider-board .spider-card")).toHaveCount(64);

  await page.reload();
  await expect(page.locator("#stock-count")).toHaveText("4");
  await expect(page.locator("#move-count")).toHaveText("1");
  await expect(page.locator("#deal-id")).toHaveText(dealId);
  await expect(page.locator("#status")).toContainText("Saved deal resumed");

  await page.locator("#desktop-restart-game").click();
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
  await expect(page.locator(".spider-desktop-bar")).toBeVisible();
  await expect(page.locator(".spider-scorebar")).toBeHidden();
  await expect(page.locator(".spider-tray")).toBeHidden();
  await expect(page.locator(".spider-desktop-run-slot")).toHaveCount(8);
  await expect(page.locator("#stock-pile .stock-card-back")).toHaveCount(5);

  const presentation = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const faceUp = getComputedStyle(document.querySelector(".spider-card.is-face-up"));
    const faceDown = getComputedStyle(document.querySelector(".spider-card.is-face-down"));
    const navRect = document.querySelector("#gameframe-destination-bar").getBoundingClientRect();
    const desktopBarRect = document.querySelector(".spider-desktop-bar").getBoundingClientRect();
    const shellRect = document.querySelector(".spider-shell").getBoundingClientRect();
    const surfaceRect = document.querySelector(".spider-table-surface").getBoundingClientRect();
    const scrollerRect = document.querySelector(".spider-board-scroller").getBoundingClientRect();
    return {
      bodyBackground: body.backgroundImage,
      faceUpBackground: faceUp.backgroundImage,
      faceUpBackgroundColor: faceUp.backgroundColor,
      faceDownBackground: faceDown.backgroundImage,
      boardWidth: document.querySelector("#spider-board").getBoundingClientRect().width,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      shellLeft: shellRect.left,
      shellRight: shellRect.right,
      navBottom: navRect.bottom,
      desktopBarTop: desktopBarRect.top,
      desktopBarBottom: desktopBarRect.bottom,
      desktopBarHeight: desktopBarRect.height,
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
  expect(presentation.faceUpBackground).toBe("none");
  expect(presentation.faceUpBackgroundColor).toBe("rgb(255, 255, 255)");
  expect(presentation.faceDownBackground).toContain("gradient");
  expect(presentation.boardWidth).toBeLessThanOrEqual(presentation.viewportWidth);
  expect(presentation.shellLeft).toBeGreaterThanOrEqual(-1);
  expect(presentation.shellRight).toBeLessThanOrEqual(presentation.viewportWidth + 1);
  expect(presentation.shellRight).toBeGreaterThanOrEqual(presentation.viewportWidth - 1);
  expect(presentation.shellTop).toBeGreaterThanOrEqual(presentation.navBottom - 1);
  expect(presentation.desktopBarTop).toBeGreaterThanOrEqual(presentation.navBottom - 1);
  expect(presentation.desktopBarHeight).toBeLessThanOrEqual(48);
  expect(presentation.shellBottom).toBeLessThanOrEqual(presentation.viewportHeight + 1);
  expect(presentation.scrollerBottom).toBeLessThanOrEqual(presentation.viewportHeight + 1);
  expect(presentation.surfaceRight).toBeGreaterThanOrEqual(presentation.viewportWidth - 1);
  expect(presentation.documentWidth).toBeLessThanOrEqual(presentation.viewportWidth + 1);
  expect(presentation.documentHeight).toBeLessThanOrEqual(presentation.viewportHeight + 1);

  await page.locator("#desktop-deal-stock").click();
  await expect(page.locator("#stock-count")).toHaveText("4");

  const exposedDesktopRanks = await page.evaluate(() => {
    return [...document.querySelectorAll(".spider-column")].map((column) => {
      const faceUp = [...column.querySelectorAll(".spider-card.is-face-up")];
      const covered = faceUp.at(-2);
      const top = faceUp.at(-1);
      if (!covered || !top) return null;
      const coveredRect = covered.getBoundingClientRect();
      const topRect = top.getBoundingClientRect();
      const rank = covered.querySelector(".card-kit-rank");
      const rankRect = rank.getBoundingClientRect();
      return {
        overlapReveal: topRect.top - coveredRect.top,
        rankBottom: rankRect.bottom,
        nextTop: topRect.top,
        rankText: rank.textContent,
        rankFontSize: Number.parseFloat(getComputedStyle(rank).fontSize),
      };
    });
  });

  for (const card of exposedDesktopRanks) {
    expect(card).toBeTruthy();
    expect(card.overlapReveal).toBeGreaterThanOrEqual(40);
    expect(card.overlapReveal).toBeLessThanOrEqual(45);
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
        const rank = card.querySelector(".card-kit-rank");
        const suit = card.querySelector(".card-kit-suit");
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
  expect(stackEvidence.lastHeight).toBeGreaterThanOrEqual(130);
  for (const card of stackEvidence.cards) {
    expect(card.rank).toMatch(/^(A|[2-9]|10|J|Q|K)$/);
    expect(card.rankBottom).toBeLessThanOrEqual(card.nextTop + 1);
    expect(card.suitBottom).toBeLessThanOrEqual(card.nextTop + 1);
    expect(card.rankFontSize).toBeGreaterThanOrEqual(23);
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
      const rankElement = covered.querySelector(".card-kit-rank");
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
    expect(card.overlapReveal).toBeGreaterThanOrEqual(29);
    expect(card.overlapReveal).toBeLessThanOrEqual(32);
    expect(card.rankBottom).toBeLessThanOrEqual(card.nextTop + 1);
    expect(card.rankText).toMatch(/^(A|[2-9]|10|J|Q|K)$/);
    expect(card.rankFontSize).toBeGreaterThanOrEqual(24);
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
        const rank = card.querySelector(".card-kit-rank");
        return {
          nextTop: next.getBoundingClientRect().top,
          rankBottom: rank.getBoundingClientRect().bottom,
          rankText: rank.textContent,
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
    expect(card.rankFontSize).toBeGreaterThanOrEqual(20);
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
    const rank = card.querySelector(".card-kit-rank");
    const suit = card.querySelector(".card-kit-suit");
    const face = card.querySelector(".card-kit-face");
    const rankStyle = getComputedStyle(rank);
    const suitStyle = getComputedStyle(suit);
    return {
      difficulty: board.dataset.difficulty,
      rankSize: Number.parseFloat(rankStyle.fontSize),
      suitSize: Number.parseFloat(suitStyle.fontSize),
      suitText: suit.textContent,
      oneSuitClass: face.classList.contains("is-one-suit"),
      faceChildCount: face.querySelectorAll("text").length,
    };
  });

  expect(face.difficulty).toBe("1");
  expect(face.rankSize).toBeGreaterThanOrEqual(24);
  expect(face.suitSize).toBeLessThanOrEqual(9);
  expect(face.suitText).toBe("♠");
  expect(face.oneSuitClass).toBe(true);
  expect(face.faceChildCount).toBe(2);
});


test("Spider Solitaire stays inside representative desktop viewports with unclipped CardKit ranks", async ({ page }) => {
  await mkdir("visual-results/spider-solitaire-review", { recursive: true });
  const viewports = [
    { name: "desktop-1024x576", width: 1024, height: 576 },
    { name: "desktop-1280x720", width: 1280, height: 720 },
    { name: "desktop-1920x1080", width: 1920, height: 1080 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/spider-solitaire.html");
    await page.evaluate((key) => localStorage.removeItem(key), saveKey);
    await page.reload();

    const evidence = await page.evaluate(() => {
      const scroller = document.querySelector(".spider-board-scroller").getBoundingClientRect();
      const cards = [...document.querySelectorAll(".spider-card.is-face-up")];
      return {
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollerBottom: scroller.bottom,
        cards: cards.map((card) => {
          const cardRect = card.getBoundingClientRect();
          const rankRect = card.querySelector(".card-kit-rank").getBoundingClientRect();
          return {
            cardTop: cardRect.top,
            cardLeft: cardRect.left,
            cardRight: cardRect.right,
            rankTop: rankRect.top,
            rankLeft: rankRect.left,
            rankRight: rankRect.right,
          };
        }),
      };
    });

    expect(evidence.documentWidth).toBeLessThanOrEqual(evidence.viewportWidth + 1);
    expect(evidence.documentHeight).toBeLessThanOrEqual(evidence.viewportHeight + 1);
    expect(evidence.scrollerBottom).toBeLessThanOrEqual(evidence.viewportHeight + 1);
    for (const card of evidence.cards) {
      expect(card.rankTop).toBeGreaterThanOrEqual(card.cardTop + 1);
      expect(card.rankLeft).toBeGreaterThanOrEqual(card.cardLeft + 1);
      expect(card.rankRight).toBeLessThanOrEqual(card.cardRight - 1);
    }

    await page.screenshot({
      path: `visual-results/spider-solitaire-review/spider-solitaire-${viewport.name}.png`,
      fullPage: false,
    });
  }
});
