import { expect, test } from "@playwright/test";

const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const PERFORMANCE_KEY = "scribbles-gameframe.cascade-performance:v1";
const ACTIVE_RUN_KEY = "scribbles-gameframe.cascade-active-run:v1";
const OWNER_KEY = "scribbles-gameframe.cascade-progression-owner:v1";
const SEEDED_KEY = "scribbles-gameframe.test-stale-active-run-seeded:v1";

function sessionResponse(playerId) {
  return JSON.stringify({
    authenticated: true,
    playerId,
    displayName: "Active Run Player",
    source: "discord",
    admin: false,
  });
}

async function installLocalFrontier(page, playerId, level, starsByLevel) {
  await page.addInitScript(({ stateKey, performanceKey, activeRunKey, ownerKey, seededKey, owner, localLevel, stars }) => {
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
    localStorage.removeItem(activeRunKey);
    localStorage.setItem(ownerKey, owner);
  }, {
    stateKey: STATE_KEY,
    performanceKey: PERFORMANCE_KEY,
    activeRunKey: ACTIVE_RUN_KEY,
    ownerKey: OWNER_KEY,
    seededKey: SEEDED_KEY,
    owner: playerId,
    localLevel: level,
    stars: starsByLevel,
  });
}

async function installProgressionRoutes(context, playerId, server, counters) {
  await context.route("**/api/session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: sessionResponse(playerId),
  }));
  await context.route("**/api/me/progression", (route) => {
    counters.reads += 1;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ cascade: server.progression }),
    });
  });
  await context.route("**/api/me/cascade/progression", async (route) => {
    counters.writes += 1;
    const incoming = route.request().postDataJSON();
    const starsByLevel = { ...server.progression.starsByLevel };
    for (const [level, stars] of Object.entries(incoming.starsByLevel ?? {})) {
      starsByLevel[level] = Math.max(Number(starsByLevel[level]) || 0, Number(stars) || 0);
    }
    server.progression = {
      highestCompletedLevel: Math.max(
        server.progression.highestCompletedLevel,
        Number(incoming.highestCompletedLevel) || 0,
      ),
      starsByLevel,
    };
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ cascade: server.progression }),
    });
  });
}

async function waitForActiveRun(page, level) {
  await expect.poll(async () => page.evaluate(() => window.cascadeResearch?.exportActiveRun?.()?.level ?? null), {
    timeout: 8_000,
  }).toBe(level);
}

test("a saved active run is discarded when another device has completed past it", async ({ browser }, testInfo) => {
  const playerId = "discord:stale-active-run-player";
  const server = {
    progression: {
      highestCompletedLevel: 9,
      starsByLevel: { "9": 2 },
    },
  };
  const counters = { reads: 0, writes: 0 };
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    serviceWorkers: "block",
  });
  const page = await context.newPage();

  try {
    await installLocalFrontier(page, playerId, 10, { "9": 2 });
    await installProgressionRoutes(context, playerId, server, counters);

    await page.goto("/cascade.html");
    await expect(page.locator("#level-number")).toHaveText("10", { timeout: 8_000 });
    await waitForActiveRun(page, 10);

    const oldRun = await page.evaluate(() => window.cascadeResearch.exportActiveRun());
    expect(oldRun.level).toBe(10);

    // Simulate the same authenticated account clearing levels 10-12 on another
    // device while this browser still owns a suspended level-10 board.
    server.progression = {
      highestCompletedLevel: 12,
      starsByLevel: { "9": 2, "10": 2, "11": 1, "12": 3 },
    };

    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.locator("#level-number")).toHaveText("13", { timeout: 8_000 });
    await waitForActiveRun(page, 13);

    const hydrated = await page.evaluate(({ activeRunKey }) => ({
      activeRun: JSON.parse(localStorage.getItem(activeRunKey) || "null"),
      runtimeRun: window.cascadeResearch.exportActiveRun(),
    }), { activeRunKey: ACTIVE_RUN_KEY });
    expect(hydrated.activeRun.level).toBe(13);
    expect(hydrated.runtimeRun.level).toBe(13);
    expect(hydrated.runtimeRun.board).not.toEqual(oldRun.board);
    expect(counters.writes).toBe(0);
  } finally {
    await context.close();
  }
});

test("a veteran active run and open Memory Bloom survive same-frontier reconciliation and reload", async ({ browser }, testInfo) => {
  const playerId = "discord:current-active-run-player";
  const server = {
    progression: {
      highestCompletedLevel: 750,
      starsByLevel: { "750": 2 },
    },
  };
  const counters = { reads: 0, writes: 0 };
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    serviceWorkers: "block",
  });
  const page = await context.newPage();

  try {
    await installLocalFrontier(page, playerId, 751, { "750": 2 });
    await installProgressionRoutes(context, playerId, server, counters);

    await page.goto("/cascade.html");
    await expect(page.locator("#level-number")).toHaveText("751", { timeout: 8_000 });
    await waitForActiveRun(page, 751);
    const before = await page.evaluate(() => {
      const run = window.cascadeResearch.exportActiveRun();
      const live = window.cascadeResearch.exportLevel();
      const bloomIndex = live.progress.blooms.symbols.findIndex((symbol) => symbol >= 0);
      if (bloomIndex < 0) throw new Error("Expected level 751 to contain a Memory Bloom");
      live.progress.blooms.activeIndex = bloomIndex;
      return { run, bloomIndex };
    });

    // The runtime owns active-run persistence and commits the live state on
    // pagehide. Exercise that production path rather than editing storage
    // behind the runtime and having pagehide correctly overwrite the edit.
    await page.reload();
    await expect(page.locator("#level-number")).toHaveText("751", { timeout: 8_000 });
    await waitForActiveRun(page, 751);
    await expect(page.locator(".cascade-tile.has-memory-bloom .cascade-bloom-mark.is-revealed")).toHaveCount(1);

    const after = await page.evaluate(() => window.cascadeResearch.exportActiveRun());
    expect(after.level).toBe(751);
    expect(after.board).toEqual(before.run.board);
    expect(after.levelProgress.blooms.activeIndex).toBe(before.bloomIndex);
    expect(counters.writes).toBe(0);
  } finally {
    await context.close();
  }
});
