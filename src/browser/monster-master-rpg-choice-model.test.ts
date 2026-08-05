import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChoiceCommand,
  presentCampaignChoice,
} from "../../public/monster-master-rpg-model.js";

const choiceEvent = {
  eventId: "event:choice-one",
  kind: "choice.presented",
  presentationSequence: 4,
  createdAt: "2026-08-05T04:30:00.000Z",
  payload: {
    choiceId: "choice:academy-gate",
    prompt: "How do you approach the sealed gate?",
    allowedPlayerIds: ["player:ada"],
    options: [
      {
        optionId: "option:inspect-runes",
        label: "Inspect the runes",
        actionText: "I inspect the runes without touching the gate.",
      },
      { optionId: "option:force-gate", label: "Force the gate" },
    ],
  },
};

test("retains structured choice command construction for explicit non-narrative selection clients", () => {
  assert.deepEqual(buildChoiceCommand({
    campaignId: "campaign-one",
    commandId: "command:choice1234",
    issuedAt: "2026-08-05T04:31:00.000Z",
    expectedGameframeCoordinationRevision: 7,
    choiceId: "choice:academy-gate",
    optionId: "option:inspect-runes",
  }), {
    protocolVersion: 2,
    campaignId: "campaign-one",
    commandId: "command:choice1234",
    issuedAt: "2026-08-05T04:31:00.000Z",
    command: {
      kind: "campaign.submit_choice",
      expectedGameframeCoordinationRevision: 7,
      choiceId: "choice:academy-gate",
      optionId: "option:inspect-runes",
    },
  });
});

test("presents authored options as editable action suggestions", () => {
  const open = presentCampaignChoice(choiceEvent, "player:ada", [choiceEvent]);
  assert.equal(open.authorized, true);
  assert.equal(open.submitted, false);
  assert.deepEqual(open.options.map((option) => ({
    optionId: option.optionId,
    label: option.label,
    suggestedAction: option.suggestedAction,
    disabled: option.disabled,
  })), [
    {
      optionId: "option:inspect-runes",
      label: "Inspect the runes",
      suggestedAction: "I inspect the runes without touching the gate.",
      disabled: false,
    },
    {
      optionId: "option:force-gate",
      label: "Force the gate",
      suggestedAction: "Force the gate",
      disabled: false,
    },
  ]);
});

test("still reflects an explicit structured selection without defining the player's next freeform action", () => {
  const submission = {
    eventId: "event:choice-submitted",
    kind: "campaign.choice_submitted",
    presentationSequence: 5,
    createdAt: "2026-08-05T04:32:00.000Z",
    payload: {
      commandId: "command:choice1234",
      actorId: "player:ada",
      choiceId: "choice:academy-gate",
      optionId: "option:inspect-runes",
      label: "Inspect the runes",
    },
  };
  const closed = presentCampaignChoice(choiceEvent, "player:ada", [choiceEvent, submission]);
  assert.equal(closed.submitted, true);
  assert.equal(closed.selectedOptionId, "option:inspect-runes");
  assert.equal(closed.selectedLabel, "Inspect the runes");
  assert.equal(closed.options.every((option) => option.disabled), true);
  assert.equal(closed.options.find((option) => option.selected)?.optionId, "option:inspect-runes");
});

test("marks another player's suggestions unavailable without affecting their own composer", () => {
  const choice = presentCampaignChoice(choiceEvent, "player:bryn", [choiceEvent]);
  assert.equal(choice.authorized, false);
  assert.equal(choice.options.every((option) => option.disabled), true);
});

test("rejects duplicate or unbounded option definitions", () => {
  assert.throws(() => presentCampaignChoice({
    ...choiceEvent,
    payload: {
      ...choiceEvent.payload,
      options: [
        { optionId: "option:duplicate", label: "One" },
        { optionId: "option:duplicate", label: "Two" },
      ],
    },
  }, "player:ada", []), /unique/);
});
