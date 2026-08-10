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
  await expect(page.locator(".cascade-score-pop")).toHaveCount(0, { timeout: 2_000 });
});

test("Cascade teaches persistent specials in the opening five levels", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("scribbles-gameframe.cascade-state:v1", JSON.stringify({
      level: 2,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 0,
      hammers: 2,
    }));
  });

  await page.goto("/cascade.html");
  await expect(page.locator("#level-number")).toHaveText("2");
  await expect(page.locator(".cascade-help")).toContainText("Match four to make a striped piece");
  await expect(page.locator('#level-map > li[data-level="2"]')).toContainText("Stripes");

  await page.evaluate(() => {
    const key = "scribbles-gameframe.cascade-state:v1";
    const state = JSON.parse(window.localStorage.getItem(key));
    state.level = 3;
    window.localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await expect(page.locator(".cascade-help")).toContainText("T or L match");
  await expect(page.locator(".cascade-help")).toContainText("bomb");

  await page.evaluate(() => {
    const key = "scribbles-gameframe.cascade-state:v1";
    const state = JSON.parse(window.localStorage.getItem(key));
    state.level = 5;
    window.localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await expect(page.locator(".cascade-help")).toContainText("Match five to make a color clearer");
});

test("Cascade late chapters still expose ice, collection, and layered ice", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("scribbles-gameframe.cascade-state:v1", JSON.stringify({
      level: 31,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 0,
      hammers: 2,
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
    state.level = 71;
    window.localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await expect(page.locator('.cascade-tile[data-ice="2"]')).not.toHaveCount(0);
});

test("Cascade has no IOU ledger, purchase path, or fake currency surface", async ({ page }) => {
  await page.goto("/cascade.html");
  await expect(page.locator("#iou-total, #ledger-dialog, #reset-ledger")).toHaveCount(0);
  await expect(page.getByText(/IOU\$/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /IOU|purchase|buy|refill/i })).toHaveCount(0);
});

test("Cascade shows a live refill countdown and blocks play at zero lives without a refill purchase", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("scribbles-gameframe.cascade-state:v1", JSON.stringify({
      level: 4,
      lives: 0,
      lastLifeAt: Date.now(),
      streak: 2,
      hammers: 1,
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
});

test("Cascade keeps best stars and replaces ordinary quick timers with scheduled Blitz", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("scribbles-gameframe.cascade-state:v1", JSON.stringify({
      level: 6,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 0,
      hammers: 2,
    }));
    window.localStorage.setItem("scribbles-gameframe.cascade-performance:v1", JSON.stringify({
      starsByLevel: { "6": 2 },
      blitzBest: {},
      blitzStars: {},
      blitzSeen: { "after-5": true },
      pendingHammerRewards: 0,
    }));
  });

  await page.goto("/cascade.html");
  await expect(page.locator("#level-stars")).toHaveText("★★☆");
  await expect(page.locator("#star-progress")).toContainText("2 total stars");
  await expect(page.locator("#quick-bonus")).toHaveCount(0);
  await expect(page.locator("#bonus-status")).toContainText("NEXT BLITZ AFTER LEVEL 12");
  await expect(page.locator('#level-map > li[data-level="6"] .cascade-map-stars')).toHaveText("★★☆");
});

test("Cascade zero-hammer state points back to earned stars", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("scribbles-gameframe.cascade-state:v1", JSON.stringify({
      level: 8,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 0,
      hammers: 0,
    }));
  });

  await page.goto("/cascade.html");
  await page.locator("#booster-hammer").click();
  await expect(page.locator("#result-dialog")).toBeVisible();
  await expect(page.locator("#result-kicker")).toHaveText("NO HAMMERS");
  await expect(page.locator("#result-copy")).toContainText("Every 10 new best stars");
  await expect(page.getByRole("button", { name: "Got it" })).toBeVisible();
});

test("Cascade admin can launch a standalone non-failing Blitz round", async ({ page }) => {
  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        playerId: "cascade-admin-blitz-test",
        displayName: "Cascade Admin",
        source: "discord",
        admin: true,
      }),
    });
  });

  await page.goto("/cascade.html");
  await page.locator("#cascade-admin-open").click();
  await page.getByRole("button", { name: "Start 30-second Blitz" }).click();

  await expect(page.locator("body")).toHaveClass(/cascade-blitz-mode/);
  await expect(page.locator("#blitz-overlay")).toBeVisible();
  await expect(page.locator("#blitz-callout")).toContainText(/3|2|1|BLITZ/);
  await expect(page.locator("#level-number")).toHaveText("B");
  await expect(page.locator("#target")).toHaveText("∞");
  await expect(page.locator("#moves")).toHaveText("∞");
  await expect(page.locator("#booster-hammer")).toBeDisabled();
  await expect.poll(async () => page.evaluate(() => window.cascadeResearch.exportLevel().mode), { timeout: 4_000 }).toBe("blitz");
});

test("Cascade admin console jumps levels and contains no IOU controls", async ({ page }) => {
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
  await expect(page.locator("#cascade-admin-open")).toBeVisible();
  await page.locator("#cascade-admin-open").click();
  await expect(page.locator("#cascade-admin-dialog")).toBeVisible();
  await expect(page.locator('#cascade-admin-dialog [data-level="100"]')).toBeVisible();
  await expect(page.locator("#cascade-admin-dialog")).not.toContainText("IOU");

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
  await expect(page.getByText(/IOU\$/i)).toHaveCount(0);
});
