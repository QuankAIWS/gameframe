import assert from "node:assert/strict";
import test from "node:test";

import {
  REFERENCE_CAMPAIGN_ID,
  buildActionCommand,
  buildAttachRequest,
  mergeCampaignEvents,
  normalizeCampaignId,
  normalizeProjection,
  presentCampaignEvent,
} from "../../public/monster-master-rpg-model.js";

test("builds bounded protocol-v2 attach and action requests", () => {
  assert.equal(normalizeCampaignId(` ${REFERENCE_CAMPAIGN_ID} `), REFERENCE_CAMPAIGN_ID);
  assert.deepEqual(buildAttachRequest(REFERENCE_CAMPAIGN_ID), {
    protocolVersion: 2,
    campaignId: REFERENCE_CAMPAIGN_ID,
  });
  assert.deepEqual(buildActionCommand({
    campaignId: REFERENCE_CAMPAIGN_ID,
    commandId: "command:stable-command-0001",
    issuedAt: "2026-08-05T03:20:00.000Z",
    expectedGameframeCoordinationRevision: 7,
    text: "  Inspect the academy gate.  ",
  }), {
    protocolVersion: 2,
    campaignId: REFERENCE_CAMPAIGN_ID,
    commandId: "command:stable-command-0001",
    issuedAt: "2026-08-05T03:20:00.000Z",
    command: {
      kind: "campaign.submit_action",
      expectedGameframeCoordinationRevision: 7,
      visibility: "public",
      text: "Inspect the academy gate.",
    },
  });
});

test("rejects malformed campaign codes, revisions, and oversized actions", () => {
  assert.throws(() => normalizeCampaignId("../private"), /Campaign codes/);
  assert.throws(() => buildActionCommand({
    campaignId: REFERENCE_CAMPAIGN_ID,
    commandId: "bad",
    issuedAt: "2026-08-05T03:20:00.000Z",
    expectedGameframeCoordinationRevision: 0,
    text: "Inspect.",
  }), /stable command ID/);
  assert.throws(() => buildActionCommand({
    campaignId: REFERENCE_CAMPAIGN_ID,
    commandId: "command:stable-command-0002",
    issuedAt: "2026-08-05T03:20:00.000Z",
    expectedGameframeCoordinationRevision: -1,
    text: "Inspect.",
  }), /coordination revision/);
  assert.throws(() => buildActionCommand({
    campaignId: REFERENCE_CAMPAIGN_ID,
    commandId: "command:stable-command-0003",
    issuedAt: "2026-08-05T03:20:00.000Z",
    expectedGameframeCoordinationRevision: 0,
    text: "x".repeat(2_001),
  }), /2,000/);
});

test("normalizes a campaign projection and preserves explicit revision domains", () => {
  const projection = normalizeProjection({
    campaignId: REFERENCE_CAMPAIGN_ID,
    title: "Academy Incident",
    status: "active",
    gameframeCoordinationRevision: 8,
    presentationSequence: 11,
    linkedNarrativeRevision: 3,
    events: [
      {
        eventId: "event:scene",
        kind: "scene.presented",
        audience: { kind: "public" },
        payload: { narration: "The gate shudders open." },
        createdAt: "2026-08-05T03:20:01.000Z",
      },
    ],
  });
  assert.equal(projection.gameframeCoordinationRevision, 8);
  assert.equal(projection.presentationSequence, 11);
  assert.equal(projection.linkedNarrativeRevision, 3);
  assert.equal(projection.events.length, 1);
});

test("deduplicates recovered events and maps semantic content to player presentation", () => {
  const earlier = {
    eventId: "event:one",
    kind: "campaign.action_submitted",
    presentationSequence: 1,
    audience: { kind: "public" },
    payload: { text: "Inspect the gate." },
    createdAt: "2026-08-05T03:20:01.000Z",
  };
  const later = {
    eventId: "event:two",
    kind: "dialogue.turn",
    presentationSequence: 2,
    audience: { kind: "player", playerId: "discord:111" },
    payload: { speakerName: "Groundskeeper", dialogue: "That lock was not broken from outside." },
    createdAt: "2026-08-05T03:20:02.000Z",
  };
  const merged = mergeCampaignEvents([earlier], [earlier, later]);
  assert.deepEqual(merged.map((event) => event.eventId), ["event:one", "event:two"]);
  assert.deepEqual(presentCampaignEvent(later), {
    eventId: "event:two",
    kind: "dialogue.turn",
    heading: "Groundskeeper",
    body: "That lock was not broken from outside.",
    createdAt: "2026-08-05T03:20:02.000Z",
    tone: "dialogue",
    audience: "Private",
  });
});

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

test("long submitted RPG actions bound the heading without losing the full body", () => {
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
