import { expect, test } from "@playwright/test";

const ANALYTICS_KEY = "scribbles-gameframe.cascade-analytics:v1";
const ACTIVE_RUN_KEY = "scribbles-gameframe.cascade-active-run:v1";
const TELEMETRY_DB = "scribbles-gameframe-cascade-telemetry-v2";
const TELEMETRY_STORE = "events";

async function mockAuthenticatedTelemetry(page, batches) {
  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        playerId: "discord:telemetry-browser",
        displayName: "Telemetry Browser",
        source: "discord",
        admin: false,
      }),
    });
  });
  await page.route("**/api/me/progression", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route("**/api/me/cascade/telemetry", async (route) => {
    const body = route.request().postDataJSON();
    const events = Array.isArray(body?.events) ? body.events : [];
    batches.push(events);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accepted: events.length,
        duplicates: 0,
        rejected: [],
        acceptedEventIds: events.map((event) => event.eventId),
        duplicateEventIds: [],
        storedChunks: 1,
        updatedAt: Date.now(),
      }),
    });
  });
}

async function firstLegalMove(page) {
  return page.evaluate(async () => {
    const { listLegalMoves } = await import("/cascade-engine.js");
    const board = [...document.querySelectorAll(".cascade-tile")].map((tile) => Number(tile.dataset.kind));
    return listLegalMoves(board)[0] ?? null;
  });
}

async function firstInvalidAdjacentSwap(page) {
  return page.evaluate(async () => {
    const { listLegalMoves } = await import("/cascade-engine.js");
    const board = [...document.querySelectorAll(".cascade-tile")].map((tile) => Number(tile.dataset.kind));
    const legal = new Set();
    for (const move of listLegalMoves(board)) {
      legal.add(`${move.from}:${move.to}`);
      legal.add(`${move.to}:${move.from}`);
    }
    for (let from = 0; from < 64; from += 1) {
      const row = Math.floor(from / 8);
      const column = from % 8;
      for (const to of [column < 7 ? from + 1 : null, row < 7 ? from + 8 : null]) {
        if (to !== null && !legal.has(`${from}:${to}`)) return { from, to };
      }
    }
    return null;
  });
}

async function outboxCount(page) {
  return page.evaluate(({ dbName, storeName }) => new Promise((resolve) => {
    const request = indexedDB.open(dbName, 1);
    request.onerror = () => resolve(-1);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        resolve(0);
        return;
      }
      const tx = db.transaction(storeName, "readonly");
      const count = tx.objectStore(storeName).count();
      count.onsuccess = () => resolve(count.result);
      count.onerror = () => resolve(-1);
    };
  }), { dbName: TELEMETRY_DB, storeName: TELEMETRY_STORE });
}

test("Cascade migrates the retained research log into larger acknowledged telemetry batches", async ({ page }) => {
  const batches = [];
  await mockAuthenticatedTelemetry(page, batches);
  await page.addInitScript(({ analyticsKey }) => {
    const events = Array.from({ length: 12 }, (_, index) => ({
      at: new Date(Date.now() - (12 - index) * 1000).toISOString(),
      type: "move",
      mode: "normal",
      level: 1,
      score: index * 100,
      movesRemaining: 18 - index,
      from: index,
      to: index + 1,
    }));
    localStorage.setItem(analyticsKey, JSON.stringify(events));
  }, { analyticsKey: ANALYTICS_KEY });

  await page.goto("/cascade.html");
  await expect(page.locator("#board .cascade-tile")).toHaveCount(64);
  await expect.poll(() => batches.flat().filter((event) => event.type === "move").length, { timeout: 12_000 }).toBeGreaterThanOrEqual(12);

  expect(Math.max(...batches.map((batch) => batch.length))).toBeGreaterThan(5);
  await expect.poll(() => outboxCount(page), { timeout: 12_000 }).toBe(0);
});

test("Cascade keeps one authoritative attempt ID across reload and enriches invalid swaps", async ({ page }) => {
  const batches = [];
  await mockAuthenticatedTelemetry(page, batches);
  await page.goto("/cascade.html");
  await expect(page.locator("#board .cascade-tile")).toHaveCount(64);

  const attemptId = await expect.poll(async () => page.evaluate((analyticsKey) => {
    const events = JSON.parse(localStorage.getItem(analyticsKey) || "[]");
    return events.find((event) => event.type === "level_start")?.attemptId || null;
  }, ANALYTICS_KEY), { timeout: 8_000 }).not.toBeNull().then(async () => page.evaluate((analyticsKey) => {
    const events = JSON.parse(localStorage.getItem(analyticsKey) || "[]");
    return events.find((event) => event.type === "level_start")?.attemptId || null;
  }, ANALYTICS_KEY));

  const savedAttemptId = await page.evaluate((activeRunKey) => JSON.parse(localStorage.getItem(activeRunKey) || "null")?.telemetryAttemptId || null, ACTIVE_RUN_KEY);
  expect(savedAttemptId).toBe(attemptId);

  const invalid = await firstInvalidAdjacentSwap(page);
  expect(invalid).toBeTruthy();
  await page.locator(`.cascade-tile[data-index="${invalid.from}"]`).click();
  await page.locator(`.cascade-tile[data-index="${invalid.to}"]`).click();
  const invalidEvent = await expect.poll(async () => page.evaluate((analyticsKey) => {
    const events = JSON.parse(localStorage.getItem(analyticsKey) || "[]");
    return events.findLast((event) => event.type === "invalid_swap") || null;
  }, ANALYTICS_KEY), { timeout: 8_000 }).not.toBeNull().then(async () => page.evaluate((analyticsKey) => {
    const events = JSON.parse(localStorage.getItem(analyticsKey) || "[]");
    return events.findLast((event) => event.type === "invalid_swap") || null;
  }, ANALYTICS_KEY));
  expect(invalidEvent.from).toBe(invalid.from);
  expect(invalidEvent.to).toBe(invalid.to);
  expect(invalidEvent.inputMethod).toContain("click-pair");
  expect(invalidEvent.invalidReason).toBe("no_match_after_swap");
  expect(invalidEvent.attemptId).toBe(attemptId);

  const move = await firstLegalMove(page);
  expect(move).toBeTruthy();
  await page.locator(`.cascade-tile[data-index="${move.from}"]`).click();
  await page.locator(`.cascade-tile[data-index="${move.to}"]`).click();
  await expect.poll(() => page.evaluate(() => window.cascadeResearch.exportActiveRun()?.score || 0), { timeout: 8_000 }).toBeGreaterThan(0);

  await page.reload();
  await expect(page.locator("#board .cascade-tile")).toHaveCount(64);
  const resumedAttemptId = await expect.poll(async () => page.evaluate((analyticsKey) => {
    const events = JSON.parse(localStorage.getItem(analyticsKey) || "[]");
    return events.findLast((event) => event.type === "level_resume")?.attemptId || null;
  }, ANALYTICS_KEY), { timeout: 8_000 }).not.toBeNull().then(async () => page.evaluate((analyticsKey) => {
    const events = JSON.parse(localStorage.getItem(analyticsKey) || "[]");
    return events.findLast((event) => event.type === "level_resume")?.attemptId || null;
  }, ANALYTICS_KEY));
  expect(resumedAttemptId).toBe(attemptId);
});
