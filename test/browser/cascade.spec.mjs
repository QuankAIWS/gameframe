import { expect, test } from "@playwright/test";

test("Cascade Crush resolves a legal move through the animated presentation layer", async ({ page }) => {
  await page.goto("/cascade.html");

  await expect(page.getByRole("heading", { name: "Cascade Crush", exact: true })).toBeVisible();
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  await expect(page.locator("#level-map > li")).toHaveCount(100);

  const move = await page.evaluate(async () => {
    const { listLegalMoves } = await import("/cascade-engine.js");
    const board = [...document.querySelectorAll(".cascade-tile")]
      .map((tile) => Number(tile.dataset.kind));
    return listLegalMoves(board)[0] ?? null;
  });

  expect(move).toBeTruthy();

  await page.locator(`.cascade-tile[data-index="${move.from}"]`).click();
  await page.locator(`.cascade-tile[data-index="${move.to}"]`).click();

  await expect.poll(async () => {
    const text = await page.locator("#score").textContent();
    return Number(String(text).replaceAll(",", ""));
  }, { timeout: 5_000 }).toBeGreaterThan(0);

  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  await expect(page.locator(".cascade-score-pop, .cascade-burst")).toHaveCount(0, { timeout: 2_000 });
});

test("Cascade late chapters expose ice, collection, cross-blast, and layered ice", async ({ page }) => {
  await page.addInitScript(() => {
    const key = "scribbles-gameframe.cascade-state:v1";
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, JSON.stringify({
      level: 31,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 0,
      hammers: 2,
      ledger: [],
    }));
  });

  await page.goto("/cascade.html");
  await expect(page.locator("#level-number")).toHaveText("31");
  await expect(page.locator(".cascade-tile[data-ice]")).not.toHaveCount(0);
  await expect(page.locator("#objective-label")).toContainText("ice");

  await page.evaluate(() => {
    const key = "scribbles-gameframe.cascade-state:v1";
    const state = JSON.parse(window.localStorage.getItem(key));
    state.level = 41;
    window.localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await expect(page.locator("#level-number")).toHaveText("41");
  await expect.poll(async () => page.evaluate(() => window.cascadeResearch.exportLevel().level.objective.collect.length)).toBe(1);

  await page.evaluate(() => {
    const key = "scribbles-gameframe.cascade-state:v1";
    const state = JSON.parse(window.localStorage.getItem(key));
    state.level = 61;
    window.localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await expect(page.locator(".cascade-help")).toContainText("T/L matches blast a 3×3 area");

  await page.evaluate(() => {
    const key = "scribbles-gameframe.cascade-state:v1";
    const state = JSON.parse(window.localStorage.getItem(key));
    state.level = 71;
    window.localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await expect(page.locator(".cascade-tile[data-ice=\"2\"]")).not.toHaveCount(0);
});

test("Cascade IOU ledger stays a joke ledger with no player-facing gameplay purchases", async ({ page }) => {
  await page.goto("/cascade.html");
  await expect(page.getByRole("button", { name: /IOU\$/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open boosts" })).toHaveCount(0);
  await page.getByRole("button", { name: "View IOUs" }).click();
  await expect(page.locator("#ledger-dialog")).toBeVisible();
  await expect(page.locator("#ledger-dialog")).toContainText("Gameplay boosts are earned now");
  await expect(page.getByRole("button", { name: "Clear IOUs" })).toHaveCount(0);
  await expect(page.locator("#reset-ledger")).toBeHidden();
});

test("Cascade shows a live refill countdown and blocks play at zero lives without a refill purchase", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("scribbles-gameframe.cascade-state:v1", JSON.stringify({
      level: 4,
      lives: 0,
      lastLifeAt: Date.now(),
      streak: 2,
      hammers: 1,
      ledger: [],
    }));
  });

  await page.goto("/cascade.html");
  await expect(page.locator("#lives")).toHaveText("0");
  await expect(page.locator("#life-timer")).toContainText("+1 IN");
  await expect(page.locator("#life-lock")).toBeVisible();
  await expect(page.locator("#life-lock-timer")).toHaveText(/09:5\d|10:00/);
  await expect(page.locator("#life-lock")).toContainText("Lives recharge automatically");
  await expect(page.locator(".cascade-tile").first()).toBeDisabled();
  await expect(page.getByRole("button", { name: /REFILL.*LIVES/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Need a boost?" })).toHaveCount(0);
});

test("Cascade performance awards best stars, quick bonuses, and hammer milestones", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("scribbles-gameframe.cascade-state:v1", JSON.stringify({
      level: 6,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 0,
      hammers: 2,
      ledger: [],
    }));
    window.localStorage.setItem("scribbles-gameframe.cascade-performance:v1", JSON.stringify({
      starsByLevel: { "6": 2 },
      quickWins: {},
      pendingHammerRewards: 0,
    }));
  });

  await page.goto("/cascade.html");
  await expect(page.locator("#level-stars")).toHaveText("★★☆");
  await expect(page.locator("#star-progress")).toContainText("2 total stars");
  await expect(page.locator("#quick-bonus")).toBeVisible();
  await expect(page.locator("#quick-bonus")).toContainText("QUICK BONUS");
  await expect(page.locator('#level-map > li[data-level="6"] .cascade-map-stars')).toHaveText("★★☆");

  const model = await page.evaluate(() => ({
    slow: window.cascadePerformance.calculateStars({ moves: 20, movesRemaining: 1, quickBonus: false }),
    efficient: window.cascadePerformance.calculateStars({ moves: 20, movesRemaining: 6, quickBonus: false }),
    quick: window.cascadePerformance.calculateStars({ moves: 20, movesRemaining: 3, quickBonus: true }),
    quickWindow: window.cascadePerformance.quickBonusSeconds(6),
    milestone: window.cascadePerformance.performanceReward({
      starsByLevel: { "1": 3, "2": 3, "3": 3 },
      level: 4,
      stars: 1,
    }),
  }));

  expect(model.slow).toBe(1);
  expect(model.efficient).toBe(3);
  expect(model.quick).toBe(3);
  expect(model.quickWindow).toBe(75);
  expect(model.milestone.nextTotal).toBe(10);
  expect(model.milestone.hammerRewards).toBe(1);
});

test("Cascade zero-hammer state explains earned boosters instead of selling a bundle", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("scribbles-gameframe.cascade-state:v1", JSON.stringify({
      level: 8,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 0,
      hammers: 0,
      ledger: [],
    }));
  });

  await page.goto("/cascade.html");
  await page.locator("#booster-hammer").click();
  await expect(page.locator("#result-dialog")).toBeVisible();
  await expect(page.locator("#result-kicker")).toHaveText("NO HAMMERS");
  await expect(page.locator("#result-copy")).toContainText("earned through stars");
  await expect(page.getByRole("button", { name: /GET 3 HAMMERS/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Got it" })).toBeVisible();
});

test("Cascade admin console uses the authenticated admin identity to jump through 100 levels and reset IOUs", async ({ page }) => {
  await page.addInitScript(() => {
    const key = "scribbles-gameframe.cascade-state:v1";
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, JSON.stringify({
      level: 1,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 0,
      hammers: 2,
      ledger: [
        { at: new Date().toISOString(), reason: "Admin reset test", amount: 7, level: 1 },
      ],
    }));
  });
  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        playerId: "cascade-admin-test",
        displayName: "Cascade Admin",
        source: "discord",
        admin: true,
      }),
    });
  });

  await page.goto("/cascade.html");
  await expect(page.locator("#iou-total")).toHaveText("IOU$ 7");
  await expect(page.locator("#cascade-admin-open")).toBeVisible();
  await page.locator("#cascade-admin-open").click();
  await expect(page.locator("#cascade-admin-dialog")).toBeVisible();
  await expect(page.locator("#cascade-admin-dialog [data-level=\"100\"]")).toBeVisible();

  const reset = page.getByRole("button", { name: "Reset IOU ledger" });
  await reset.click();
  await expect(page.getByRole("button", { name: "Confirm IOU reset" })).toBeVisible();
  await expect(page.locator("#iou-total")).toHaveText("IOU$ 7");
  await page.getByRole("button", { name: "Confirm IOU reset" }).click();
  await expect(page.locator("#iou-total")).toHaveText("IOU$ 0");
  await expect.poll(async () => page.evaluate(() => {
    const state = JSON.parse(window.localStorage.getItem("scribbles-gameframe.cascade-state:v1") || "null");
    return state?.ledger?.length ?? -1;
  })).toBe(0);

  await page.locator("#cascade-admin-command").fill("go to level 100");
  await page.getByRole("button", { name: "Run" }).click();

  await expect(page.locator("#level-number")).toHaveText("100", { timeout: 5_000 });
  await expect(page.locator("#level-map > li")).toHaveCount(100);
});

