import assert from "node:assert/strict";
import test from "node:test";

import { presentCampaignEvent } from "../../public/monster-master-rpg-model.js";

test("submitted RPG actions identify the actual action in the feed heading", () => {
  const presented = presentCampaignEvent({
    eventId: "event:cart-action",
    kind: "campaign.action_submitted",
    audience: { kind: "player", playerId: "discord:player" },
    payload: {
      commandId: "command:cart-01",
      actorId: "discord:player",
      text: "Uncover the checkpoint cart.",
    },
    createdAt: "2026-08-15T15:00:00.000Z",
  });

  assert.equal(presented.heading, "Submitted: Uncover the checkpoint cart.");
  assert.equal(presented.body, "Uncover the checkpoint cart.");
  assert.equal(presented.tone, "action");
});

test("long submitted RPG actions are bounded in the feed heading without losing the full body", () => {
  const text = "Investigate the checkpoint paperwork carefully and compare every seal, date, signature, and district marking before deciding whether to comply.";
  const presented = presentCampaignEvent({
    eventId: "event:long-action",
    kind: "campaign.action_submitted",
    payload: { text },
  });

  assert.ok(presented.heading.length <= "Submitted: ".length + 88);
  assert.match(presented.heading, /…$/);
  assert.equal(presented.body, text);
});
