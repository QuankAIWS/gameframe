import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const BASE = "https://telemetry.gameframe.test";
const ANALYTICS_KEY = "scribbles-gameframe.cascade-analytics:v1";
const CURSOR_KEY = "scribbles-gameframe.cascade-telemetry-cursor:v1";
const telemetrySource = await readFile(new URL("../../public/cascade-telemetry-sync.js", import.meta.url), "utf8");

test("real Chromium holds local Cascade telemetry offline and flushes retained events once after reconnect", async ({ page, context }) => {
  const errors = [];
  const postBatches = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  await page.route(BASE + "/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/") {
      await route.fulfill({
        status: 200, contentType: "text/html",
        body: '<!DOCTYPE html><meta charset="utf-8"><script type="module" src="/cascade-telemetry-sync.js"></script><p>Offline Cascade telemetry fixture</p>',
      });
      return;
    }
    if (pathname === "/cascade-telemetry-sync.js") {
      await route.fulfill({ status: 200, contentType: "text/javascript", body: telemetrySource });
      return;
    }
    if (pathname === "/gameframe-auth.js") {
      await route.fulfill({
        status: 200, contentType: "text/javascript",
        body: [
          "export async function tryGameFrameIdentity() { return { playerId: 'test-offline' }; }",
          "export async function gameFrameOptionalFetch(path, options) { return fetch(path, options); }",
        ].join("\n"),
      });
      return;
    }
    if (pathname === "/api/me/cascade/telemetry") {
      const posted = route.request().postDataJSON()?.events ?? [];
      if (posted.some((event) => event.eventId?.startsWith("cascade-raw:"))) {
        postBatches.push(posted);
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: '{"accepted":true}' });
      return;
    }
    await route.fulfill({ status: 404, body: "No fixture for route" });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + "/", { waitUntil: "load" });
  await expect(page.getByText("Offline Cascade telemetry fixture")).toBeVisible();

  // Record actual browser-local events while the browser network is disabled.
  await context.setOffline(true);
  const values = Array.from({ length: 7 }, (_, index) => ({
    at: "2026-10-24T16:59:00.000Z",
    type: "level_start",
    mode: "normal",
    level: 101 + index,
    telemetryId: "11111111-1111-4111-8111-" + String(index).padStart(12, "0"),
  }));
  await page.evaluate(([key, entries]) => localStorage.setItem(key, JSON.stringify(entries)), [ANALYTICS_KEY, values]);
  await page.waitForTimeout(2500);
  assert.equal(postBatches.length, 0, "no raw telemetry requests must run offline");
  assert.equal(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).length, ANALYTICS_KEY), 7);

  await context.setOffline(false);
  await expect.poll(() => postBatches.length, { timeout: 12_000 }).toBe(2);
  assert.deepEqual(postBatches.map((batch) => batch.length), [5, 2]);
  const sentIds = postBatches.flat().map((event) => event.eventId);
  assert.equal(new Set(sentIds).size, 7);
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), CURSOR_KEY),
    "cascade-raw:11111111-1111-4111-8111-000000000006",
  );

  // Flapping the connection after ACK must not replay the existing queue.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await context.setOffline(true);
    await context.setOffline(false);
  }
  await page.waitForTimeout(2500);
  assert.equal(postBatches.length, 2, "previously acknowledged events were resent");
  assert.deepEqual(errors, []);
});
