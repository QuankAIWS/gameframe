import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { WebSocket } from "ws";

import type { DurableCampaignBootstrap } from "../rpg/sqlite-rpg-campaign-store.ts";
import { createDurableRpgHttpServer } from "./durable-rpg-http-server.ts";

const directories: string[] = [];

test.afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-durable-rpg-realtime-"));
  directories.push(directory);
  return join(directory, "gameframe.sqlite");
}

function bootstrap(): DurableCampaignBootstrap {
  return {
    campaignId: "campaign-one",
    title: "Realtime reference campaign",
    status: "active",
    state: {
      gameframeCoordinationRevision: 3,
      presentationSequence: 0,
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
    ],
    events: [],
    initializedAt: "2026-08-08T12:00:00.000Z",
  };
}

async function start() {
  const filePath = databasePath();
  const server = createDurableRpgHttpServer({
    filePath,
    bootstrapCampaigns: [bootstrap()],
    clock: () => "2026-08-08T12:01:00.000Z",
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP address");
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    websocketBaseUrl: `ws://127.0.0.1:${address.port}`,
  };
}

function playerHeaders(playerId: string): Record<string, string> {
  return { "x-gameframe-player-id": playerId };
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

function nextJson(socket: WebSocket): Promise<any> {
  return new Promise((resolve, reject) => {
    const onMessage = (data: WebSocket.RawData) => {
      cleanup();
      try {
        resolve(JSON.parse(data.toString()));
      } catch (error) {
        reject(error);
      }
    };
    const onClose = (code: number, reason: Buffer) => {
      cleanup();
      reject(new Error(`WebSocket closed before message: ${code} ${reason.toString()}`));
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off("message", onMessage);
      socket.off("close", onClose);
      socket.off("error", onError);
    };
    socket.once("message", onMessage);
    socket.once("close", onClose);
    socket.once("error", onError);
  });
}

async function closeRuntime(server: ReturnType<typeof createDurableRpgHttpServer>): Promise<void> {
  await server.closeRealtime();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve())
  );
}

function launchRequest() {
  return {
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
    rulesetId: "monster-master-rpg",
    idempotencyKey: "idempotency:encounter-one",
    difficulty: { profile: "normal" },
    participants: [
      {
        participantId: "participant:ada",
        controller: { kind: "player", playerId: "player:ada" },
        teamId: "team:keepers",
        rulesState: { creatureIds: ["creature:emberling:ada"] },
      },
      {
        participantId: "participant:bryn",
        controller: { kind: "player", playerId: "player:bryn" },
        teamId: "team:keepers",
        rulesState: { creatureIds: ["creature:bulwark:bryn"] },
      },
      {
        participantId: "participant:warden",
        controller: { kind: "runtime" },
        teamId: "team:opposition",
        rulesState: {
          creatureIds: ["creature:bulwark:warden", "creature:emberling:warden"],
        },
      },
    ],
    objectives: [
      {
        objectiveId: "objective:win",
        kind: "defeat-opposition",
        rules: { targetTeamId: "team:opposition" },
      },
    ],
    battlefield: {
      theme: "academy-gate",
      layoutHint: "compact-duel",
      environmentTags: ["academy", "rain"],
      assetIds: ["battlefield:academy-gate:v1"],
    },
  };
}

