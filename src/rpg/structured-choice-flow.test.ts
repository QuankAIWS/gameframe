import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { DurableRpgCampaignService, DurableRpgCampaignServiceError } from "./durable-rpg-campaign-service.ts";
import { SqliteRuntimeCommandOutbox } from "./runtime-command-outbox.ts";
import type { DurableCampaignBootstrap } from "./sqlite-rpg-campaign-store.ts";

const directories: string[] = [];

test.afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-choice-flow-"));
  directories.push(directory);
  return join(directory, "gameframe.sqlite");
}

function choiceCampaign(input: {
  campaignId: string;
  allowedPlayerIds?: string[];
}): DurableCampaignBootstrap {
  return {
    campaignId: input.campaignId,
    title: "Academy Gate",
    status: "active",
    state: {
      gameframeCoordinationRevision: 1,
      presentationSequence: 1,
      linkedNarrativeRevision: 1,
    },
    memberships: [{
      playerId: "player:ada",
      role: "player",
      partyId: "party:keepers",
      joinedPresentationSequence: 0,
    }],
    events: [{
      eventId: `event:${input.campaignId}:choice`,
      kind: "choice.presented",
      audience: { kind: "public" },
      payload: {
        choiceId: "choice:academy-gate",
        prompt: "How do you approach the sealed gate?",
        ...(input.allowedPlayerIds
          ? { allowedPlayerIds: input.allowedPlayerIds }
          : {}),
        options: [
          { optionId: "option:inspect-runes", label: "Inspect the runes" },
          { optionId: "option:force-gate", label: "Force the gate" },
        ],
      },
      createdAt: "2026-08-05T04:20:00.000Z",
    }],
    initializedAt: "2026-08-05T04:19:00.000Z",
  };
}

function choiceRequest(input: {
  campaignId: string;
  commandId?: string;
  optionId?: string;
  expectedRevision?: number;
}) {
  return {
    protocolVersion: 2,
    campaignId: input.campaignId,
    commandId: input.commandId ?? "command:choice-one",
    issuedAt: "2026-08-05T04:21:00.000Z",
    command: {
      kind: "campaign.submit_choice",
      expectedGameframeCoordinationRevision: input.expectedRevision ?? 1,
      choiceId: "choice:academy-gate",
      optionId: input.optionId ?? "option:inspect-runes",
    },
  };
}

test("commits a visible bounded choice, presentation event, and runtime delivery atomically", async () => {
  const filePath = databasePath();
  const service = new DurableRpgCampaignService({ filePath });
  service.bootstrapCampaign(choiceCampaign({ campaignId: "campaign-choice" }));

  const request = choiceRequest({ campaignId: "campaign-choice" });
  const receipt = await service.handleCommand(request, {
    kind: "player",
    playerId: "player:ada",
  });
  assert.equal(receipt.gameframeCoordinationRevision, 2);
  assert.equal(receipt.presentationSequence, 2);
  assert.equal(receipt.eventIds.length, 1);

  const retry = await service.handleCommand(request, {
    kind: "player",
    playerId: "player:ada",
  });
  assert.deepEqual(retry, receipt);

  const projection = await service.attachCampaign({
    protocolVersion: 2,
    campaignId: "campaign-choice",
  }, {
    kind: "player",
    playerId: "player:ada",
  });
  const submitted = projection.events.find((event) =>
    event.kind === "campaign.choice_submitted"
  );
  assert.deepEqual(submitted?.payload, {
    commandId: "command:choice-one",
    actorId: "player:ada",
    choiceId: "choice:academy-gate",
    optionId: "option:inspect-runes",
    label: "Inspect the runes",
  });

  const outbox = new SqliteRuntimeCommandOutbox({ filePath });
  const delivery = outbox.get(receipt.deliveryId)?.delivery;
  assert.deepEqual(delivery?.command, {
    kind: "campaign.submit_choice",
    choiceId: "choice:academy-gate",
    optionId: "option:inspect-runes",
  });
  assert.equal(delivery?.acceptedGameframeCoordinationRevision, 2);
  assert.equal(delivery?.acceptedPresentationSequence, 2);
  outbox.close();
  service.close();
});

test("rejects options that were not authored by the visible choice", async () => {
  const service = new DurableRpgCampaignService({ filePath: databasePath() });
  service.bootstrapCampaign(choiceCampaign({ campaignId: "campaign-invalid-option" }));

  await assert.rejects(
    service.handleCommand(choiceRequest({
      campaignId: "campaign-invalid-option",
      optionId: "option:invented",
    }), {
      kind: "player",
      playerId: "player:ada",
    }),
    (error: unknown) => error instanceof DurableRpgCampaignServiceError
      && error.code === "choice-option-not-found"
      && error.status === 400,
  );
  service.close();
});

test("enforces allowed players and one accepted command identity per choice", async () => {
  const service = new DurableRpgCampaignService({ filePath: databasePath() });
  service.bootstrapCampaign(choiceCampaign({
    campaignId: "campaign-restricted",
    allowedPlayerIds: ["player:bryn"],
  }));
  await assert.rejects(
    service.handleCommand(choiceRequest({ campaignId: "campaign-restricted" }), {
      kind: "player",
      playerId: "player:ada",
    }),
    (error: unknown) => error instanceof DurableRpgCampaignServiceError
      && error.code === "choice-not-authorized"
      && error.status === 403,
  );

  service.bootstrapCampaign(choiceCampaign({ campaignId: "campaign-single-answer" }));
  await service.handleCommand(choiceRequest({ campaignId: "campaign-single-answer" }), {
    kind: "player",
    playerId: "player:ada",
  });
  await assert.rejects(
    service.handleCommand(choiceRequest({
      campaignId: "campaign-single-answer",
      commandId: "command:choice-two",
      optionId: "option:force-gate",
      expectedRevision: 2,
    }), {
      kind: "player",
      playerId: "player:ada",
    }),
    (error: unknown) => error instanceof DurableRpgCampaignServiceError
      && error.code === "choice-already-submitted"
      && error.status === 409,
  );
  service.close();
});