test("Cascade admin can force life and inventory edge states", async ({ page }) => {
  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        playerId: "cascade-admin-state-test",
        displayName: "Cascade Admin",
        source: "discord",
        admin: true,
      }),
    });
  });

  await page.goto("/cascade.html");
  await page.locator("#cascade-admin-open").click();
  await expect(page.locator("[data-admin-state]")).toContainText("5/5 lives");
  await page.getByRole("button", { name: "0 lives" }).click();

  await expect(page.locator("#lives")).toHaveText("0", { timeout: 5_000 });
  await expect(page.locator("#life-lock")).toBeVisible();
  await page.locator("#cascade-admin-open").click();
  await expect(page.locator("[data-admin-state]")).toContainText("0/5 lives");
  await page.getByRole("button", { name: "Full 5" }).click();

  await expect(page.locator("#lives")).toHaveText("♥♥♥♥♥", { timeout: 5_000 });
  await expect(page.locator("#life-lock")).toBeHidden();
  await page.locator("#cascade-admin-open").click();
  await page.getByRole("button", { name: "0 hammers" }).click();
  await expect(page.locator("#hammer-count")).toHaveText("0", { timeout: 5_000 });
});

test("Cascade admin console stays hidden for a normal authenticated player", async ({ page }) => {
  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        playerId: "cascade-player-test",
        displayName: "Cascade Player",
        source: "discord",
        admin: false,
      }),
    });
  });

  await page.goto("/cascade.html");
  await expect(page.locator("#cascade-admin-open")).toHaveCount(0);
  await page.getByRole("button", { name: "View IOUs" }).click();
  await expect(page.getByRole("button", { name: "Clear IOUs" })).toHaveCount(0);
});
