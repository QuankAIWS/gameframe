import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { GAMEFRAME_BOT_PLAYER_ID } from "../agents/gameframe-bot.ts";
import type { DurableCampaignBootstrap } from "../rpg/sqlite-rpg-campaign-store.ts";
import { createDurableRpgHttpServer } from "./durable-rpg-http-server.ts";

const directories: string[] = [];

test.afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-durable-rpg-match-http-"));
  directories.push(directory);
  return join(directory, "gameframe.sqlite");
}

function bootstrap(): DurableCampaignBootstrap {
  return {
    campaignId: "campaign-one",
    title: "Cooperative reference campaign",
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
      {
        playerId: "player:outsider",
        role: "observer",
        joinedPresentationSequence: 0,
      },
    ],
    events: [],
    initializedAt: "2026-08-07T13:30:00.000Z",
  };
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
        rulesState: { creatureIds: ["creature:bulwark:warden"] },
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

async function start(filePath: string, withBootstrap: boolean) {
  const server = createDurableRpgHttpServer({
    filePath,
    ...(withBootstrap ? { bootstrapCampaigns: [bootstrap()] } : {}),
    clock: () => "2026-08-07T13:31:00.000Z",
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP address");
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

function playerHeaders(playerId: string): HeadersInit {
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

async function json(response: Response): Promise<Record<string, any>> {
  return await response.json() as Record<string, any>;
}

test("durable cooperative RPG battle materializes exact participant creatures and survives restart", async () => {
  const filePath = databasePath();
  const launch = launchRequest();
  let runtime = await start(filePath, true);
  let persistedRevision = 0;
  const expectedTeamUnits = ["creature:emberling:ada", "creature:bulwark:bryn"];
  const expectedParticipantUnits = {
    "participant:ada": ["creature:emberling:ada"],
    "participant:bryn": ["creature:bulwark:bryn"],
    "participant:warden": ["creature:bulwark:warden"],
  };
  try {
    const launchedResponse = await fetch(
      `${runtime.baseUrl}/api/rpg/encounters`,
      post(launch, serviceHeaders("rpg-gm-runtime")),
    );
    assert.equal(launchedResponse.status, 200);
    const launched = await json(launchedResponse);
    assert.equal(launched.state, "preparing");
    assert.equal(launched.play.gameId, "monster-master-duel");
    assert.equal(launched.play.matchId, "rpg:encounter-one");
    assert.equal(launched.play.control.mode, "shared-team");
    assert.equal(launched.play.control.mappingMode, "shared-team-roster");
    assert.deepEqual(launched.play.control.playerIds, ["player:ada", "player:bryn"]);
    assert.deepEqual(launched.play.control.teamUnitIds, expectedTeamUnits);
    assert.deepEqual(launched.play.control.participantUnitIds, expectedParticipantUnits);

    const adaResponse = await fetch(
      `${runtime.baseUrl}/api/matches/${encodeURIComponent("rpg:encounter-one")}`,
      { headers: playerHeaders("player:ada") },
    );
    assert.equal(adaResponse.status, 200);
    const ada = await json(adaResponse);
    assert.deepEqual(ada.playerIds, ["player:ada", GAMEFRAME_BOT_PLAYER_ID]);
    assert.equal(ada.observation.yourPlayerId, "player:ada");
    assert.equal(ada.rpgControl.playerId, "player:ada");
    assert.deepEqual(ada.rpgControl.teamPlayerIds, ["player:ada", "player:bryn"]);
    assert.deepEqual(ada.rpgControl.controlledParticipantIds, ["participant:ada"]);
    assert.deepEqual(ada.rpgControl.controlledUnitIds, expectedTeamUnits);
    assert.deepEqual(ada.rpgControl.assignedUnitIds, ["creature:emberling:ada"]);
    assert.deepEqual(
      ada.observation.rosters["player:ada"].map((unit: any) => [unit.id, unit.role]),
      [
        ["creature:emberling:ada", "emberling"],
        ["creature:bulwark:bryn", "bulwark"],
      ],
    );
    assert.deepEqual(
      ada.observation.rosters[GAMEFRAME_BOT_PLAYER_ID].map((unit: any) => [unit.id, unit.role]),
      [["creature:bulwark:warden", "bulwark"]],
    );
    assert.equal(
      Object.values(ada.observation.rosters).flat().some((unit: any) => unit.role === "master"),
      false,
      "campaign trainers must not be substituted with the fixed Warden Master tactical unit",
    );

    const brynResponse = await fetch(
      `${runtime.baseUrl}/api/matches/${encodeURIComponent("rpg:encounter-one")}`,
      { headers: playerHeaders("player:bryn") },
    );
    assert.equal(brynResponse.status, 200);
    const bryn = await json(brynResponse);
    assert.deepEqual(bryn.playerIds, ["player:bryn", GAMEFRAME_BOT_PLAYER_ID]);
    assert.equal(bryn.observation.yourPlayerId, "player:bryn");
    assert.deepEqual(bryn.rpgControl.controlledParticipantIds, ["participant:bryn"]);
    assert.deepEqual(bryn.rpgControl.controlledUnitIds, expectedTeamUnits);
    assert.deepEqual(bryn.rpgControl.assignedUnitIds, ["creature:bulwark:bryn"]);

    const outsider = await fetch(
      `${runtime.baseUrl}/api/matches/${encodeURIComponent("rpg:encounter-one")}`,
      { headers: playerHeaders("player:outsider") },
    );
    assert.equal(outsider.status, 403);

    const legalAction = bryn.observation.legalActions[0];
    assert.ok(legalAction, "expected the allied configured roster to have a legal opening action");
    assert.ok(expectedTeamUnits.includes(legalAction.unitId));
    const actionResponse = await fetch(
      `${runtime.baseUrl}/api/matches/${encodeURIComponent("rpg:encounter-one")}/actions`,
      post({
        actionId: "action:bryn:first",
        expectedRevision: bryn.revision,
        action: legalAction,
      }, playerHeaders("player:bryn")),
    );
    assert.equal(actionResponse.status, 200);
    const actionView = await json(actionResponse);
    assert.equal(actionView.rpgControl.playerId, "player:bryn");
    assert.ok(actionView.revision > bryn.revision);
    persistedRevision = actionView.revision;
  } finally {
    await close(runtime.server);
  }

  runtime = await start(filePath, false);
  try {
    const retryResponse = await fetch(
      `${runtime.baseUrl}/api/rpg/encounters`,
      post(launch, serviceHeaders("rpg-gm-runtime")),
    );
    assert.equal(retryResponse.status, 200);
    const retry = await json(retryResponse);
    assert.equal(retry.play.matchId, "rpg:encounter-one");
    assert.deepEqual(retry.play.control.teamUnitIds, expectedTeamUnits);
    assert.deepEqual(retry.play.control.participantUnitIds, expectedParticipantUnits);

    const resumedResponse = await fetch(
      `${runtime.baseUrl}/api/matches/${encodeURIComponent("rpg:encounter-one")}`,
      { headers: playerHeaders("player:ada") },
    );
    assert.equal(resumedResponse.status, 200);
    const resumed = await json(resumedResponse);
    assert.equal(resumed.revision, persistedRevision);
    assert.deepEqual(resumed.rpgControl.controlledUnitIds, expectedTeamUnits);
    assert.deepEqual(resumed.rpgControl.assignedUnitIds, ["creature:emberling:ada"]);
    assert.deepEqual(resumed.rpgControl.teamPlayerIds, ["player:ada", "player:bryn"]);
    assert.deepEqual(
      resumed.observation.rosters["player:ada"].map((unit: any) => unit.id),
      expectedTeamUnits,
    );

    const runtimeRead = await fetch(
      `${runtime.baseUrl}/api/rpg/encounters/encounter-one`,
      { headers: serviceHeaders("rpg-gm-runtime") },
    );
    assert.equal(runtimeRead.status, 200);
    const handle = await json(runtimeRead);
    assert.equal(handle.play.matchId, "rpg:encounter-one");
    assert.deepEqual(handle.play.control.participantUnitIds, expectedParticipantUnits);
  } finally {
    await close(runtime.server);
  }
});

test("durable RPG launch rejects unsupported creature configuration before encounter custody", async () => {
  const filePath = databasePath();
  const runtime = await start(filePath, true);
  try {
    const launch = launchRequest();
    launch.participants[0]!.rulesState = { creatureIds: ["creature:unimplemented:ada"] };
    const response = await fetch(
      `${runtime.baseUrl}/api/rpg/encounters`,
      post(launch, serviceHeaders("rpg-gm-runtime")),
    );
    assert.equal(response.status, 400);
    const failure = await json(response);
    assert.equal(failure.error, "unsupported-encounter-configuration");

    const missing = await fetch(
      `${runtime.baseUrl}/api/rpg/encounters/encounter-one`,
      { headers: serviceHeaders("rpg-gm-runtime") },
    );
    assert.equal(missing.status, 404);
  } finally {
    await close(runtime.server);
  }
});

test("durable RPG launch rejects player participants split across tactical teams before custody", async () => {
  const filePath = databasePath();
  const runtime = await start(filePath, true);
  try {
    const launch = launchRequest();
    launch.participants[1]!.teamId = "team:second-player";
    const response = await fetch(
      `${runtime.baseUrl}/api/rpg/encounters`,
      post(launch, serviceHeaders("rpg-gm-runtime")),
    );
    assert.equal(response.status, 400);

    const missing = await fetch(
      `${runtime.baseUrl}/api/rpg/encounters/encounter-one`,
      { headers: serviceHeaders("rpg-gm-runtime") },
    );
    assert.equal(missing.status, 404);
  } finally {
    await close(runtime.server);
  }
});
