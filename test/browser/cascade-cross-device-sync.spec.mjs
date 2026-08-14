import { expect, test } from "@playwright/test";

const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const PERFORMANCE_KEY = "scribbles-gameframe.cascade-performance:v1";
const OWNER_KEY = "scribbles-gameframe.cascade-progression-owner:v1";
const SEEDED_KEY = "scribbles-gameframe.test-cross-device-seeded:v1";

async function installLocalProgress(page, playerId, level, starsByLevel) {
  await page.addInitScript(({ stateKey, performanceKey, ownerKey, seededKey, owner, localLevel, stars }) => {
    // addInitScript executes again after the hydration-triggered reload. Seed the
    // stale device only once so the test behaves like a real device instead of
    // restoring the stale fixture after the app has successfully reconciled it.
    if (sessionStorage.getItem(seededKey) === owner) return;
    sessionStorage.setItem(seededKey, owner);
    localStorage.setItem(stateKey, JSON.stringify({
      level: localLevel,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 0,
      hammers: 2,
    }));
    localStorage.setItem(performanceKey, JSON.stringify({
      starsByLevel: stars,
      blitzBest: {},
      blitzStars: {},
      blitzSeen: {},
      pendingHammerRewards: 0,
    }));
    localStorage.setItem(ownerKey, owner);
  }, {
    stateKey: STATE_KEY,
    performanceKey: PERFORMANCE_KEY,
    ownerKey: OWNER_KEY,
    seededKey: SEEDED_KEY,
    owner: playerId,
    localLevel: level,
    stars: starsByLevel,
  });
}

async function mockedProgressionPage(browser, testInfo) {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    serviceWorkers: "block",
  });
  return { context, page: await context.newPage() };
}

test("Cascade hydrates the better server progression and preserves better local stars", async ({ browser }, testInfo) => {
  const { context, page } = await mockedProgressionPage(browser, testInfo);
  try {
    const playerId = "discord:cross-device-player";
    await installLocalProgress(page, playerId, 12, { "5": 3, "11": 2 });

    const submitted = [];
    await page.route("**/api/session", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ playerId, displayName: "Cross Device", source: "discord", admin: false }),
    }));
    await page.route("**/api/me/progression", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        progression: {
          cascade: {
            highestCompletedLevel: 20,
            starsByLevel: { "5": 1, "18": 2 },
          },
        },
      }),
    }));
    await page.route("**/api/me/cascade/progression", async (route) => {
      if (route.request().method() === "POST") submitted.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ progression: {} }) });
    });

    await page.goto("/cascade.html");
    await expect(page.locator("#level-number")).toHaveText("21", { timeout: 8_000 });
    await expect.poll(() => submitted.length).toBeGreaterThan(0);

    const latest = submitted.at(-1);
    expect(latest.highestCompletedLevel).toBe(20);
    expect(latest.starsByLevel["5"]).toBe(3);
    expect(latest.starsByLevel["11"]).toBe(2);
    expect(latest.starsByLevel["18"]).toBe(2);
  } finally {
    await context.close();
  }
});

test("a stale device cannot submit progression lower than the canonical server state", async ({ browser }, testInfo) => {
  const { context, page } = await mockedProgressionPage(browser, testInfo);
  try {
    const playerId = "discord:stale-device-player";
    await installLocalProgress(page, playerId, 4, { "2": 1 });

    let submitted = null;
    await page.route("**/api/session", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ playerId, displayName: "Stale Device", source: "discord", admin: false }),
    }));
    await page.route("**/api/me/progression", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        progression: { cascade: { highestCompletedLevel: 47, starsByLevel: { "2": 3, "40": 2 } } },
      }),
    }));
    await page.route("**/api/me/cascade/progression", async (route) => {
      submitted = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await page.goto("/cascade.html");
    await expect(page.locator("#level-number")).toHaveText("48", { timeout: 8_000 });
    await expect.poll(() => submitted?.highestCompletedLevel ?? 0).toBe(47);
    expect(submitted.starsByLevel["2"]).toBe(3);
    expect(submitted.starsByLevel["40"]).toBe(2);
  } finally {
    await context.close();
  }
});