import { expect, test } from "@playwright/test";

const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const PERFORMANCE_KEY = "scribbles-gameframe.cascade-performance:v1";
const OWNER_KEY = "scribbles-gameframe.cascade-progression-owner:v1";
const CANDIDATE_KEY = "scribbles-gameframe.cascade-progression-candidate:v1";
const SEEDED_KEY = "scribbles-gameframe.test-cross-device-seeded:v1";
const UNOWNED_SEEDED_KEY = "scribbles-gameframe.test-cross-device-unowned-seeded:v1";

async function installLocalProgress(page, playerId, level, starsByLevel) {
  await page.addInitScript(({ stateKey, performanceKey, ownerKey, seededKey, owner, localLevel, stars }) => {
    // addInitScript executes again after a hydration-triggered reload. Seed a
    // device only once so the fixture cannot overwrite successfully synced data.
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

async function installUnownedLocalProgress(page, level, starsByLevel) {
  await page.addInitScript(({ stateKey, performanceKey, ownerKey, candidateKey, markerKey, localLevel, stars }) => {
    if (localStorage.getItem(markerKey)) return;
    localStorage.setItem(markerKey, "1");
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
    localStorage.removeItem(ownerKey);
    localStorage.removeItem(candidateKey);
  }, {
    stateKey: STATE_KEY,
    performanceKey: PERFORMANCE_KEY,
    ownerKey: OWNER_KEY,
    candidateKey: CANDIDATE_KEY,
    markerKey: UNOWNED_SEEDED_KEY,
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

function sessionResponse(playerId, displayName) {
  return JSON.stringify({ playerId, displayName, source: "discord", admin: false });
}

function mergeServerProgression(current, incoming) {
  const starsByLevel = { ...current.starsByLevel };
  for (const [level, stars] of Object.entries(incoming.starsByLevel ?? {})) {
    starsByLevel[level] = Math.max(Number(starsByLevel[level]) || 0, Number(stars) || 0);
  }
  return {
    highestCompletedLevel: Math.max(current.highestCompletedLevel, incoming.highestCompletedLevel ?? 0),
    starsByLevel,
  };
}

async function installSharedProgressionRoutes(context, playerId, state, counters) {
  await context.route("**/api/session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: sessionResponse(playerId, "Shared Player"),
  }));
  await context.route("**/api/me/progression", (route) => {
    counters.reads += 1;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ cascade: state.progression }),
    });
  });
  await context.route("**/api/me/cascade/progression", async (route) => {
    const incoming = route.request().postDataJSON();
    counters.writes += 1;
    state.progression = mergeServerProgression(state.progression, incoming);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ cascade: state.progression }),
    });
  });
}

async function simulateCompletedLevel(page, completedLevel, stars) {
  await page.evaluate(({ stateKey, performanceKey, level, bestStars }) => {
    const state = JSON.parse(localStorage.getItem(stateKey) || "{}");
    state.level = level + 1;
    localStorage.setItem(stateKey, JSON.stringify(state));

    const performance = JSON.parse(localStorage.getItem(performanceKey) || "{}");
    performance.starsByLevel = { ...(performance.starsByLevel ?? {}), [String(level)]: bestStars };
    localStorage.setItem(performanceKey, JSON.stringify(performance));

    window.dispatchEvent(new CustomEvent("gameframe:cascade-level-complete", {
      detail: { level, final: false, replay: false },
    }));
  }, {
    stateKey: STATE_KEY,
    performanceKey: PERFORMANCE_KEY,
    level: completedLevel,
    bestStars: stars,
  });
}

test("Cascade hydrates the better server progression and preserves better local stars", async ({ browser }, testInfo) => {
  const { context, page } = await mockedProgressionPage(browser, testInfo);
  try {
    const playerId = "discord:cross-device-player";
    await installLocalProgress(page, playerId, 12, { "5": 3, "11": 2 });

    const submitted = [];
    await context.route("**/api/session", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: sessionResponse(playerId, "Cross Device"),
    }));
    await context.route("**/api/me/progression", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        cascade: {
          highestCompletedLevel: 20,
          starsByLevel: { "5": 1, "18": 2 },
        },
      }),
    }));
    await context.route("**/api/me/cascade/progression", async (route) => {
      const posted = route.request().postDataJSON();
      if (route.request().method() === "POST") submitted.push(posted);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ cascade: posted }),
      });
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

test("a stale device hydrates canonical progression without a redundant write", async ({ browser }, testInfo) => {
  const { context, page } = await mockedProgressionPage(browser, testInfo);
  try {
    const playerId = "discord:stale-device-player";
    await installLocalProgress(page, playerId, 4, { "2": 1 });

    const submitted = [];
    await context.route("**/api/session", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: sessionResponse(playerId, "Stale Device"),
    }));
    await context.route("**/api/me/progression", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        progression: { cascade: { highestCompletedLevel: 47, starsByLevel: { "2": 3, "40": 2 } } },
      }),
    }));
    await context.route("**/api/me/cascade/progression", async (route) => {
      submitted.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await page.goto("/cascade.html");
    await expect(page.locator("#level-number")).toHaveText("48", { timeout: 8_000 });
    await page.waitForTimeout(1_500);
    expect(submitted).toHaveLength(0);
  } finally {
    await context.close();
  }
});

