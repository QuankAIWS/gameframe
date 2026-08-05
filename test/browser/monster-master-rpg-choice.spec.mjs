import { expect, test } from "@playwright/test";

const campaignId = "campaign-choice-ui";

function projection({ accepted = false } = {}) {
  const events = [
    {
      eventId: "event:choice",
      kind: "choice.presented",
      audience: { kind: "public" },
      presentationSequence: 1,
      payload: {
        choiceId: "choice:academy-gate",
        prompt: "How do you approach the sealed gate?",
        allowedPlayerIds: ["choice-ui-player"],
        options: [
          {
            optionId: "option:inspect-runes",
            label: "Inspect the runes",
            actionText: "I inspect the runes without touching the gate.",
          },
          { optionId: "option:force-gate", label: "Force the gate" },
        ],
      },
      createdAt: "2026-08-05T04:30:00.000Z",
    },
  ];
  if (accepted) {
    events.push(
      {
        eventId: "event:action-submitted",
        kind: "campaign.action_submitted",
        audience: { kind: "public" },
        presentationSequence: 2,
        payload: {
          commandId: "command:browser-action",
          actorId: "choice-ui-player",
          text: "I ignore the obvious routes and ask the groundskeeper who last opened this gate.",
        },
        createdAt: "2026-08-05T04:31:00.000Z",
      },
      {
        eventId: "event:action-result",
        kind: "dialogue.turn",
        audience: { kind: "public" },
        presentationSequence: 3,
        payload: {
          speakerName: "Groundskeeper",
          dialogue: "The bursar opened it after midnight, and he was carrying somebody else's keys.",
        },
        createdAt: "2026-08-05T04:31:01.000Z",
      },
    );
  }
  return {
    protocolVersion: 2,
    campaignId,
    title: "Academy Gate Incident",
    status: "active",
    gameframeCoordinationRevision: accepted ? 3 : 1,
    presentationSequence: accepted ? 3 : 1,
    linkedNarrativeRevision: accepted ? 2 : 1,
    events,
  };
}

test("uses authored approaches as optional drafts and retries the exact freeform action", async ({ page }) => {
  let accepted = false;
  const commands = [];

  await page.route(`**/api/rpg/campaigns/${campaignId}/attach`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(projection({ accepted })),
    });
  });
  await page.route(`**/api/rpg/campaigns/${campaignId}/commands`, async (route) => {
    commands.push(route.request().postDataJSON());
    if (commands.length === 1) {
      await route.abort("connectionreset");
      return;
    }
    accepted = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        kind: "gameframe.command_committed",
        campaignId,
        commandId: commands[1].commandId,
        deliveryId: "delivery:browser-action",
        eventIds: ["event:action-submitted"],
        gameframeCoordinationRevision: 2,
        presentationSequence: 2,
        linkedNarrativeRevision: 1,
      }),
    });
  });

  await page.goto(`/monster-master-rpg.html?player=choice-ui-player&campaign=${campaignId}`);
  const suggestions = page.locator('[data-choice-id="choice:academy-gate"]');
  await expect(suggestions).toBeVisible();
  await expect(suggestions).toContainText("Possible approaches");
  await expect(suggestions).toContainText("type anything else");
  const inspect = suggestions.locator('[data-option-id="option:inspect-runes"]');
  await expect(inspect).toBeEnabled();

  await inspect.click();
  await expect(page.locator("#mm-rpg-action")).toHaveValue(
    "I inspect the runes without touching the gate.",
  );
  await expect(page.locator("#mm-rpg-action-status")).toContainText("Nothing has been sent");
  expect(commands).toHaveLength(0);

  const freeform = "I ignore the obvious routes and ask the groundskeeper who last opened this gate.";
  await page.locator("#mm-rpg-action").fill(freeform);
  await page.locator("#mm-rpg-send").click();
  await expect(page.locator("#mm-rpg-action-status")).toContainText("not confirmed");
  await expect(page.locator("#mm-rpg-action")).toBeEnabled();
  await expect(page.locator("#mm-rpg-send")).toHaveText("Retry exact action");

  await page.locator("#mm-rpg-send").click();
  await expect.poll(() => commands.length).toBe(2);
  expect(commands[0]).toEqual(commands[1]);
  expect(commands[1].protocolVersion).toBe(2);
  expect(commands[1].campaignId).toBe(campaignId);
  expect(commands[1].command.kind).toBe("campaign.submit_action");
  expect(commands[1].command.expectedGameframeCoordinationRevision).toBe(1);
  expect(commands[1].command.text).toBe(freeform);
  expect(commands[1].commandId).toMatch(/^command:/);

  await expect(page.locator("#mm-rpg-action")).toHaveValue("");
  await expect(page.locator('[data-event-id="event:action-result"]')).toContainText("somebody else's keys");
  await expect(page.locator("#mm-rpg-action-status")).toContainText("Action accepted");
});
