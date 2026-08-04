import assert from "node:assert/strict";
import test from "node:test";
import { createGameFrameServer } from "./http-server.ts";

function playerFetch(url: string, playerId: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-gameframe-player-id", playerId);
  return fetch(url, { ...init, headers });
}

function serviceFetch(url: string, serviceId: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-gameframe-service-id", serviceId);
  return fetch(url, { ...init, headers });
}

function jsonBody(value: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  };
}

const campaignId = "campaign-monster-master-reference";
const command = {
  protocolVersion: 1,
  commandId: "command:open-gate",
  campaignId,
  issuedAt: "2026-08-04T12:05:00.000Z",
  command: {
    kind: "campaign.submit_action",
    expectedRevision: 4,
    visibility: "public",
    text: "Inspect the academy gate.",
  },
};
const encounter = {
  protocolVersion: 1,
  encounterId: "encounter:academy-gate",
  campaignId,
  campaignRevision: 5,
  rulesetId: "monster-master-duel",
  idempotencyKey: "encounter:academy-gate:v1",
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
      participantId: "trainer:ada",
      controller: { kind: "player", playerId: "player:ada" },
      teamId: "party:keepers",
      displayName: "Ada",
      rulesState: { creatureIds: ["creature:emberling:ada"] },
    },
    {
      participantId: "trainer:rival",
      controller: { kind: "runtime" },
      teamId: "faction:rival-house",
      displayName: "Rival Trainer",
      rulesState: { creatureIds: ["creature:bulwark:rival"] },
    },
  ],
  objectives: [
    {
      objectiveId: "objective:defeat-rival",
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

async function attach(base: string, playerId: string, connectionId: string) {
  return await playerFetch(
    `${base}/api/rpg/campaigns/${campaignId}/attach`,
    playerId,
    jsonBody({
      protocolVersion: 1,
      kind: "campaign.attach",
      campaignId,
      connectionId,
    }),
  );
}

test("Node RPG HTTP boundary executes campaign-port-a through encounter launch", async (context) => {
  const server = createGameFrameServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected an internet address.");
  const base = `http://127.0.0.1:${address.port}`;

  const health = await fetch(`${base}/api/health`).then((response) => response.json());
  assert.equal(health.rpg.campaignProtocolVersion, 2);
  assert.equal(health.rpg.encounterProtocolVersion, 2);

  const attachAda = await attach(base, "player:ada", "connection:ada");
  assert.equal(attachAda.status, 200);
  const adaView = await attachAda.json();
  assert.deepEqual(
    adaView.events.map((event: { eventId: string }) => event.eventId),
    ["event-scene-gate", "event-reveal-ada"],
  );

  const attachBryn = await attach(base, "player:bryn", "connection:bryn");
  assert.equal(attachBryn.status, 200);
  const brynView = await attachBryn.json();
  assert.deepEqual(
    brynView.events.map((event: { eventId: string }) => event.eventId),
    ["event-scene-gate"],
  );

  assert.equal((await attach(base, "player:outsider", "connection:outsider")).status, 403);

  const serviceAttach = await serviceFetch(
    `${base}/api/rpg/campaigns/${campaignId}/attach`,
    "rpg-gm-runtime",
    jsonBody({
      protocolVersion: 1,
      kind: "campaign.attach",
      campaignId,
      connectionId: "connection:runtime",
    }),
  );
  assert.equal(serviceAttach.status, 403);

  const acceptedResponse = await playerFetch(
    `${base}/api/rpg/campaigns/${campaignId}/commands`,
    "player:ada",
    jsonBody(command),
  );
  assert.equal(acceptedResponse.status, 200);
  const accepted = await acceptedResponse.json();
  assert.equal(accepted.kind, "campaign.command_accepted");
  assert.equal(accepted.campaignRevision, 5);

  const retryResponse = await playerFetch(
    `${base}/api/rpg/campaigns/${campaignId}/commands`,
    "player:ada",
    jsonBody(command),
  );
  assert.equal(retryResponse.status, 200);
  assert.deepEqual(await retryResponse.json(), accepted);

  const afterRetry = await attach(base, "player:ada", "connection:ada:after-retry")
    .then((response) => response.json());
  assert.equal(
    afterRetry.events.filter(
      (event: { type: string }) => event.type === "campaign.action_submitted",
    ).length,
    1,
  );

  const crossPrincipalRetry = await playerFetch(
    `${base}/api/rpg/campaigns/${campaignId}/commands`,
    "player:bryn",
    jsonBody(command),
  );
  assert.equal(crossPrincipalRetry.status, 409);
  assert.equal((await crossPrincipalRetry.json()).code, "revision-conflict");

  const conflictResponse = await playerFetch(
    `${base}/api/rpg/campaigns/${campaignId}/commands`,
    "player:ada",
    jsonBody({
      ...command,
      command: { ...command.command, text: "Leave the academy grounds." },
    }),
  );
  assert.equal(conflictResponse.status, 409);
  const conflict = await conflictResponse.json();
  assert.equal(conflict.code, "invalid-command");
  assert.equal(conflict.retryable, false);

  const staleResponse = await playerFetch(
    `${base}/api/rpg/campaigns/${campaignId}/commands`,
    "player:bryn",
    jsonBody({ ...command, commandId: "command:knock-gate" }),
  );
  assert.equal(staleResponse.status, 409);
  const stale = await staleResponse.json();
  assert.equal(stale.code, "revision-conflict");
  assert.equal(stale.retryable, true);
  assert.equal(stale.campaignRevision, 5);

  const launchResponse = await serviceFetch(
    `${base}/api/rpg/encounters`,
    "rpg-gm-runtime",
    jsonBody(encounter),
  );
  assert.equal(launchResponse.status, 200);
  const launched = await launchResponse.json();
  assert.equal(launched.state, "preparing");
  assert.equal(launched.resumeToken, "mock:encounter:academy-gate");

  const immediateRetry = await serviceFetch(
    `${base}/api/rpg/encounters`,
    "rpg-gm-runtime",
    jsonBody(encounter),
  );
  assert.equal(immediateRetry.status, 200);
  assert.deepEqual(await immediateRetry.json(), launched);

  const advanceResponse = await playerFetch(
    `${base}/api/rpg/campaigns/${campaignId}/commands`,
    "player:bryn",
    jsonBody({
      protocolVersion: 1,
      commandId: "command:advance-after-encounter-launch",
      campaignId,
      issuedAt: "2026-08-04T12:07:00.000Z",
      command: {
        kind: "campaign.submit_action",
        expectedRevision: 5,
        visibility: "public",
        text: "Stand ready at the gate.",
      },
    }),
  );
  assert.equal(advanceResponse.status, 200);
  assert.equal((await advanceResponse.json()).campaignRevision, 6);

  const lostResponseRetry = await serviceFetch(
    `${base}/api/rpg/encounters`,
    "rpg-gm-runtime",
    jsonBody(encounter),
  );
  assert.equal(lostResponseRetry.status, 200);
  assert.deepEqual(await lostResponseRetry.json(), launched);

  const forbiddenLaunch = await playerFetch(
    `${base}/api/rpg/encounters`,
    "player:ada",
    jsonBody(encounter),
  );
  assert.equal(forbiddenLaunch.status, 403);

  const fetched = await serviceFetch(
    `${base}/api/rpg/encounters/${encounter.encounterId}`,
    "rpg-gm-runtime",
  );
  assert.equal(fetched.status, 200);
  assert.deepEqual(await fetched.json(), launched);

  const wrongServiceFetch = await serviceFetch(
    `${base}/api/rpg/encounters/${encounter.encounterId}`,
    "other-runtime-service",
  );
  assert.equal(wrongServiceFetch.status, 403);
});

test("development auth rejects ambiguous identities and service use of player matches", async (context) => {
  const server = createGameFrameServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected an internet address.");
  const base = `http://127.0.0.1:${address.port}`;

  const ambiguous = await fetch(`${base}/api/session`, {
    headers: {
      "x-gameframe-player-id": "player:ada",
      "x-gameframe-service-id": "rpg-gm-runtime",
    },
  });
  assert.equal(ambiguous.status, 403);
  assert.equal((await ambiguous.json()).error, "identity_mismatch");

  const serviceMatch = await serviceFetch(
    `${base}/api/matches`,
    "rpg-gm-runtime",
    jsonBody({ playerIds: ["rpg-gm-runtime", "player:bob"] }),
  );
  assert.equal(serviceMatch.status, 403);
});
