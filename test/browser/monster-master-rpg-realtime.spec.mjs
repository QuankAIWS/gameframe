import { expect, test } from "@playwright/test";

const campaignId = "campaign-realtime-browser-test";

function projection({ coordination = 3, presentation = 1, narrative = 0, suffix = "initial" } = {}) {
  return {
    protocolVersion: 2,
    campaignId,
    title: "Realtime Browser Test",
    status: "active",
    gameframeCoordinationRevision: coordination,
    presentationSequence: presentation,
    linkedNarrativeRevision: narrative,
    events: [{
      eventId: `event:${suffix}`,
      kind: "scene.presented",
      audience: { kind: "public" },
      payload: { narration: `Projection ${suffix}` },
      createdAt: "2026-08-08T15:00:00.000Z",
    }],
  };
}

async function installFakeHostedWebSocket(page) {
  await page.addInitScript(() => {
    class FakeWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      constructor(url) {
        this.url = String(url);
        this.readyState = FakeWebSocket.CONNECTING;
        window.__rpgTestSocket = this;
        setTimeout(() => {
          if (this.readyState !== FakeWebSocket.CONNECTING) return;
          this.readyState = FakeWebSocket.OPEN;
          this.onopen?.({});
        }, 0);
      }

      send() {}

      close() {
        if (this.readyState === FakeWebSocket.CLOSED) return;
        this.readyState = FakeWebSocket.CLOSED;
        this.onclose?.({ code: 1000, reason: "test close" });
      }

      receive(value) {
        this.onmessage?.({ data: JSON.stringify(value) });
      }
    }

    window.WebSocket = FakeWebSocket;
  });
}

test("hosted campaign WebSocket refreshes on revision advance without periodic polling", async ({ page }) => {
  await installFakeHostedWebSocket(page);
  let attachCount = 0;

  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        playerId: "rpg-ws-player",
        source: "discord",
        displayName: "Realtime Player",
        avatarUrl: null,
      }),
    });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/attach`, async (route) => {
    attachCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(attachCount === 1
        ? projection()
        : projection({ coordination: 4, presentation: 2, suffix: "websocket-update" })),
    });
  });

  await page.goto(`/monster-master-rpg.html?campaign=${campaignId}`);
  await expect(page.locator("#mm-rpg-campaign")).toBeVisible();
  await expect(page.locator("#mm-rpg-connection")).toHaveText("Live");
  await expect.poll(() => attachCount).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__rpgTestSocket?.url ?? ""))
    .toContain(`/api/rpg/campaigns/${campaignId}/realtime`);

  await page.evaluate(({ campaignId }) => {
    window.__rpgTestSocket.receive({
      type: "campaign_position",
      reason: "update",
      protocolVersion: 2,
      campaignId,
      gameframeCoordinationRevision: 4,
      presentationSequence: 2,
      linkedNarrativeRevision: 0,
    });
  }, { campaignId });

  await expect.poll(() => attachCount).toBe(2);
  await expect(page.locator("#mm-rpg-coordination")).toHaveText("4");

  // Healthy hosted realtime should not fall back to either the retired 2.5s
  // polling loop or the 15s degraded recovery loop.
  await page.waitForTimeout(3_200);
  expect(attachCount).toBe(2);
});

test("a realtime update arriving during an attach queues one follow-up recovery fetch", async ({ page }) => {
  await installFakeHostedWebSocket(page);
  let attachCount = 0;
  let releaseStaleAttach;
  const staleAttachGate = new Promise((resolve) => { releaseStaleAttach = resolve; });

  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        playerId: "rpg-ws-race-player",
        source: "discord",
        displayName: "Race Player",
        avatarUrl: null,
      }),
    });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/attach`, async (route) => {
    attachCount += 1;
    if (attachCount === 2) {
      await staleAttachGate;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(projection({ coordination: 3, presentation: 1, suffix: "stale-refresh" })),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(attachCount >= 3
        ? projection({ coordination: 5, presentation: 3, narrative: 1, suffix: "caught-up" })
        : projection()),
    });
  });

  await page.goto(`/monster-master-rpg.html?campaign=${campaignId}`);
  await expect(page.locator("#mm-rpg-connection")).toHaveText("Live");
  await expect.poll(() => attachCount).toBe(1);

  await page.locator("#mm-rpg-refresh").click();
  await expect.poll(() => attachCount).toBe(2);
  await page.evaluate(({ campaignId }) => {
    window.__rpgTestSocket.receive({
      type: "campaign_position",
      reason: "update",
      protocolVersion: 2,
      campaignId,
      gameframeCoordinationRevision: 5,
      presentationSequence: 3,
      linkedNarrativeRevision: 1,
    });
  }, { campaignId });

  releaseStaleAttach();
  await expect.poll(() => attachCount).toBe(3);
  await expect(page.locator("#mm-rpg-coordination")).toHaveText("5");
  await expect(page.locator('[data-event-id="event:caught-up"]')).toBeVisible();
});
