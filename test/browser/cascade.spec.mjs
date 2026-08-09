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

test("Cascade admin console uses the authenticated admin identity to jump levels", async ({ page }) => {
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
  await page.locator("#cascade-admin-command").fill("go to level 20");
  await page.getByRole("button", { name: "Run" }).click();

  await expect(page.locator("#level-number")).toHaveText("20", { timeout: 5_000 });
  await expect(page.locator("#level-map > li")).toHaveCount(30);
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
});
