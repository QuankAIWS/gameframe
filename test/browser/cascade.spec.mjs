import { expect, test } from "@playwright/test";

test("Cascade resolves a legal move through the animated presentation layer", async ({ page }) => {
  await page.goto("/cascade.html");

  await expect(page.getByRole("heading", { name: "Cascade" })).toBeVisible();
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  await expect(page.locator("#level-map > li")).toHaveCount(30);

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

test("Cascade IOU ledger has no player-facing reset control", async ({ page }) => {
  await page.goto("/cascade.html");
  await page.getByRole("button", { name: "View IOUs" }).click();
  await expect(page.locator("#ledger-dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear IOUs" })).toHaveCount(0);
  await expect(page.locator("#reset-ledger")).toBeHidden();
});

test("Cascade shows a live refill countdown and blocks play at zero lives", async ({ page }) => {
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
  await expect(page.locator(".cascade-tile").first()).toBeDisabled();

  await page.getByRole("button", { name: "Need a boost?" }).click();
  await expect(page.locator("#boost-info-dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "REFILL 5 LIVES · 5 IOU$" })).toBeEnabled();
});

test("Cascade Need a boost opens useful offer guidance during ordinary play", async ({ page }) => {
  await page.goto("/cascade.html");
  await page.getByRole("button", { name: "Open boosts" }).click();
  await expect(page.locator("#boost-info-dialog")).toBeVisible();
  await expect(page.locator("#boost-state")).toContainText("5/5 lives");
  await expect(page.getByRole("button", { name: "REFILL 5 LIVES · 5 IOU$" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Open hammer offer" })).toBeDisabled();
  await expect(page.getByText("Extra moves are offered when you hit 0 moves.")).toBeVisible();
});

test("Cascade admin console uses the authenticated admin identity to jump levels and reset IOUs", async ({ page }) => {
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

  await page.locator("#cascade-admin-command").fill("go to level 20");
  await page.getByRole("button", { name: "Run" }).click();

  await expect(page.locator("#level-number")).toHaveText("20", { timeout: 5_000 });
  await expect(page.locator("#level-map > li")).toHaveCount(30);
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
