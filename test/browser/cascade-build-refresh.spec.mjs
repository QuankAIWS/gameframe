import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const PERFORMANCE_KEY = "scribbles-gameframe.cascade-performance:v1";
const ACTIVE_RUN_KEY = "scribbles-gameframe.cascade-active-run:v1";
const TUTORIAL_KEY = "scribbles-gameframe.cascade-tutorial:v1";

async function seedLevel(page, level, { blitzSeen = {} } = {}) {
  await page.addInitScript(({ stateKey, performanceKey, tutorialKey, levelNumber, seen }) => {
    localStorage.setItem(stateKey, JSON.stringify({
      level: levelNumber,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 0,
      hammers: 2,
    }));
    localStorage.setItem(performanceKey, JSON.stringify({
      starsByLevel: {},
      blitzBest: {},
      blitzStars: {},
      blitzSeen: seen,
      pendingHammerRewards: 0,
    }));
    localStorage.setItem(tutorialKey, JSON.stringify({ enabled: false, seen: {} }));
  }, {
    stateKey: STATE_KEY,
    performanceKey: PERFORMANCE_KEY,
    tutorialKey: TUTORIAL_KEY,
    levelNumber: level,
    seen: blitzSeen,
  });
}

async function installBuildProbe(page, initialBuild = "production-a") {
  const state = { buildId: initialBuild, requests: [] };
  await page.route("**/api/client-build", async (route) => {
    state.requests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ buildId: state.buildId }),
    });
  });
  return state;
}

async function waitForLoadedBuild(page, buildId) {
  await expect.poll(() => page.evaluate(() => window.gameFrameBuildRefresh?.state().loadedBuildId ?? null))
    .toBe(buildId);
}

test("Cascade production refresh probe is wired to same-origin Cloudflare version metadata", async () => {
  const [wrangler, edge, client] = await Promise.all([
    readFile("wrangler.jsonc", "utf8"),
    readFile("src/cloudflare/rpg-edge-worker.ts", "utf8"),
    readFile("public/gameframe-build-refresh.js", "utf8"),
  ]);

  expect(wrangler).toMatch(/"version_metadata"\s*:\s*\{[\s\S]*"binding"\s*:\s*"CF_VERSION_METADATA"/);
  expect(edge).toContain('url.pathname === "/api/client-build"');
  expect(edge).toContain("env.CF_VERSION_METADATA");
  expect(client).toContain('const BUILD_ENDPOINT = "/api/client-build";');
  expect(client).not.toContain("staging.gameframe.cc");
  expect(client).not.toContain("gameframe.cc/api/client-build");
});

test("detecting a newer production build never refreshes an active level", async ({ page }) => {
  const probe = await installBuildProbe(page);
  await seedLevel(page, 6, { blitzSeen: { "after-5": true } });
  await page.goto("/cascade.html");
  await waitForLoadedBuild(page, "production-a");

  const before = await page.evaluate(() => window.cascadeResearch.exportLevel());
  probe.buildId = "production-b";
  expect(await page.evaluate(() => window.gameFrameBuildRefresh.checkForUpdate())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.gameFrameBuildRefresh.isUpdatePending())).toBe(true);

  await page.waitForTimeout(350);
  const after = await page.evaluate(() => window.cascadeResearch.exportLevel());
  expect(after.level.level).toBe(before.level.level);
  expect(after.movesRemaining).toBe(before.movesRemaining);
  expect(after.score).toBe(before.score);
  await expect(page.locator("#cascade-build-refresh-curtain")).toHaveCount(0);
});

test("level 5 update waits through the Blitz offer, then reloads into level 6 exactly once", async ({ page }) => {
  const probe = await installBuildProbe(page);
  await seedLevel(page, 5);
  await page.goto("/cascade.html");
  await waitForLoadedBuild(page, "production-a");
  await expect(page.locator("#level-number")).toHaveText("5");

  await page.evaluate((activeRunKey) => {
    const run = JSON.parse(localStorage.getItem(activeRunKey) || "null");
    const level = window.cascadeResearch.exportLevel().level;
    if (!run) throw new Error("expected a persisted Cascade run");
    run.score = level.target;
    localStorage.setItem(activeRunKey, JSON.stringify(run));
  }, ACTIVE_RUN_KEY);

  await page.reload();
  await waitForLoadedBuild(page, "production-a");
  await expect(page.locator("#level-number")).toHaveText("5");
  await expect.poll(() => page.evaluate(() => window.cascadeResearch.exportLevel().score)).toBeGreaterThan(0);

  probe.buildId = "production-b";
  await page.locator("#booster-hammer").click();
  await page.locator(".cascade-tile").first().click();

  const result = page.locator("#result-dialog");
  await expect(result).toBeVisible();
  await expect(page.locator("#result-kicker")).toHaveText("LEVEL COMPLETE");
  await expect(page.locator("#result-title")).toHaveText("Level 5 cleared.");
  await expect.poll(() => page.evaluate(() => window.gameFrameBuildRefresh.isUpdatePending())).toBe(true);

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#result-kicker")).toHaveText("BONUS ROUND");
  await expect(page.locator("#result-title")).toHaveText("BLITZ!");
  await expect(page.getByRole("button", { name: "PLAY BLITZ" })).toBeVisible();
  await expect(page.locator("#level-number")).toHaveText("5");

  const reloaded = page.waitForEvent("framenavigated", {
    predicate: (frame) => frame === page.mainFrame(),
  });
  await page.getByRole("button", { name: "Skip" }).click();
  await reloaded;

  await expect(page.locator("#level-number")).toHaveText("6");
  await waitForLoadedBuild(page, "production-b");
  await expect.poll(() => page.evaluate(() => window.gameFrameBuildRefresh.isUpdatePending())).toBe(false);

  const requestsAfterReload = probe.requests.length;
  await page.waitForTimeout(500);
  expect(probe.requests.length).toBe(requestsAfterReload);
  await expect(page.locator("#level-number")).toHaveText("6");
});

test("a failed build check never blocks Cascade play", async ({ page }) => {
  await page.route("**/api/client-build", async (route) => {
    await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
  });
  await seedLevel(page, 6, { blitzSeen: { "after-5": true } });
  await page.goto("/cascade.html");

  expect(await page.evaluate(() => window.gameFrameBuildRefresh.checkForUpdate())).toBe(false);
  const first = page.locator(".cascade-tile").first();
  await first.click();
  await expect(first).toHaveClass(/is-selected/);
  await expect(page.locator("#cascade-build-refresh-curtain")).toHaveCount(0);
});
