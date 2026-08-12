import { expect, test } from "@playwright/test";

const CASCADE_STATE_KEY = "scribbles-gameframe.cascade-state:v1";

async function installLevelFixture(page, fallbackLevel) {
  await page.addInitScript(({ stateKey, fallback }) => {
    const requested = Number(new URL(window.location.href).searchParams.get("cascadeTestLevel"));
    const level = Number.isInteger(requested) && requested > 0 ? requested : fallback;
    window.localStorage.setItem(stateKey, JSON.stringify({
      level,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 0,
      hammers: 2,
    }));
  }, { stateKey: CASCADE_STATE_KEY, fallback: fallbackLevel });
}

test("Cascade Crush resolves a legal move through the animated presentation layer", async ({ page }) => {
  await page.goto("/cascade.html");

  await expect(page.getByRole("heading", { name: "Cascade Crush", exact: true })).toBeVisible();
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  await expect(page.locator("#level-map > li")).toHaveCount(30);
  await expect(page.locator("#level-map")).toHaveAttribute("data-range", "1-30");

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
  // A single legal move can create several sequential cascades. Each score pop
  // lasts only 700 ms, but later cascade steps can spawn additional pops well
  // after the first score update observed above.
  await expect(page.locator(".cascade-score-pop")).toHaveCount(0, { timeout: 8_000 });
});

test("Cascade teaches persistent specials in the opening five levels", async ({ page }) => {
  await installLevelFixture(page, 2);

  await page.goto("/cascade.html?cascadeTestLevel=2");
  await expect(page.locator("#level-number")).toHaveText("2");
  await expect(page.locator(".cascade-help")).toContainText("Match four to make a striped piece");
  await expect(page.locator('#level-map > li[data-level="2"]')).toContainText("Stripes");

  await page.goto("/cascade.html?cascadeTestLevel=3");
  await expect(page.locator("#level-number")).toHaveText("3");
  await expect(page.locator(".cascade-help")).toContainText("T or L match");
  await expect(page.locator('#level-map > li[data-level="3"]')).toContainText("Bombs");

  await page.goto("/cascade.html?cascadeTestLevel=4");
  await expect(page.locator("#level-number")).toHaveText("4");
  await expect(page.locator(".cascade-help")).toContainText("two specials next to each other");
  await expect(page.locator('#level-map > li[data-level="4"]')).toContainText("Combos");

  await page.goto("/cascade.html?cascadeTestLevel=5");
  await expect(page.locator("#level-number")).toHaveText("5");
  await expect(page.locator(".cascade-help")).toContainText("Match five to make a color clearer");
  await expect(page.locator('#level-map > li[data-level="5"]')).toContainText("Color");
});

test("Cascade spreads objective families across the 300-level campaign", async ({ page }) => {
  await installLevelFixture(page, 31);

  await page.goto("/cascade.html?cascadeTestLevel=31");
  await expect(page.locator("#level-number")).toHaveText("31");
  await expect(page.locator('.cascade-tile[data-ice]')).not.toHaveCount(0);
  await expect(page.locator("#level-map")).toHaveAttribute("data-range", "31-60");

  await page.goto("/cascade.html?cascadeTestLevel=61");
  await expect(page.locator("#level-number")).toHaveText("61");
  await expect.poll(async () => page.evaluate(() => window.cascadeResearch.exportLevel().level.objective.collect.length)).toBe(1);
  await expect(page.locator("#level-map")).toHaveAttribute("data-range", "61-90");

  await page.goto("/cascade.html?cascadeTestLevel=151");
  await expect(page.locator("#level-number")).toHaveText("151");
  await expect(page.locator('.cascade-tile[data-ice="2"]')).not.toHaveCount(0);
  await expect(page.locator("#level-map")).toHaveAttribute("data-range", "151-180");

  await page.goto("/cascade.html?cascadeTestLevel=241");
  await expect(page.locator("#level-number")).toHaveText("241");
  await expect.poll(async () => page.evaluate(() => window.cascadeResearch.exportLevel().level.objective.collect.length)).toBe(2);
  await expect(page.locator('.cascade-tile[data-ice="2"]')).not.toHaveCount(0);
  await expect(page.locator("#level-map")).toHaveAttribute("data-range", "241-270");
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
  await expect(page.locator('#level-map > li[data-level="6"] .cascade-map-stars')).toHaveText("★★");
});

test("Cascade bonus cadence continues through the veteran chapters", async ({ page }) => {
  await installLevelFixture(page, 171);
  await page.goto("/cascade.html?cascadeTestLevel=171");
  await expect(page.locator("#bonus-status")).toContainText("NEXT BLITZ AFTER LEVEL 190");

  await page.evaluate(() => window.cascadeBonusModes.startQuickRecall(216));
  await expect(page.locator("#cascade-recall-dialog")).toBeVisible();
  await expect(page.locator("[data-recall-title]")).toContainText("Round 1");
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
  await expect(page.locator("#cascade-admin-dialog")).toBeVisible();
  await page.locator("[data-admin-blitz]").click();
  await expect(page.locator("body")).toHaveClass(/cascade-blitz-mode/);
  await expect(page.locator("#level-number")).toHaveText("B");
  await expect(page.locator("#moves")).toHaveText("∞");
  await expect(page.locator("#blitz-overlay")).toBeVisible();
});

test("Cascade admin console reaches level 300 and keeps the map bounded", async ({ page }) => {
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
  await page.locator("#cascade-admin-open").click();
  await expect(page.locator("#cascade-admin-dialog")).toBeVisible();
  await page.locator("#cascade-admin-command").fill("go to level 300");
  await page.locator("[data-admin-run]").click();
  await expect(page.locator("#level-number")).toHaveText("300");
  await expect(page.locator("#level-map > li")).toHaveCount(30);
  await expect(page.locator("#level-map")).toHaveAttribute("data-range", "271-300");
});

test("Cascade admin can force life and inventory edge states", async ({ page }) => {
  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        playerId: "cascade-admin-edges",
        displayName: "Cascade Admin",
        source: "discord",
        admin: true,
      }),
    });
  });

  await page.goto("/cascade.html");
  await page.locator("#cascade-admin-open").click();
  await page.locator('[data-lives="0"]').click();
  await expect(page.locator("#lives")).toHaveText("0");
  await expect(page.locator("#life-lock")).toBeVisible();

  await page.locator("#cascade-admin-open").click();
  await page.locator('[data-lives="5"]').click();
  await expect(page.locator("#lives")).toHaveText("♥♥♥♥♥");

  await page.locator("#cascade-admin-open").click();
  await page.locator('[data-hammers="0"]').click();
  await expect(page.locator("#hammer-count")).toHaveText("0");
});

test("Cascade admin console stays hidden for a normal authenticated player", async ({ page }) => {
  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        playerId: "cascade-player",
        displayName: "Cascade Player",
        source: "discord",
        admin: false,
      }),
    });
  });

  await page.goto("/cascade.html");
  await expect(page.locator("#cascade-admin-open")).toHaveCount(0);
});