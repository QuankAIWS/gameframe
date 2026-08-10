import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  DurableRpgCampaignService,
  DurableRpgCampaignServiceError,
} from "./durable-rpg-campaign-service.ts";
import { SqliteRuntimeCommandOutbox } from "./runtime-command-outbox.ts";

const directories: string[] = [];

test.afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-rpg-travel-"));
  directories.push(directory);
  return join(directory, "gameframe.sqlite");
}

function bootstrap(service: DurableRpgCampaignService): void {
  service.bootstrapCampaign({
    campaignId: "campaign-travel",
    title: "Travel custody",
    status: "active",
    state: {
      gameframeCoordinationRevision: 3,
      presentationSequence: 0,
      linkedNarrativeRevision: 0,
    },
    memberships: [{
      playerId: "player:ada",
      role: "player",
      partyId: "party:keepers",
      joinedPresentationSequence: 0,
    }],
    events: [],
    initializedAt: "2026-08-10T15:30:00.000Z",
  });
}

const travel = {
  campaignId: "campaign-travel",
  commandId: "command:travel-west",
  expectedGameframeCoordinationRevision: 3,
  issuedAt: "2026-08-10T15:31:00.000Z",
  interactionTargetId: "route:route.crooked-checkpoint-west-woods",
  routeId: "route.crooked-checkpoint-west-woods",
  routeDisplayLabel: "West Woods Route",
};

test("authorized Travel commits one canonical Runtime command and exact retry custody", async () => {
  const filePath = databasePath();
  const service = new DurableRpgCampaignService({ filePath });
  bootstrap(service);

  const receipt = service.handleAuthorizedExplorationTravel(
    travel,
    { kind: "player", playerId: "player:ada" },
  );
  assert.equal(receipt.gameframeCoordinationRevision, 4);
  assert.equal(receipt.presentationSequence, 1);

  const replay = service.findCommittedExplorationTravel(
    travel,
    { kind: "player", playerId: "player:ada" },
  );
  assert.deepEqual(replay, receipt);

  const projection = await service.attachCampaign(
    { protocolVersion: 2, campaignId: "campaign-travel" },
    { kind: "player", playerId: "player:ada" },
  );
  assert.deepEqual(projection.events.at(-1)?.payload, {
    commandId: travel.commandId,
    actorId: "player:ada",
    text: "Travel the selected route.",
    interaction: "travel",
    interactionTargetId: travel.interactionTargetId,
    routeDisplayLabel: "West Woods Route",
  });
  service.close();

  const outbox = new SqliteRuntimeCommandOutbox({ filePath });
  const [pending] = outbox.listPending();
  assert.deepEqual(pending?.delivery.command, {
    kind: "campaign.submit_action",
    visibility: "private-to-runtime",
    text: "Travel the selected route.",
    interaction: {
      kind: "travel",
      routeId: "route.crooked-checkpoint-west-woods",
    },
  });
  outbox.close();
});

test("Travel retry rejects a reused command ID with a different physical route handle", () => {
  const filePath = databasePath();
  const service = new DurableRpgCampaignService({ filePath });
  bootstrap(service);
  service.handleAuthorizedExplorationTravel(
    travel,
    { kind: "player", playerId: "player:ada" },
  );

  assert.throws(
    () => service.findCommittedExplorationTravel(
      { ...travel, interactionTargetId: "route:some-other-route" },
      { kind: "player", playerId: "player:ada" },
    ),
    (error: unknown) => error instanceof DurableRpgCampaignServiceError
      && error.code === "command-conflict",
  );
  service.close();
});
