import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createGameFrameServer } from "./http-server.ts";

type JsonRecord = Record<string, unknown>;

const fixture = JSON.parse(
  readFileSync(
    new URL("../../planning/fixtures/rpg/v1/campaign-port-b.json", import.meta.url),
    "utf8",
  ),
) as JsonRecord;
const campaignId = "campaign-monster-master-reference";

function record(value: unknown, label: string): JsonRecord {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  return value as JsonRecord;
}

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

test("Node RPG HTTP boundary resolves a bounded choice and resumes after a terminal outcome", async (context) => {
  const server = createGameFrameServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected an internet address.");
  const base = `http://127.0.0.1:${address.port}`;

  const health = await fetch(`${base}/api/health`).then((response) => response.json());
  for (const capability of [
    "runtime-events",
    "bounded-choice",
    "deterministic-check",
    "terminal-outcome",
    "campaign-return",
    "dual-revision-linkage",
    "runtime-commit-receipts",
    "legacy-v1-compatibility",
  ]) {
    assert.ok(health.rpg.capabilities.includes(capability), `Missing RPG capability: ${capability}`);
  }

  const initialAction = {
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
  const initialResponse = await playerFetch(
    `${base}/api/rpg/campaigns/${campaignId}/commands`,
    "player:ada",
    jsonBody(initialAction),
  );
  assert.equal(initialResponse.status, 200);
  assert.equal((await initialResponse.json()).campaignRevision, 5);

  const presentation = record(fixture.runtimeChoicePresentationCase, "runtimeChoicePresentationCase");
  const presentationRequest = record(presentation.request, "runtimeChoicePresentationCase.request");
  const eventsPath = `${base}/api/rpg/campaigns/${campaignId}/events`;
  const presentedResponse = await serviceFetch(
    eventsPath,
    "rpg-gm-runtime",
    jsonBody(presentationRequest),
  );
  assert.equal(presentedResponse.status, 200);
  const presented = await presentedResponse.json();
  assert.equal(presented.campaignRevision, 6);

  const presentedRetry = await serviceFetch(
    eventsPath,
    "rpg-gm-runtime",
    jsonBody(presentationRequest),
  );
  assert.equal(presentedRetry.status, 200);
  assert.deepEqual(await presentedRetry.json(), presented);

  const unauthorizedRuntime = await serviceFetch(
    eventsPath,
    "other-runtime-service",
    jsonBody({
      ...presentationRequest,
      batchId: "batch:unauthorized-choice",
      expectedRevision: 6,
    }),
  );
  assert.equal(unauthorizedRuntime.status, 403);

  const choice = record(fixture.choiceCase, "choiceCase");
  const choiceEnvelope = record(choice.envelope, "choiceCase.envelope");
  const commandsPath = `${base}/api/rpg/campaigns/${campaignId}/commands`;

  const wrongPlayerChoice = await playerFetch(
    commandsPath,
    "player:bryn",
    jsonBody(choiceEnvelope),
  );
  assert.equal(wrongPlayerChoice.status, 400);
  assert.equal((await wrongPlayerChoice.json()).error, "invalid-command");

  const choiceResponse = await playerFetch(
    commandsPath,
    "player:ada",
    jsonBody(choiceEnvelope),
  );
  assert.equal(choiceResponse.status, 200);
  const acceptedChoice = await choiceResponse.json();
  assert.equal(acceptedChoice.campaignRevision, 9);
  assert.equal(acceptedChoice.eventIds.length, 3);

  const choiceRetry = await playerFetch(
    commandsPath,
    "player:ada",
    jsonBody(choiceEnvelope),
  );
  assert.equal(choiceRetry.status, 200);
  assert.deepEqual(await choiceRetry.json(), acceptedChoice);

  const afterChoice = await attach(base, "player:ada", "connection:ada:after-choice")
    .then((response) => response.json());
  const eventTypes = afterChoice.events.map((event: { type: string }) => event.type);
  assert.equal(eventTypes.filter((type: string) => type === "choice.presented").length, 1);
  assert.equal(eventTypes.filter((type: string) => type === "campaign.choice_submitted").length, 1);
  assert.equal(eventTypes.filter((type: string) => type === "check.resolved").length, 1);
  assert.equal(eventTypes.filter((type: string) => type === "campaign.consequence").length, 1);
  const resolvedCheck = afterChoice.events.find((event: { type: string }) => event.type === "check.resolved");
  assert.equal(resolvedCheck.payload.total, 14);
  assert.equal(resolvedCheck.payload.result, "success");
  const consequence = afterChoice.events.find(
    (event: { type: string }) => event.type === "campaign.consequence",
  );
  assert.equal(consequence.payload.consequenceId, "consequence:gate-runes-understood");

  const encounter = record(fixture.encounterCase, "encounterCase");
  const encounterRequest = record(encounter.request, "encounterCase.request");
  const launchedResponse = await serviceFetch(
    `${base}/api/rpg/encounters`,
    "rpg-gm-runtime",
    jsonBody(encounterRequest),
  );
  assert.equal(launchedResponse.status, 200);
  const launched = await launchedResponse.json();
  assert.equal(launched.state, "preparing");

  const completion = record(fixture.completionCase, "completionCase");
  const completionRequest = record(completion.request, "completionCase.request");
  const completionPath = `${base}/api/rpg/encounters/${encounterRequest.encounterId}/complete`;
  const runtimeCannotComplete = await serviceFetch(
    completionPath,
    "rpg-gm-runtime",
    jsonBody(completionRequest),
  );
  assert.equal(runtimeCannotComplete.status, 403);

  const completedResponse = await serviceFetch(
    completionPath,
    "gameframe-encounter-engine",
    jsonBody(completionRequest),
  );
  assert.equal(completedResponse.status, 200);
  const completed = await completedResponse.json();
  assert.equal(completed.state, "completed");
  assert.equal(completed.terminalOutcome.result, "victory");
  assert.equal(completed.terminalOutcome.commit.matchRevision, 37);

  const completionRetry = await serviceFetch(
    completionPath,
    "gameframe-encounter-engine",
    jsonBody(completionRequest),
  );
  assert.equal(completionRetry.status, 200);
  assert.deepEqual(await completionRetry.json(), completed);

  const conflictingCompletion = await serviceFetch(
    completionPath,
    "gameframe-encounter-engine",
    jsonBody({
      ...completionRequest,
      outcome: { ...record(completionRequest.outcome, "completion outcome"), result: "defeat" },
    }),
  );
  assert.equal(conflictingCompletion.status, 409);
  assert.equal((await conflictingCompletion.json()).error, "invalid-command");

  const fetchedOutcome = await serviceFetch(
    `${base}/api/rpg/encounters/${encounterRequest.encounterId}`,
    "rpg-gm-runtime",
  );
  assert.equal(fetchedOutcome.status, 200);
  assert.deepEqual(await fetchedOutcome.json(), completed);

  const resume = record(fixture.resumeCase, "resumeCase");
  const resumeRequest = record(resume.request, "resumeCase.request");
  const resumeResponse = await serviceFetch(
    eventsPath,
    "rpg-gm-runtime",
    jsonBody(resumeRequest),
  );
  assert.equal(resumeResponse.status, 200);
  const resumed = await resumeResponse.json();
  assert.equal(resumed.campaignRevision, 11);

  const resumeRetry = await serviceFetch(
    eventsPath,
    "rpg-gm-runtime",
    jsonBody(resumeRequest),
  );
  assert.equal(resumeRetry.status, 200);
  assert.deepEqual(await resumeRetry.json(), resumed);

  for (const playerId of ["player:ada", "player:bryn"]) {
    const finalView = await attach(base, playerId, `connection:${playerId}:return`)
      .then((response) => response.json());
    assert.equal(finalView.campaignRevision, 11);
    assert.equal(
      finalView.events.filter(
        (event: { eventId: string }) => event.eventId === "event-scene-academy-courtyard",
      ).length,
      1,
    );
    assert.equal(
      finalView.events.filter(
        (event: { eventId: string }) => event.eventId === "event-encounter-academy-gate-completed",
      ).length,
      1,
    );
  }
});