test("campaign realtime publishes only durable position advances and accepts refresh only", async () => {
  const runtime = await start();
  const socket = new WebSocket(
    `${runtime.websocketBaseUrl}/api/rpg/campaigns/campaign-one/realtime`,
    { headers: playerHeaders("player:ada") },
  );
  try {
    const initial = await nextJson(socket);
    assert.deepEqual(initial, {
      type: "campaign_position",
      reason: "initial",
      protocolVersion: 2,
      campaignId: "campaign-one",
      gameframeCoordinationRevision: 3,
      presentationSequence: 0,
      linkedNarrativeRevision: 0,
    });

    const updatePromise = nextJson(socket);
    const commandResponse = await fetch(
      `${runtime.baseUrl}/api/rpg/campaigns/campaign-one/commands`,
      post({
        protocolVersion: 2,
        campaignId: "campaign-one",
        commandId: "command-one",
        issuedAt: "2026-08-08T12:02:00.000Z",
        command: {
          kind: "campaign.submit_action",
          expectedGameframeCoordinationRevision: 3,
          visibility: "public",
          text: "Inspect the road marker.",
        },
      }, {
        ...playerHeaders("player:ada"),
        "content-type": "application/json",
      }),
    );
    assert.equal(commandResponse.status, 200);
    const update = await updatePromise;
    assert.equal(update.type, "campaign_position");
    assert.equal(update.reason, "update");
    assert.equal(update.gameframeCoordinationRevision, 4);
    assert.equal(update.presentationSequence, 1);

    const refreshPromise = nextJson(socket);
    socket.send(JSON.stringify({ type: "refresh" }));
    const refresh = await refreshPromise;
    assert.equal(refresh.reason, "refresh");
    assert.equal(refresh.gameframeCoordinationRevision, 4);

    const protocolErrorPromise = nextJson(socket);
    socket.send(JSON.stringify({ type: "submit_action" }));
    const protocolError = await protocolErrorPromise;
    assert.equal(protocolError.type, "protocol_error");
    assert.equal(protocolError.code, "unsupported_message");
  } finally {
    socket.close();
    await closeRuntime(runtime.server);
  }
});

test("campaign realtime rejects a player who cannot attach to the campaign", async () => {
  const runtime = await start();
  try {
    const status = await new Promise<number>((resolve, reject) => {
      const socket = new WebSocket(
        `${runtime.websocketBaseUrl}/api/rpg/campaigns/campaign-one/realtime`,
        { headers: playerHeaders("player:outsider") },
      );
      socket.once("unexpected-response", (_request, response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      });
      socket.once("open", () => {
        socket.close();
        reject(new Error("Unauthorized campaign WebSocket unexpectedly opened."));
      });
      socket.once("error", () => {
        // ws emits an error after an HTTP upgrade rejection on some Node builds;
        // unexpected-response is the authoritative assertion above.
      });
    });
    assert.equal(status, 403);
  } finally {
    await closeRuntime(runtime.server);
  }
});

test("RPG tactical realtime reuses match_state and broadcasts committed actions", async () => {
  const runtime = await start();
  let socket: WebSocket | undefined;
  try {
    const launch = await fetch(
      `${runtime.baseUrl}/api/rpg/encounters`,
      post(launchRequest(), serviceHeaders("rpg-gm-runtime")),
    );
    assert.equal(launch.status, 200);

    socket = new WebSocket(
      `${runtime.websocketBaseUrl}/api/matches/${encodeURIComponent("rpg:encounter-one")}/events`,
      { headers: playerHeaders("player:ada") },
    );
    const initial = await nextJson(socket);
    assert.equal(initial.type, "match_state");
    assert.equal(initial.reason, "initial");
    assert.equal(initial.view.matchId, "rpg:encounter-one");
    assert.equal(initial.view.observation.yourPlayerId, "player:ada");

    const legalAction = initial.view.observation.legalActions[0];
    assert.ok(legalAction, "expected configured RPG match to have a legal opening action");
    const updatePromise = nextJson(socket);
    const actionResponse = await fetch(
      `${runtime.baseUrl}/api/matches/${encodeURIComponent("rpg:encounter-one")}/actions`,
      post({
        actionId: "action:ada:first",
        expectedRevision: initial.view.revision,
        action: legalAction,
      }, {
        ...playerHeaders("player:ada"),
        "content-type": "application/json",
      }),
    );
    assert.equal(actionResponse.status, 200);
    const update = await updatePromise;
    assert.equal(update.type, "match_state");
    assert.equal(update.reason, "update");
    assert.ok(update.view.revision > initial.view.revision);
    assert.equal(update.view.observation.yourPlayerId, "player:ada");
  } finally {
    socket?.close();
    await closeRuntime(runtime.server);
  }
});
