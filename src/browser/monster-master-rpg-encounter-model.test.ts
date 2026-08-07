import assert from "node:assert/strict";
import test from "node:test";

import {
  isEncounterPresentedEvent,
  presentCampaignEncounter,
} from "../../public/monster-master-rpg-model.js";

function encounterEvent() {
  return {
    eventId: "event:encounter-one",
    kind: "scene.presented",
    audience: { kind: "public" },
    payload: {
      title: "The checkpoint breaks",
      narration: "The counterfeit wardens release their monsters.",
      mechanic: {
        kind: "encounter",
        state: "preparing",
        encounterId: "encounter-one",
        reason: "The checkpoint crew attacks before the evidence can be secured.",
        objective: "Protect the travelers and stop the counterfeit wardens.",
      },
    },
    createdAt: "2026-08-06T18:00:00.000Z",
  };
}

test("recognizes an encounter scene and derives the authoritative battle route", () => {
  const event = encounterEvent();
  assert.equal(isEncounterPresentedEvent(event), true);
  assert.deepEqual(
    presentCampaignEncounter(event, "campaign-one"),
    {
      encounterId: "encounter-one",
      campaignId: "campaign-one",
      matchId: "rpg:encounter-one",
      state: "preparing",
      reason: "The checkpoint crew attacks before the evidence can be secured.",
      objective: "Protect the travelers and stop the counterfeit wardens.",
      href: "/monster-master.html?match=rpg%3Aencounter-one&campaign=campaign-one",
    },
  );
});

test("does not treat ordinary narrative scenes as encounter handoffs", () => {
  assert.equal(isEncounterPresentedEvent({
    ...encounterEvent(),
    payload: { narration: "The road falls quiet again.", mechanic: { kind: "none" } },
  }), false);
});
