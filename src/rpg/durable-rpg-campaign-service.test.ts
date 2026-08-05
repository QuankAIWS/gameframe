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
  const directory = mkdtempSync(join(tmpdir(), "gameframe-durable-rpg-service-"));
  directories.push(directory);
  return join(directory, "gameframe.sqlite");
}

function bootstrap(service: DurableRpgCampaignService) {
  return service.bootstrapCampaign({
    campaignId: "campaign-one",
    title: "Reference campaign",
    status: "active",
    state: {
      gameframeCoordinationRevision: 3,
      presentationSequence: 3,
      linkedNarrativeRevision: 0,
    },
    memberships: [
      {
        playerId: "player:ada",
        role: "player",
        partyId: "party:keepers",
        joinedPresentationSequence: 0,
      },
      {
        playerId: "player:observer",
        role: "observer",
        joinedPresentationSequence: 0,
      },
    ],
    events: [
      {
        eventId: "event:public",
        kind: "scene.presented",
        audience: { kind: "public" },
        payload: { text: "The academy gate is sealed." },
        createdAt: "2026-08-04T22:40:01.000Z",
      },
      {
        eventId: "event:ada-private",
        kind: "campaign.reveal",
        audience: { kind: "player", playerId: "player:ada" },
        payload: { text: "Ada recognizes the crest." },
        createdAt: "2026-08-04T22:40:02.000Z",
      },
      {
        eventId: "event:runtime",
        kind: "campaign.reveal",
        audience: { kind: "runtime" },
        payload: { text: "The seal was placed deliberately." },
        createdAt: "2026-08-04T22:40:03.000Z",
      },
    ],
    initializedAt: "2026-08-04T22:40:00.000Z",
  });
}

function command(overrides: Record<string, unknown> = {}) {
  return {
    protocolVersion: 2,
    campaignId: "campaign-one",
    commandId: "command-one",
    issuedAt: "2026-08-04T22:41:00.000Z",
    command: {
      kind: "campaign.submit_action",
      expectedGameframeCoordinationRevision: 3,
      visibility: "public",
      text: "Inspect the gate.",
    },
    ...overrides,
  };
}

test("attaches authenticated members to durable audience-scoped projections", async () => {
  const service = new DurableRpgCampaignService({ filePath: databasePath() });
  bootstrap(service);

  const ada = await service.attachCampaign(
    { protocolVersion: 2, campaignId: "campaign-one" },
    { kind: "player", playerId: "player:ada" },
  );
  assert.deepEqual(ada.events.map((event) => event.eventId), [
    "event:public",
    "event:ada-private",
  ]);

  const observer = await service.attachCampaign(
    { protocolVersion: 2, campaignId: "campaign-one" },
    { kind: "player", playerId: "player:observer" },
  );
  assert.deepEqual(observer.events.map((event) => event.eventId), ["event:public"]);
  service.close();
});

test("commits public player action, presentation, receipt, and GM outbox", async () => {
  const filePath = databasePath();
  const service = new DurableRpgCampaignService({ filePath });
  bootstrap(service);

  const receipt = await service.handleCommand(
    command(),
    { kind: "player", playerId: "player:ada" },
  );
  assert.equal(receipt.gameframeCoordinationRevision, 4);
  assert.equal(receipt.presentationSequence, 4);
  assert.equal(receipt.eventIds.length, 1);

  const projection = await service.attachCampaign(
    { protocolVersion: 2, campaignId: "campaign-one" },
    { kind: "player", playerId: "player:ada" },
  );
  assert.equal(projection.events.at(-1)?.kind, "campaign.action_submitted");
  service.close();

  const outbox = new SqliteRuntimeCommandOutbox({ filePath });
  const [pending] = outbox.listPending();
  assert.equal(pending?.delivery.commandId, "command-one");
  assert.equal(pending?.delivery.authenticatedPlayerId, "player:ada");
  outbox.close();
});

test("commits private runtime action without publishing player presentation", async () => {
  const filePath = databasePath();
  const service = new DurableRpgCampaignService({ filePath });
  bootstrap(service);
  const request = command({
    commandId: "command-private",
    command: {
      kind: "campaign.submit_action",
      expectedGameframeCoordinationRevision: 3,
      visibility: "private-to-runtime",
      text: "Quietly inspect the damaged crest.",
    },
  });
  const receipt = await service.handleCommand(
    request,
    { kind: "player", playerId: "player:ada" },
  );
  assert.equal(receipt.gameframeCoordinationRevision, 4);
  assert.equal(receipt.presentationSequence, 3);
  assert.deepEqual(receipt.eventIds, []);
  const projection = await service.attachCampaign(
    { protocolVersion: 2, campaignId: "campaign-one" },
    { kind: "player", playerId: "player:ada" },
  );
  assert.equal(projection.events.length, 2);
  service.close();

  const outbox = new SqliteRuntimeCommandOutbox({ filePath });
  assert.equal(outbox.listPending()[0]?.delivery.command.visibility, "private-to-runtime");
  outbox.close();
});

