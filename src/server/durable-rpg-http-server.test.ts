import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { DurableCampaignBootstrap } from "../rpg/sqlite-rpg-campaign-store.ts";
import { SqliteRuntimeCommandOutbox } from "../rpg/runtime-command-outbox.ts";
import { createDurableRpgHttpServer } from "./durable-rpg-http-server.ts";

const directories: string[] = [];

test.afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-durable-rpg-http-"));
  directories.push(directory);
  return join(directory, "gameframe.sqlite");
}

function bootstrap(): DurableCampaignBootstrap {
  return {
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
        playerId: "player:bryn",
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
  };
}

async function start(filePath: string) {
  const timestamps = [
    "2026-08-04T22:42:00.000Z",
    "2026-08-04T22:43:00.000Z",
    "2026-08-04T22:44:00.000Z",
  ];
  let timestampIndex = 0;
  const server = createDurableRpgHttpServer({
    filePath,
    bootstrapCampaigns: [bootstrap()],
    clock: () => timestamps[Math.min(timestampIndex++, timestamps.length - 1)]!,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP address");
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

function playerHeaders(playerId = "player:ada"): HeadersInit {
  return {
    "content-type": "application/json",
    "x-gameframe-player-id": playerId,
  };
}

function serviceHeaders(serviceId: string): HeadersInit {
  return {
    "content-type": "application/json",
    "x-gameframe-service-id": serviceId,
  };
}

function post(value: unknown, headers: HeadersInit): RequestInit {
  return {
    method: "POST",
    headers,
    body: JSON.stringify(value),
  };
}

async function close(server: ReturnType<typeof createDurableRpgHttpServer>): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve())
  );
}

test("serves durable campaign command and runtime-result flow over authenticated HTTP", async () => {
  const filePath = databasePath();
  const { server, baseUrl } = await start(filePath);
  try {
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), {
      status: "ok",
      service: "scribbles-gameframe-rpg",
      protocolVersion: 2,
      storage: "sqlite",
      capabilities: [
        "durable-campaigns",
        "durable-command-outbox",
        "runtime-narrative-linkage",
        "durable-encounters",
        "terminal-outcomes",
      ],
    });

    const unauthorized = await fetch(
      `${baseUrl}/api/rpg/campaigns/campaign-one/attach`,
      post({ protocolVersion: 2, campaignId: "campaign-one" }, {
        "content-type": "application/json",
      }),
    );
    assert.equal(unauthorized.status, 401);

    const attached = await fetch(
      `${baseUrl}/api/rpg/campaigns/campaign-one/attach`,
      post(
        { protocolVersion: 2, campaignId: "campaign-one" },
        playerHeaders(),
      ),
    );
    assert.equal(attached.status, 200);
    const projection = await attached.json() as Record<string, unknown>;
    assert.deepEqual(
      (projection.events as Array<{ eventId: string }>).map((event) => event.eventId),
      ["event:public", "event:ada-private"],
    );

    const mismatch = await fetch(
      `${baseUrl}/api/rpg/campaigns/campaign-one/commands`,
      post({ protocolVersion: 2, campaignId: "campaign-two" }, playerHeaders()),
    );
    assert.equal(mismatch.status, 400);
    assert.equal((await mismatch.json() as Record<string, unknown>).error, "route-identity-mismatch");

    const command = {
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
    };
    const acceptedResponse = await fetch(
      `${baseUrl}/api/rpg/campaigns/campaign-one/commands`,
      post(command, playerHeaders()),
    );
    assert.equal(acceptedResponse.status, 200);
    const accepted = await acceptedResponse.json() as Record<string, unknown>;
    assert.equal(accepted.gameframeCoordinationRevision, 4);
    assert.equal(accepted.presentationSequence, 4);

    const retry = await fetch(
      `${baseUrl}/api/rpg/campaigns/campaign-one/commands`,
      post(command, playerHeaders()),
    );
    assert.deepEqual(await retry.json(), accepted);

    const playerRuntimeAttempt = await fetch(
      `${baseUrl}/api/rpg/campaigns/campaign-one/events`,
      post({ protocolVersion: 2, campaignId: "campaign-one" }, playerHeaders()),
    );
    assert.equal(playerRuntimeAttempt.status, 403);

    const linkedResponse = await fetch(
      `${baseUrl}/api/rpg/campaigns/campaign-one/events`,
      post(
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
          ],
        },
        serviceHeaders("rpg-gm-runtime"),
      ),
    );
    assert.equal(linkedResponse.status, 200);
    const linked = await linkedResponse.json() as Record<string, unknown>;
    assert.equal(linked.gameframeCoordinationRevision, 5);
    assert.equal(linked.linkedNarrativeRevision, 1);

    const refreshed = await fetch(
      `${baseUrl}/api/rpg/campaigns/campaign-one/attach`,
      post(
        { protocolVersion: 2, campaignId: "campaign-one" },
        playerHeaders(),
      ),
    ).then((response) => response.json()) as Record<string, unknown>;
    assert.equal(
      (refreshed.events as Array<{ eventId: string }>).some(
        (event) => event.eventId === "event:result-public",
      ),
      true,
    );

    const outbox = new SqliteRuntimeCommandOutbox({ filePath });
    assert.equal(outbox.listPending()[0]?.delivery.commandId, "command-one");
    outbox.close();
  } finally {
    await close(server);
  }
});

