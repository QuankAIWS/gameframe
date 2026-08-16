import { expect, test } from "@playwright/test";

const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const PERFORMANCE_KEY = "scribbles-gameframe.cascade-performance:v1";
const OWNER_KEY = "scribbles-gameframe.cascade-progression-owner:v1";
const CANDIDATE_KEY = "scribbles-gameframe.cascade-progression-candidate:v1";
const VISIT_KEY = "scribbles-gameframe.cascade-progression-visit:v1";
const SEEDED_KEY = "scribbles-gameframe.test-cross-device-seeded:v1";
const UNOWNED_SEEDED_KEY = "scribbles-gameframe.test-cross-device-unowned-seeded:v1";

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

test("existing anonymous Cascade progress requires a genuinely new browsing visit before ownership migration", async ({ browser }, testInfo) => {
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
      if (route.request().method() === "POST") submitted.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await page.goto("/cascade.html");
    await page.waitForTimeout(2_500);
    expect(submitted).toHaveLength(0);

    const firstVisit = await page.evaluate(({ ownerKey, candidateKey, visitKey }) => ({
      owner: localStorage.getItem(ownerKey),
      candidate: JSON.parse(localStorage.getItem(candidateKey) || "null"),
      visitId: sessionStorage.getItem(visitKey),
    }), { ownerKey: OWNER_KEY, candidateKey: CANDIDATE_KEY, visitKey: VISIT_KEY });
    expect(firstVisit.owner).toBeNull();
    expect(firstVisit.candidate?.playerId).toBe(playerId);
    expect(firstVisit.candidate?.visitId).toBe(firstVisit.visitId);

    await page.reload();
    await page.waitForTimeout(1_500);
    expect(submitted).toHaveLength(0);
    const afterReload = await page.evaluate(({ ownerKey, candidateKey, visitKey }) => ({
      owner: localStorage.getItem(ownerKey),
      candidate: JSON.parse(localStorage.getItem(candidateKey) || "null"),
      visitId: sessionStorage.getItem(visitKey),
    }), { ownerKey: OWNER_KEY, candidateKey: CANDIDATE_KEY, visitKey: VISIT_KEY });
    expect(afterReload.owner).toBeNull();
    expect(afterReload.visitId).toBe(firstVisit.visitId);
    expect(afterReload.candidate?.visitId).toBe(firstVisit.visitId);

    await page.close();
    const returnVisit = await context.newPage();
    await returnVisit.goto("/cascade.html");
    await expect.poll(() => submitted.length, { timeout: 8_000 }).toBeGreaterThan(0);

    const migrated = await returnVisit.evaluate(({ ownerKey, candidateKey, visitKey }) => ({
      owner: localStorage.getItem(ownerKey),
      candidate: localStorage.getItem(candidateKey),
      visitId: sessionStorage.getItem(visitKey),
    }), { ownerKey: OWNER_KEY, candidateKey: CANDIDATE_KEY, visitKey: VISIT_KEY });
    expect(migrated.owner).toBe(playerId);
    expect(migrated.candidate).toBeNull();
    expect(migrated.visitId).not.toBe(firstVisit.visitId);
    expect(submitted.at(-1).highestCompletedLevel).toBe(7);
    expect(submitted.at(-1).starsByLevel["3"]).toBe(2);
    expect(submitted.at(-1).starsByLevel["7"]).toBe(1);
  } finally {
    await context.close();
  }
});