test("returns exact command receipt after service restart", async () => {
  const filePath = databasePath();
  let service = new DurableRpgCampaignService({ filePath });
  bootstrap(service);
  const first = await service.handleCommand(
    command(),
    { kind: "player", playerId: "player:ada" },
  );
  service.close();

  service = new DurableRpgCampaignService({ filePath });
  const retry = await service.handleCommand(
    command(),
    { kind: "player", playerId: "player:ada" },
  );
  assert.deepEqual(retry, first);
  service.close();
});

test("links runtime result durably and preserves runtime-only projection secrecy", async () => {
  const service = new DurableRpgCampaignService({
    filePath: databasePath(),
    clock: () => "2026-08-04T22:42:00.000Z",
  });
  bootstrap(service);
  await service.handleCommand(
    command(),
    { kind: "player", playerId: "player:ada" },
  );

  const receipt = await service.appendRuntimeEvents(
    {
      protocolVersion: 2,
      coordinationMutationId: "coordination:command-one:result",
      campaignId: "campaign-one",
      expectedGameframeCoordinationRevision: 4,
      runtimeCommit: {
        kind: "runtime.narrative_committed",
        runtimeCommitKind: "runtime.events",
        runtimeCommitId: "runtime-commit:command-one",
        sourceCommandId: "command-one",
        sourceGameframeCoordinationRevision: 4,
        previousNarrativeRevision: 0,
        narrativeRevision: 1,
      },
      events: [
        {
          eventId: "event:result-public",
          type: "scene.presented",
          audience: { kind: "public" },
          payload: { narration: "The gate reveals a hidden route." },
          createdAt: "2026-08-04T22:42:01.000Z",
        },
        {
          eventId: "event:result-runtime",
          type: "campaign.reveal",
          audience: { kind: "runtime" },
          payload: { fact: "The rival caused the damage." },
          createdAt: "2026-08-04T22:42:02.000Z",
        },
      ],
    },
    { kind: "runtime", serviceId: "rpg-gm-runtime" },
  );
  assert.equal(receipt.gameframeCoordinationRevision, 5);
  assert.equal(receipt.presentationSequence, 6);
  assert.equal(receipt.linkedNarrativeRevision, 1);

  const projection = await service.attachCampaign(
    { protocolVersion: 2, campaignId: "campaign-one" },
    { kind: "player", playerId: "player:ada" },
  );
  assert.equal(
    projection.events.some((event) => event.eventId === "event:result-public"),
    true,
  );
  assert.equal(
    projection.events.some((event) => event.eventId === "event:result-runtime"),
    false,
  );
  service.close();
});

test("rejects observers, stale commands, and unauthorized runtime services with stable errors", async () => {
  const service = new DurableRpgCampaignService({ filePath: databasePath() });
  bootstrap(service);

  await assert.rejects(
    () => service.handleCommand(
      command(),
      { kind: "player", playerId: "player:observer" },
    ),
    (error: unknown) =>
      error instanceof DurableRpgCampaignServiceError
      && error.code === "player-not-authorized"
      && error.status === 403,
  );

  await service.handleCommand(
    command(),
    { kind: "player", playerId: "player:ada" },
  );
  await assert.rejects(
    () => service.handleCommand(
      command({ commandId: "command-stale" }),
      { kind: "player", playerId: "player:ada" },
    ),
    (error: unknown) =>
      error instanceof DurableRpgCampaignServiceError
      && error.code === "coordination-revision-conflict"
      && error.retryable
      && error.gameframeCoordinationRevision === 4,
  );

  await assert.rejects(
    () => service.appendRuntimeEvents(
      {
        protocolVersion: 2,
        campaignId: "campaign-one",
      },
      { kind: "runtime", serviceId: "other-service" },
    ),
    (error: unknown) =>
      error instanceof DurableRpgCampaignServiceError
      && error.code === "forbidden"
      && error.status === 403,
  );
  service.close();
});
