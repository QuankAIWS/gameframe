import { expect, test } from "@playwright/test";

const stagingCampaignId = "monster-master-staging-v6";
const recentKey = "scribbles-gameframe.monster-master-rpg.recent-campaigns.v1";
const currentKey = "scribbles-gameframe.monster-master-rpg.campaign";

function campaignProjection(campaignId = "campaign-lobby-test") {
  return {
    protocolVersion: 2,
    campaignId,
    title: "Monster Master: Lobby Test",
    status: "active",
    gameframeCoordinationRevision: 4,
    presentationSequence: 1,
    linkedNarrativeRevision: 0,
    events: [{
      eventId: "event:lobby-test",
      kind: "scene.presented",
      audience: { kind: "public" },
      payload: { narration: "The lobby test campaign is ready." },
      createdAt: "2026-08-10T18:00:00.000Z",
    }],
  };
}

test("Role-Playing Games opens Monster Master at a campaign lobby instead of auto-resuming staging", async ({ page }) => {
  let stagingAttachCount = 0;
  await page.route(`**/api/rpg/campaigns/${stagingCampaignId}/attach`, async (route) => {
    stagingAttachCount += 1;
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "unexpected attach" }) });
  });

  await page.goto("/gameframe-rpg.html");
  const monsterMaster = page.getByRole("link", { name: "Open Monster Master RPG" });
  await expect(monsterMaster).toHaveAttribute("href", "/monster-master-rpg.html");

  await page.goto("/monster-master-rpg.html?player=lobby-player");
  await expect(page.getByRole("heading", { name: "Campaign lobby" })).toBeVisible();
  await expect(page.locator("#mm-rpg-campaign")).toBeHidden();
  await expect(page.locator(`[data-campaign-id="${stagingCampaignId}"]`)).toBeVisible();
  await expect(page).not.toHaveURL(/campaign=/);
  await page.waitForTimeout(400);
  expect(stagingAttachCount).toBe(0);
});

test("campaign lobby renders recent campaigns with the last campaign first", async ({ page }) => {
  await page.addInitScript(({ recentKey: key, currentKey: activeKey }) => {
    localStorage.setItem(activeKey, "campaign-second");
    localStorage.setItem(key, JSON.stringify([
      {
        campaignId: "campaign-first",
        title: "First Campaign",
        status: "paused",
        lastOpenedAt: "2026-08-09T18:00:00.000Z",
      },
      {
        campaignId: "campaign-second",
        title: "Second Campaign",
        status: "active",
        lastOpenedAt: "2026-08-10T18:00:00.000Z",
      },
    ]));
  }, { recentKey, currentKey });

  await page.goto("/monster-master-rpg.html?player=lobby-recents-player");
  const cards = page.locator("#mm-rpg-campaign-list .mm-rpg-campaign-card");
  await expect(cards).toHaveCount(3);
  await expect(cards.first()).toHaveAttribute("data-campaign-id", "campaign-second");
  await expect(page.locator('[data-campaign-id="campaign-second"]')).toHaveAttribute("data-last", "true");
  await expect(page.locator('[data-campaign-id="campaign-second"]')).toContainText("Resume");
  await expect(page.locator(`[data-campaign-id="${stagingCampaignId}"]`)).toContainText("STAGING");
});

