import { expect, test } from "@playwright/test";

const campaignId = "campaign-rpg-encounter-ui";
const encounterId = "encounter-ui-one";
const developmentIdentityKey = "scribbles-gameframe.player-id";

function encounterProjection() {
  return {
    protocolVersion: 2,
    campaignId,
    title: "Crooked Checkpoint",
    status: "active",
    gameframeCoordinationRevision: 8,
    presentationSequence: 7,
    linkedNarrativeRevision: 3,
    events: [{
      eventId: "event:encounter-ui",
      kind: "scene.presented",
      audience: { kind: "public" },
      payload: {
        title: "The checkpoint breaks",
        narration: "The counterfeit wardens release their monsters.",
        mechanic: {
          kind: "encounter",
          state: "preparing",
          encounterId,
          reason: "The checkpoint crew attacks before the evidence can be secured.",
          objective: "Protect the travelers and stop the counterfeit wardens.",
        },
      },
      createdAt: "2026-08-06T18:00:00.000Z",
    }],
  };
}

async function mockCampaignAttach(page) {
  await page.route(`**/api/rpg/campaigns/${campaignId}/attach`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(encounterProjection()),
    });
  });
}

async function expectPersistedIdentity(page) {
  await expect.poll(() => page.evaluate(
    (key) => localStorage.getItem(key),
    developmentIdentityKey,
  )).toBe("rpg-ui-player");
}

test("campaign shell renders the authoritative battle handoff and fences narrative input", async ({ page }) => {
  await mockCampaignAttach(page);
  await page.goto(`/monster-master-rpg.html?player=rpg-ui-player&campaign=${campaignId}`);

  const encounter = page.locator(`[data-encounter-id="${encounterId}"]`);
  await expect(encounter).toBeVisible();
  await expect(encounter).toContainText("Protect the travelers and stop the counterfeit wardens.");
  await expect(encounter.locator(".mm-rpg-encounter-enter")).toHaveAttribute(
    "href",
    `/monster-master.html?match=rpg%3A${encounterId}&campaign=${campaignId}`,
  );
  await expect(page.locator("#mm-rpg-action")).toBeDisabled();
  await expect(page.locator("#mm-rpg-action-status")).toContainText("Arena Battles");
  await expectPersistedIdentity(page);
});

test("completed campaign battle returns to the same local Game Master identity", async ({ page }) => {
  await mockCampaignAttach(page);
  await page.goto(`/monster-master.html?player=rpg-ui-player&campaign=${campaignId}`);
  await expectPersistedIdentity(page);
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("gameframe:monster-master-pixi-view", {
      detail: {
        view: {
          observation: {
            status: {
              lifecycle: "completed",
              winnerPlayerId: "rpg-ui-player",
              draw: false,
            },
          },
        },
      },
    }));
  });

  const returnPanel = page.locator(".monster-master-rpg-return");
  await expect(returnPanel).toBeVisible();
  await expect(returnPanel).toContainText("Return to the Game Master");
  const returnLink = returnPanel.locator("a");
  await expect(returnLink).toHaveAttribute(
    "href",
    `/monster-master-rpg.html?campaign=${campaignId}`,
  );

  await returnLink.click();
  await expect(page).toHaveURL(new RegExp(`/monster-master-rpg\\.html\\?campaign=${campaignId}$`));
  await expect(page.locator("#mm-rpg-player-id")).toHaveText("rpg-ui-player");
});
