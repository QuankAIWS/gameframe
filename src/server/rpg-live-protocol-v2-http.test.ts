import assert from "node:assert/strict";
import test from "node:test";

import { createGameFrameServer } from "./http-server.ts";

const campaignId = "campaign-monster-master-reference";

function jsonBody(value: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  };
}

function playerFetch(url: string, playerId: string, value: unknown) {
  const init = jsonBody(value);
  const headers = new Headers(init.headers);
  headers.set("x-gameframe-player-id", playerId);
  return fetch(url, { ...init, headers });
}

function serviceFetch(url: string, serviceId: string, value?: unknown) {
  const init = value === undefined ? {} : jsonBody(value);
  const headers = new Headers(init.headers);
  headers.set("x-gameframe-service-id", serviceId);
  return fetch(url, { ...init, headers });
}

function assertV2Position(
  value: Record<string, unknown>,
  expected: {
    coordination: number;
    presentation: number;
    narrative: number;
  },
): void {
  assert.equal(value.gameframeCoordinationRevision, expected.coordination);
  assert.equal(value.presentationSequence, expected.presentation);
  assert.equal(value.linkedNarrativeRevision, expected.narrative);
  assert.equal(Object.hasOwn(value, "campaignRevision"), false);
}

test("live RPG HTTP protocol v2 separates coordination, presentation, and narrative positions", async (context) => {
  const server = createGameFrameServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected an internet address.");
  const base = `http://127.0.0.1:${address.port}`;

  const health = await fetch(`${base}/api/health`).then((response) => response.json());
  assert.equal(health.rpg.campaignProtocolVersion, 2);
  assert.equal(health.rpg.encounterProtocolVersion, 2);
  assert.ok(health.rpg.capabilities.includes("dual-revision-linkage"));
  assert.ok(health.rpg.capabilities.includes("runtime-commit-receipts"));

  const attachResponse = await playerFetch(
    `${base}/api/rpg/campaigns/${campaignId}/attach`,
    "player:ada",
    {
      protocolVersion: 2,
      kind: "campaign.attach",
      campaignId,
      connectionId: "connection:v2:ada",
    },
  );
  assert.equal(attachResponse.status, 200);
  const attached = await attachResponse.json() as Record<string, unknown>;
  assert.equal(attached.protocolVersion, 2);
  assertV2Position(attached, { coordination: 4, presentation: 4, narrative: 0 });

  const command = {
    protocolVersion: 2,
    commandId: "command:v2:inspect-gate",
    campaignId,
    issuedAt: "2026-08-04T16:50:00.000Z",
    command: {
      kind: "campaign.submit_action",
      expectedGameframeCoordinationRevision: 4,
      visibility: "public",
      text: "Inspect the academy gate.",
    },
  };
  const commandResponse = await playerFetch(
    `${base}/api/rpg/campaigns/${campaignId}/commands`,
    "player:ada",
    command,
  );
  assert.equal(commandResponse.status, 200);
  const committedCommand = await commandResponse.json() as Record<string, unknown>;
  assert.equal(committedCommand.kind, "gameframe.command_committed");
  assertV2Position(committedCommand, { coordination: 5, presentation: 5, narrative: 0 });

  const commandRetry = await playerFetch(
    `${base}/api/rpg/campaigns/${campaignId}/commands`,
    "player:ada",
    command,
  );
  assert.equal(commandRetry.status, 200);
  assert.deepEqual(await commandRetry.json(), committedCommand);

  const runtimeEvents = {
    protocolVersion: 2,
    coordinationMutationId: "coordination:v2:present-rival",
    campaignId,
    expectedGameframeCoordinationRevision: 5,
    runtimeCommit: {
      kind: "runtime.narrative_committed",
      runtimeCommitKind: "runtime.events",
      runtimeCommitId: "runtime-commit:v2:present-rival",
      sourceCommandId: "command:v2:inspect-gate",
      sourceGameframeCoordinationRevision: 5,
      previousNarrativeRevision: 0,
      narrativeRevision: 1,
    },
    events: [
      {
        eventId: "event:v2:rival-response",
        type: "narration.presented",
        audience: { kind: "public" },
        payload: { text: "A rival answers from beyond the sealed gate." },
        createdAt: "2026-08-04T16:50:01.000Z",
      },
    ],
  };
  const eventsResponse = await serviceFetch(
    `${base}/api/rpg/campaigns/${campaignId}/events`,
    "rpg-gm-runtime",
    runtimeEvents,
  );
  assert.equal(eventsResponse.status, 200);
  const linkedEvents = await eventsResponse.json() as Record<string, unknown>;
  assert.equal(linkedEvents.kind, "gameframe.runtime_link_committed");
  assert.equal(linkedEvents.runtimeCommitId, "runtime-commit:v2:present-rival");
  assertV2Position(linkedEvents, { coordination: 6, presentation: 6, narrative: 1 });

  const eventsRetry = await serviceFetch(
    `${base}/api/rpg/campaigns/${campaignId}/events`,
    "rpg-gm-runtime",
    runtimeEvents,
  );
  assert.equal(eventsRetry.status, 200);
  assert.deepEqual(await eventsRetry.json(), linkedEvents);

  const staleEvents = await serviceFetch(
    `${base}/api/rpg/campaigns/${campaignId}/events`,
    "rpg-gm-runtime",
    {
      ...runtimeEvents,
      coordinationMutationId: "coordination:v2:stale",
      runtimeCommit: {
        ...runtimeEvents.runtimeCommit,
        runtimeCommitId: "runtime-commit:v2:stale",
      },
    },
  );
  assert.equal(staleEvents.status, 409);
  const staleBody = await staleEvents.json() as Record<string, unknown>;
  assert.equal(staleBody.error, "coordination-revision-conflict");
  assertV2Position(staleBody, { coordination: 6, presentation: 6, narrative: 1 });

  const encounterRequest = {
    protocolVersion: 2,
    coordinationMutationId: "coordination:v2:launch-gate",
    expectedGameframeCoordinationRevision: 6,
    runtimeCommit: {
      kind: "runtime.narrative_committed",
      runtimeCommitKind: "runtime.encounter_launch",
      runtimeCommitId: "runtime-commit:v2:launch-gate",
      sourceCommandId: "command:v2:inspect-gate",
      sourceGameframeCoordinationRevision: 6,
      previousNarrativeRevision: 1,
      narrativeRevision: 2,
    },
    encounterId: "encounter:v2:academy-gate",
    campaignId,
    rulesetId: "monster-master-duel",
    idempotencyKey: "encounter:v2:academy-gate",
    difficulty: {
      id: "normal",
      encounterPressure: "standard",
      enemyTacticalIntensity: "competent",
      defeatConsequences: "consequential",
      characterDeathRisk: "real",
      recoverySupport: "standard",
    },
    participants: [
      {
        participantId: "trainer:ada:v2",
        controller: { kind: "player", playerId: "player:ada" },
        teamId: "party:keepers",
        displayName: "Ada",
        rulesState: { creatureIds: ["creature:emberling:ada"] },
      },
      {
        participantId: "trainer:rival:v2",
        controller: { kind: "runtime" },
        teamId: "faction:rival-house",
        displayName: "Rival Trainer",
        rulesState: { creatureIds: ["creature:bulwark:rival"] },
      },
    ],
    objectives: [
      {
        objectiveId: "objective:v2:defeat-rival",
        kind: "defeat",
        description: "Defeat the rival trainer's active roster.",
        rules: { targetTeamId: "faction:rival-house" },
      },
    ],
    battlefield: {
      theme: "monster-master-academy-gate",
      environmentTags: ["rain", "stone", "academy"],
      layoutHint: "compact-duel",
      assetIds: ["battlefield:academy-gate:v1"],
    },
  };
  const launchResponse = await serviceFetch(
    `${base}/api/rpg/encounters`,
    "rpg-gm-runtime",
    encounterRequest,
  );
  assert.equal(launchResponse.status, 200);
  const launched = await launchResponse.json() as Record<string, unknown>;
  assert.equal(launched.protocolVersion, 2);
  assert.equal(launched.state, "preparing");
  assertV2Position(launched, { coordination: 7, presentation: 6, narrative: 2 });

  const launchRetry = await serviceFetch(
    `${base}/api/rpg/encounters`,
    "rpg-gm-runtime",
    encounterRequest,
  );
  assert.equal(launchRetry.status, 200);
  assert.deepEqual(await launchRetry.json(), launched);

  const fetched = await serviceFetch(
    `${base}/api/rpg/encounters/${encodeURIComponent(String(encounterRequest.encounterId))}`,
    "rpg-gm-runtime",
  );
  assert.equal(fetched.status, 200);
  assert.deepEqual(await fetched.json(), launched);
});