test("an idle Cascade tab does not continuously fetch or rewrite progression", async ({ browser }, testInfo) => {
  const { context, page } = await mockedProgressionPage(browser, testInfo);
  try {
    const playerId = "discord:bounded-sync-player";
    await installLocalProgress(page, playerId, 6, { "5": 2 });

    let progressionReads = 0;
    let progressionWrites = 0;
    await context.route("**/api/session", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: sessionResponse(playerId, "Bounded Sync"),
    }));
    await context.route("**/api/me/progression", (route) => {
      progressionReads += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ cascade: { highestCompletedLevel: 5, starsByLevel: { "5": 2 } } }),
      });
    });
    await context.route("**/api/me/cascade/progression", async (route) => {
      progressionWrites += 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await page.goto("/cascade.html");
    await page.waitForTimeout(3_500);

    expect(progressionReads).toBe(1);
    expect(progressionWrites).toBe(0);
  } finally {
    await context.close();
  }
});

test("existing unowned Cascade progress binds to the authenticated player on the first visit", async ({ browser }, testInfo) => {
  const { context, page } = await mockedProgressionPage(browser, testInfo);
  try {
    const playerId = "discord:ownership-migration-player";
    await installUnownedLocalProgress(page, 8, { "3": 2, "7": 1 });

    const submitted = [];
    await context.route("**/api/session", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: sessionResponse(playerId, "Ownership Migration"),
    }));
    await context.route("**/api/me/progression", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ progression: { cascade: { highestCompletedLevel: 0, starsByLevel: {} } } }),
    }));
    await context.route("**/api/me/cascade/progression", async (route) => {
      submitted.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await page.goto("/cascade.html");
    await expect.poll(() => submitted.length, { timeout: 8_000 }).toBeGreaterThan(0);

    const migrated = await page.evaluate(({ ownerKey, candidateKey }) => ({
      owner: localStorage.getItem(ownerKey),
      candidate: localStorage.getItem(candidateKey),
    }), { ownerKey: OWNER_KEY, candidateKey: CANDIDATE_KEY });
    expect(migrated.owner).toBe(playerId);
    expect(migrated.candidate).toBeNull();
    expect(submitted.at(-1).highestCompletedLevel).toBe(7);
    expect(submitted.at(-1).starsByLevel["3"]).toBe(2);
    expect(submitted.at(-1).starsByLevel["7"]).toBe(1);
  } finally {
    await context.close();
  }
});

test("a browser owned by another player hydrates the signed-in player instead of uploading the old save", async ({ browser }, testInfo) => {
  const { context, page } = await mockedProgressionPage(browser, testInfo);
  try {
    const oldPlayerId = "discord:old-household-player";
    const currentPlayerId = "discord:current-household-player";
    await installLocalProgress(page, oldPlayerId, 50, { "12": 3, "49": 2 });

    const submitted = [];
    await context.route("**/api/session", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: sessionResponse(currentPlayerId, "Current Household Player"),
    }));
    await context.route("**/api/me/progression", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ cascade: { highestCompletedLevel: 7, starsByLevel: { "7": 2 } } }),
    }));
    await context.route("**/api/me/cascade/progression", async (route) => {
      submitted.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await page.goto("/cascade.html");
    await expect(page.locator("#level-number")).toHaveText("8", { timeout: 8_000 });
    await page.waitForTimeout(1_500);
    expect(submitted).toHaveLength(0);

    const local = await page.evaluate(({ ownerKey, performanceKey }) => ({
      owner: localStorage.getItem(ownerKey),
      stars: JSON.parse(localStorage.getItem(performanceKey) || "{}").starsByLevel,
    }), { ownerKey: OWNER_KEY, performanceKey: PERFORMANCE_KEY });
    expect(local.owner).toBe(currentPlayerId);
    expect(local.stars).toEqual({ "7": 2 });
  } finally {
    await context.close();
  }
});

test("Cascade syncs new level clears in both directions between separate device contexts", async ({ browser }, testInfo) => {
  const playerId = "discord:two-device-player";
  const server = {
    progression: { highestCompletedLevel: 3, starsByLevel: { "3": 1 } },
  };
  const counters = { reads: 0, writes: 0 };
  const phoneContext = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    serviceWorkers: "block",
  });
  const desktopContext = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    serviceWorkers: "block",
  });
  const phone = await phoneContext.newPage();
  const desktop = await desktopContext.newPage();

  try {
    await installLocalProgress(phone, playerId, 4, { "3": 1 });
    await installLocalProgress(desktop, playerId, 2, { "1": 1 });
    await installSharedProgressionRoutes(phoneContext, playerId, server, counters);
    await installSharedProgressionRoutes(desktopContext, playerId, server, counters);

    await phone.goto("/cascade.html");
    await expect(phone.locator("#level-number")).toHaveText("4", { timeout: 8_000 });

    await desktop.goto("/cascade.html");
    await expect(desktop.locator("#level-number")).toHaveText("4", { timeout: 8_000 });

    await simulateCompletedLevel(phone, 4, 2);
    await expect.poll(() => server.progression.highestCompletedLevel, { timeout: 8_000 }).toBe(4);
    expect(server.progression.starsByLevel["4"]).toBe(2);

    await desktop.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(desktop.locator("#level-number")).toHaveText("5", { timeout: 8_000 });

    await simulateCompletedLevel(desktop, 5, 3);
    await expect.poll(() => server.progression.highestCompletedLevel, { timeout: 8_000 }).toBe(5);
    expect(server.progression.starsByLevel["5"]).toBe(3);

    await phone.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(phone.locator("#level-number")).toHaveText("6", { timeout: 8_000 });

    expect(counters.writes).toBe(2);
  } finally {
    await Promise.all([phoneContext.close(), desktopContext.close()]);
  }
});