test("campaign lobby loads durable My Campaigns memberships across browser history", async ({ page }) => {
  await page.route("**/api/rpg/campaigns", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        protocolVersion: 1,
        kind: "campaign.index",
        playerId: "durable-lobby-player",
        campaigns: [
          {
            campaignId: "campaign:durable-player",
            title: "Durable Player Campaign",
            status: "active",
            role: "player",
            partyId: "party:main",
            gameframeCoordinationRevision: 8,
            presentationSequence: 12,
            linkedNarrativeRevision: 7,
            updatedAt: "2026-08-10T18:20:00.000Z",
          },
          {
            campaignId: "campaign:durable-observer",
            title: "Durable Observer Campaign",
            status: "paused",
            role: "observer",
            gameframeCoordinationRevision: 2,
            presentationSequence: 5,
            linkedNarrativeRevision: 2,
            updatedAt: "2026-08-10T18:10:00.000Z",
          },
        ],
      }),
    });
  });

  await page.goto("/monster-master-rpg.html?player=durable-lobby-player");
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterRpgCampaignLobby?.getIndexState?.())).toBe("ready");

  const player = page.locator('[data-campaign-id="campaign:durable-player"]');
  const observer = page.locator('[data-campaign-id="campaign:durable-observer"]');
  await expect(player).toBeVisible();
  await expect(player).toHaveAttribute("data-source", "durable");
  await expect(player).toContainText("Durable Player Campaign");
  await expect(player).toContainText("ACTIVE · PLAYER");
  await expect(observer).toBeVisible();
  await expect(observer).toContainText("PAUSED · OBSERVER");
  await expect(page.locator(`[data-campaign-id="${stagingCampaignId}"]`)).toBeVisible();
});

test("deep links present an intentional resume state while the campaign attaches", async ({ page }) => {
  const campaignId = "campaign-deep-link";
  let releaseAttach;
  let markAttachRequested;
  const attachRequested = new Promise((resolve) => {
    markAttachRequested = resolve;
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/attach`, async (route) => {
    markAttachRequested();
    await new Promise((resolve) => {
      releaseAttach = resolve;
    });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(campaignProjection(campaignId)) });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/exploration/attach`, async (route) => {
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "fixture" }) });
  });

  const navigation = page.goto(`/monster-master-rpg.html?player=deep-link-player&campaign=${campaignId}`);
  await expect(page.getByRole("heading", { name: "Resuming campaign…" })).toBeVisible();
  await expect(page.locator("#mm-rpg-campaign-lobby")).toBeHidden();
  await expect(page.locator("#mm-rpg-join-form")).toBeHidden();
  await attachRequested;
  releaseAttach();
  await navigation;
  await expect(page.locator("#mm-rpg-campaign")).toBeVisible();
});