test("serves durable encounter launch, retrieval, and immutable completion over HTTP", async () => {
  const filePath = databasePath();
  const { server, baseUrl } = await start(filePath);
  try {
    const launch = {
      protocolVersion: 2,
      coordinationMutationId: "coordination:encounter-one",
      expectedGameframeCoordinationRevision: 3,
      runtimeCommit: {
        kind: "runtime.narrative_committed",
        runtimeCommitKind: "runtime.encounter_launch",
        runtimeCommitId: "runtime-commit:encounter-one",
        sourceGameframeCoordinationRevision: 3,
        previousNarrativeRevision: 0,
        narrativeRevision: 1,
      },
      encounterId: "encounter-one",
      campaignId: "campaign-one",
      rulesetId: "monster-master-duel",
      idempotencyKey: "idempotency:encounter-one",
      difficulty: { profile: "normal" },
      participants: [
        {
          participantId: "participant:ada",
          controller: { kind: "player", playerId: "player:ada" },
          teamId: "team:keepers",
        },
        {
          participantId: "participant:bryn",
          controller: { kind: "player", playerId: "player:bryn" },
          teamId: "team:rivals",
        },
      ],
      objectives: [{ objectiveId: "objective:win", kind: "defeat-opposition" }],
      battlefield: { mapId: "academy-gate" },
    };
    const launchedResponse = await fetch(
      `${baseUrl}/api/rpg/encounters`,
      post(launch, serviceHeaders("rpg-gm-runtime")),
    );
    assert.equal(launchedResponse.status, 200);
    const launched = await launchedResponse.json() as Record<string, unknown>;
    assert.equal(launched.state, "preparing");
    assert.equal(launched.gameframeCoordinationRevision, 4);

    const playerRead = await fetch(
      `${baseUrl}/api/rpg/encounters/encounter-one`,
      { headers: playerHeaders() },
    );
    assert.equal(playerRead.status, 403);

    const runtimeRead = await fetch(
      `${baseUrl}/api/rpg/encounters/encounter-one`,
      { headers: serviceHeaders("rpg-gm-runtime") },
    );
    assert.deepEqual(await runtimeRead.json(), launched);

    const completion = {
      protocolVersion: 2,
      completionId: "completion:encounter-one",
      encounterId: "encounter-one",
      outcome: {
        kind: "encounter.terminal_outcome",
        result: "victory",
        winnerTeamId: "team:keepers",
        objectiveResults: [{ objectiveId: "objective:win", status: "completed" }],
        participantResults: [
          {
            participantId: "participant:ada",
            status: "active",
            healthRemaining: 8,
            conditions: [],
            resourceChanges: {},
          },
          {
            participantId: "participant:bryn",
            status: "defeated",
            healthRemaining: 0,
            conditions: ["defeated"],
            resourceChanges: {},
          },
        ],
        rewards: [],
        ruleset: { id: "monster-master-duel", revision: 1 },
        commit: {
          matchId: "match:encounter-one",
          matchRevision: 14,
          eventCount: 14,
          completedAt: "2026-08-04T22:50:00.000Z",
        },
      },
    };
    const completedResponse = await fetch(
      `${baseUrl}/api/rpg/encounters/encounter-one/complete`,
      post(completion, serviceHeaders("gameframe-encounter-engine")),
    );
    assert.equal(completedResponse.status, 200);
    const completed = await completedResponse.json() as Record<string, unknown>;
    assert.equal(completed.state, "completed");
    assert.equal((completed.terminalOutcome as Record<string, unknown>).result, "victory");

    const completionRetry = await fetch(
      `${baseUrl}/api/rpg/encounters/encounter-one/complete`,
      post(completion, serviceHeaders("gameframe-encounter-engine")),
    );
    assert.deepEqual(await completionRetry.json(), completed);
  } finally {
    await close(server);
  }
});
