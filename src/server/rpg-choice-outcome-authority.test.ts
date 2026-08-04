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

function array(value: unknown, label: string): unknown[] {
  assert.ok(Array.isArray(value), `${label} must be an array`);
  return value;
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

async function attach(base: string, playerId: string, connectionId: string): Promise<JsonRecord> {
  const response = await playerFetch(
    `${base}/api/rpg/campaigns/${campaignId}/attach`,
    playerId,
    jsonBody({
      protocolVersion: 1,
      kind: "campaign.attach",
      campaignId,
      connectionId,
    }),
  );
  assert.equal(response.status, 200);
  return await response.json() as JsonRecord;
}

async function advanceToRevisionFive(base: string): Promise<void> {
  const response = await playerFetch(
    `${base}/api/rpg/campaigns/${campaignId}/commands`,
    "player:ada",
    jsonBody({
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
    }),
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).campaignRevision, 5);
}

test("RPG guard keeps event batches atomic and hides deterministic choice internals", async (context) => {
  const server = createGameFrameServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected an internet address.");
  const base = `http://127.0.0.1:${address.port}`;
  const eventsPath = `${base}/api/rpg/campaigns/${campaignId}/events`;

  await advanceToRevisionFive(base);

  const atomicFailure = await serviceFetch(
    eventsPath,
    "rpg-gm-runtime",
    jsonBody({
      protocolVersion: 1,
      batchId: "batch:atomic-failure",
      campaignId,
      expectedRevision: 5,
      events: [
        {
          eventId: "event-should-not-append",
          type: "scene.presented",
          audience: { kind: "public" },
          payload: {
            sceneId: "scene:should-not-append",
            title: "Should Not Append",
            narration: "This event must not survive a rejected batch.",
          },
          createdAt: "2026-08-04T12:05:10.000Z",
        },
        {
          eventId: "event-scene-gate",
          type: "scene.presented",
          audience: { kind: "public" },
          payload: {
            sceneId: "scene:duplicate",
            title: "Duplicate",
            narration: "This ID already exists.",
          },
          createdAt: "2026-08-04T12:05:11.000Z",
        },
      ],
    }),
  );
  assert.equal(atomicFailure.status, 400);
  const afterAtomicFailure = await attach(base, "player:ada", "connection:atomic-check");
  assert.equal(afterAtomicFailure.campaignRevision, 5);
  assert.equal(
    array(afterAtomicFailure.events, "events").some(
      (value) => record(value, "event").eventId === "event-should-not-append",
    ),
    false,
  );

  const presentation = record(fixture.runtimeChoicePresentationCase, "runtimeChoicePresentationCase");
  const presentationRequest = record(presentation.request, "presentation request");
  const presented = await serviceFetch(
    eventsPath,
    "rpg-gm-runtime",
    jsonBody(presentationRequest),
  );
  assert.equal(presented.status, 200);

  for (const playerId of ["player:ada", "player:bryn"]) {
    const view = await attach(base, playerId, `connection:redaction:${playerId}`);
    const choiceEvent = array(view.events, "events")
      .map((value) => record(value, "event"))
      .find((event) => event.type === "choice.presented");
    assert.ok(choiceEvent);
    const payload = record(choiceEvent.payload, "choice payload");
    const option = record(array(payload.options, "choice options")[0], "choice option");
    const check = record(option.check, "choice check");
    assert.equal(check.checkId, "check:academy-gate-runes");
    assert.equal(check.kind, "insight");
    assert.equal(check.target, 12);
    assert.equal("deterministicRoll" in check, false);
    assert.equal("modifier" in check, false);
    assert.equal("success" in check, false);
    assert.equal("failure" in check, false);
  }
});

test("RPG guard binds campaign return to one complete terminal encounter outcome", async (context) => {
  const server = createGameFrameServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected an internet address.");
  const base = `http://127.0.0.1:${address.port}`;
  const eventsPath = `${base}/api/rpg/campaigns/${campaignId}/events`;
  const commandsPath = `${base}/api/rpg/campaigns/${campaignId}/commands`;

  await advanceToRevisionFive(base);
  const presentationRequest = record(
    record(fixture.runtimeChoicePresentationCase, "presentation case").request,
    "presentation request",
  );
  assert.equal((await serviceFetch(
    eventsPath,
    "rpg-gm-runtime",
    jsonBody(presentationRequest),
  )).status, 200);

  const choiceEnvelope = record(record(fixture.choiceCase, "choice case").envelope, "choice envelope");
  assert.equal((await playerFetch(
    commandsPath,
    "player:ada",
    jsonBody(choiceEnvelope),
  )).status, 200);

  const encounterRequest = record(
    record(fixture.encounterCase, "encounter case").request,
    "encounter request",
  );
  assert.equal((await serviceFetch(
    `${base}/api/rpg/encounters`,
    "rpg-gm-runtime",
    jsonBody(encounterRequest),
  )).status, 200);

  const resumeRequest = record(record(fixture.resumeCase, "resume case").request, "resume request");
  const prematureReturn = await serviceFetch(
    eventsPath,
    "rpg-gm-runtime",
    jsonBody(resumeRequest),
  );
  assert.equal(prematureReturn.status, 400);
  assert.match((await prematureReturn.json()).message, /before a terminal outcome/i);
  assert.equal((await attach(base, "player:ada", "connection:before-outcome")).campaignRevision, 9);

  const completionRequest = record(
    record(fixture.completionCase, "completion case").request,
    "completion request",
  );
  const incompleteOutcome = structuredClone(completionRequest);
  const incompleteOutcomeBody = record(incompleteOutcome.outcome, "incomplete outcome");
  incompleteOutcomeBody.participantResults = array(
    incompleteOutcomeBody.participantResults,
    "participant results",
  ).slice(0, 1);
  const incompleteCompletion = await serviceFetch(
    `${base}/api/rpg/encounters/${encounterRequest.encounterId}/complete`,
    "gameframe-encounter-engine",
    jsonBody(incompleteOutcome),
  );
  assert.equal(incompleteCompletion.status, 400);
  assert.match((await incompleteCompletion.json()).message, /cover every encounter entry exactly once/i);

  const completedResponse = await serviceFetch(
    `${base}/api/rpg/encounters/${encounterRequest.encounterId}/complete`,
    "gameframe-encounter-engine",
    jsonBody(completionRequest),
  );
  assert.equal(completedResponse.status, 200);
  assert.equal((await completedResponse.json()).state, "completed");

  const mismatchedReturn = structuredClone(resumeRequest);
  const mismatchedEvents = array(mismatchedReturn.events, "mismatched return events");
  const completionEvent = record(mismatchedEvents[0], "completion event");
  const completionPayload = record(completionEvent.payload, "completion payload");
  const completionCommit = record(completionPayload.commit, "completion commit");
  completionCommit.matchRevision = 36;
  const mismatchedResponse = await serviceFetch(
    eventsPath,
    "rpg-gm-runtime",
    jsonBody({ ...mismatchedReturn, batchId: "batch:mismatched-return" }),
  );
  assert.equal(mismatchedResponse.status, 400);
  assert.match((await mismatchedResponse.json()).message, /commit does not match/i);
  assert.equal((await attach(base, "player:ada", "connection:after-mismatch")).campaignRevision, 9);

  const validReturn = await serviceFetch(
    eventsPath,
    "rpg-gm-runtime",
    jsonBody(resumeRequest),
  );
  assert.equal(validReturn.status, 200);
  assert.equal((await validReturn.json()).campaignRevision, 11);
});