test("active campaign shell exposes Campaigns and returns to the lobby without retaining the deep link", async ({ page }) => {
  const campaignId = "campaign-lobby-test";
  await page.route(`**/api/rpg/campaigns/${campaignId}/attach`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(campaignProjection(campaignId)) });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/exploration/attach`, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "No exploration fixture is needed for this lobby test." }),
    });
  });

  await page.goto(`/monster-master-rpg.html?player=lobby-switch-player&campaign=${campaignId}`);
  await expect(page.locator("#mm-rpg-campaign")).toBeVisible();
  const campaigns = page.getByRole("button", { name: "Return to campaign lobby" });
  await expect(campaigns).toBeVisible();
  await campaigns.click();

  await expect(page.getByRole("heading", { name: "Campaign lobby" })).toBeVisible();
  await expect(page.locator("#mm-rpg-campaign")).toBeHidden();
  await expect(page).not.toHaveURL(/campaign=/);
  await expect(page.locator(`[data-campaign-id="${campaignId}"]`)).toContainText("Monster Master: Lobby Test");
});

test("admin control is visible in the lobby and remains explicitly staging-scoped", async ({ page }) => {
  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        playerId: "admin-lobby-player",
        displayName: "Admin Lobby Player",
        source: "development",
        admin: true,
      }),
    });
  });

  await page.goto("/monster-master-rpg.html?player=admin-lobby-player");
  const admin = page.locator("#mm-rpg-lobby-actions #mm-rpg-admin-open");
  await expect(admin).toBeVisible();
  await admin.click();
  await expect(page.locator("#mm-rpg-admin-overlay")).toBeVisible();
  await expect(page.locator("[data-admin-campaign]")).toHaveText(stagingCampaignId);
  await expect(page.locator("#mm-rpg-admin-overlay")).toContainText("Other campaign selections are not the target");
});

test("centered world interaction buttons do not jump sideways on hover", async ({ page }) => {
  await page.goto("/monster-master-rpg.html?player=hover-fix-player");
  await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "hover-fixture";
    host.style.position = "relative";
    host.style.width = "800px";
    host.style.height = "180px";
    document.body.append(host);
    const button = document.createElement("button");
    button.id = "hover-fixture-button";
    button.className = "mm-rpg-world-interact mm-rpg-world-travel-control";
    button.textContent = "Travel · West Woods Route";
    host.append(button);
  });

  const button = page.locator("#hover-fixture-button");
  const before = await button.boundingBox();
  await button.hover();
  const after = await button.boundingBox();
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(Math.abs(after.x - before.x)).toBeLessThan(2);
});

test("coordination bridge recovers current semantic coordination without mutating exploration payload", async ({ page }) => {
  await page.goto("/monster-master-rpg.html?player=coordination-bridge-player");
  await expect.poll(() => page.evaluate(() => Boolean(window.gameFrameMonsterRpgCoordination))).toBe(true);
  const revisions = await page.evaluate(() => {
    const payload = { projection: {} };
    window.gameFrameMonsterRpgWorld = {
      getPayload: () => payload,
      getPlayerPosition: () => null,
    };
    window.gameFrameMonsterRpgApp = {
      getProjection: () => ({ gameframeCoordinationRevision: 9 }),
    };
    window.gameFrameMonsterRpgCoordination.synchronize();
    return {
      bridge: window.gameFrameMonsterRpgCoordination.getRevision(),
      displayed: Number(document.querySelector("#mm-rpg-coordination")?.textContent ?? "NaN"),
      exploration: payload.projection.gameframeCoordinationRevision ?? null,
    };
  });
  expect(revisions).toEqual({ bridge: 9, displayed: 9, exploration: null });
});

test("click movement walks adjacent to an interaction target instead of onto it", async ({ page }) => {
  await page.goto("/monster-master-rpg.html?player=click-move-player");
  await expect.poll(() => page.evaluate(() => Boolean(window.gameFrameMonsterRpgClickMove))).toBe(true);
  const result = await page.evaluate(async () => {
    let position = {
      sceneId: "scene.test",
      materializationRef: { hash: "hash" },
      positionRevision: 0,
      transform: { x: 0, y: 0, facing: "east" },
      moved: false,
    };
    const moves = [];
    const payload = {
      projection: { viewer: { playerCharacterEntityId: "trainer:test" } },
      materialization: {
        map: {
          width: 5,
          height: 3,
          cells: Array.from({ length: 15 }, () => ({ terrain: "floor" })),
        },
        anchors: [
          { kind: "player", semanticId: "trainer:test", x: 0, y: 0 },
          {
            kind: "route",
            semanticId: "route.test",
            interactionTargetId: "route:route.test",
            x: 3,
            y: 0,
          },
        ],
      },
    };
    window.gameFrameMonsterRpgWorld = {
      getPayload: () => payload,
      getPlayerPosition: () => position,
      move: (direction) => {
        moves.push(direction);
        const delta = {
          north: [0, -1],
          east: [1, 0],
          south: [0, 1],
          west: [-1, 0],
        }[direction];
        position = {
          ...position,
          positionRevision: position.positionRevision + 1,
          transform: {
            x: position.transform.x + delta[0],
            y: position.transform.y + delta[1],
            facing: direction,
          },
          moved: true,
        };
        queueMicrotask(() => window.dispatchEvent(new CustomEvent("gameframe:monster-master-pixi-view")));
        return true;
      },
    };
    await window.gameFrameMonsterRpgClickMove.moveTo({ x: 3, y: 0 });
    return { moves, position };
  });

  expect(result.moves).toEqual(["east", "east"]);
  expect(result.position.transform).toMatchObject({ x: 2, y: 0 });
});
