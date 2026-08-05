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
          { optionId: "option:inspect-runes", label: "Inspect the runes" },
          { optionId: "option:force-gate", label: "Force the gate" },
        ],
      },
      createdAt: "2026-08-05T04:30:00.000Z",
    },
  ];
  if (accepted) {
    events.push(
      {
        eventId: "event:choice-submitted",
        kind: "campaign.choice_submitted",
        audience: { kind: "public" },
        presentationSequence: 2,
        payload: {
          commandId: "command:browser-choice",
          actorId: "choice-ui-player",
          choiceId: "choice:academy-gate",
          optionId: "option:inspect-runes",
          label: "Inspect the runes",
        },
        createdAt: "2026-08-05T04:31:00.000Z",
      },
      {
        eventId: "event:choice-result",
        kind: "scene.presented",
        audience: { kind: "public" },
        presentationSequence: 3,
        payload: {
          title: "Runes inspected",
          narration: "The outer ring is a decoy. A fresh binding mark glows beneath it.",
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

test("submits an authored choice and retries the exact command after ambiguous delivery", async ({ page }) => {
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
        deliveryId: "delivery:browser-choice",
        eventIds: ["event:choice-submitted"],
        gameframeCoordinationRevision: 2,
        presentationSequence: 2,
        linkedNarrativeRevision: 1,
      }),
    });
  });

  await page.goto(`/monster-master-rpg.html?player=choice-ui-player&campaign=${campaignId}`);
  const choice = page.locator('[data-choice-id="choice:academy-gate"]');
  await expect(choice).toBeVisible();
  await expect(choice).toContainText("How do you approach the sealed gate?");
  const inspect = choice.locator('[data-option-id="option:inspect-runes"]');
  const force = choice.locator('[data-option-id="option:force-gate"]');
  await expect(inspect).toBeEnabled();
  await expect(force).toBeEnabled();

  await inspect.click();
  await expect(page.locator("#mm-rpg-action-status")).toContainText("not confirmed");
  await expect(inspect).toContainText("Retry:");
  await expect(inspect).toBeEnabled();
  await expect(force).toBeDisabled();

  await inspect.click();
  await expect.poll(() => commands.length).toBe(2);
  expect(commands[0]).toEqual(commands[1]);
  expect(commands[1].protocolVersion).toBe(2);
  expect(commands[1].campaignId).toBe(campaignId);
  expect(commands[1].command.kind).toBe("campaign.submit_choice");
  expect(commands[1].command.expectedGameframeCoordinationRevision).toBe(1);
  expect(commands[1].command.choiceId).toBe("choice:academy-gate");
  expect(commands[1].command.optionId).toBe("option:inspect-runes");
  expect(commands[1].commandId).toMatch(/^command:/);

  await expect(choice.locator('[data-option-id="option:inspect-runes"]')).toHaveClass(/is-selected/);
  await expect(choice.locator('[data-option-id="option:inspect-runes"]')).toBeDisabled();
  await expect(choice).toContainText("Selected: Inspect the runes");
  await expect(page.locator('[data-event-id="event:choice-result"]')).toContainText("fresh binding mark");
  await expect(page.locator("#mm-rpg-action-status")).toContainText("Choice accepted");
});
