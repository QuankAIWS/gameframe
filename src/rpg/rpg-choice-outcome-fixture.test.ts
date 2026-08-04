import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

type JsonRecord = Record<string, unknown>;

function record(value: unknown, label: string): JsonRecord {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  return value as JsonRecord;
}

function array(value: unknown, label: string): unknown[] {
  assert.ok(Array.isArray(value), `${label} must be an array`);
  return value;
}

function readFixture(): JsonRecord {
  return JSON.parse(
    readFileSync(
      new URL("../../planning/fixtures/rpg/v1/campaign-port-b.json", import.meta.url),
      "utf8",
    ),
  ) as JsonRecord;
}

test("campaign port slice B encodes choice, check, outcome, and return contracts", () => {
  const fixture = readFixture();
  assert.equal(fixture.fixtureVersion, 1);
  assert.equal(fixture.contract, "rpg-gameframe-port");
  assert.equal(fixture.slice, "campaign-port-b");
  assert.equal(fixture.extendsFixtureId, "campaign-port-a");

  const start = record(fixture.startingState, "startingState");
  assert.equal(start.campaignId, "campaign-monster-master-reference");
  assert.equal(start.campaignRevision, 5);

  const presentation = record(fixture.runtimeChoicePresentationCase, "runtimeChoicePresentationCase");
  const presentationRequest = record(presentation.request, "runtimeChoicePresentationCase.request");
  assert.equal(presentationRequest.expectedRevision, 5);
  const presentationEvents = array(presentationRequest.events, "presentation events");
  assert.equal(presentationEvents.length, 1);
  const choiceEvent = record(presentationEvents[0], "choice event");
  assert.equal(choiceEvent.type, "choice.presented");
  const choicePayload = record(choiceEvent.payload, "choice payload");
  const options = array(choicePayload.options, "choice options").map((value, index) =>
    record(value, `choice option ${index}`)
  );
  assert.equal(options.length, 2);
  assert.equal(new Set(options.map((option) => option.optionId)).size, 2);

  const selected = options[0];
  const check = record(selected.check, "selected option check");
  assert.equal(check.target, 12);
  assert.equal(check.deterministicRoll, 11);
  assert.equal(check.modifier, 3);

  const choiceCase = record(fixture.choiceCase, "choiceCase");
  const choiceEnvelope = record(choiceCase.envelope, "choiceCase.envelope");
  const command = record(choiceEnvelope.command, "choice command");
  assert.equal(command.kind, "campaign.submit_choice");
  assert.equal(command.expectedRevision, 6);
  assert.equal(command.choiceId, choicePayload.choiceId);
  assert.equal(command.optionId, selected.optionId);
  const choiceExpected = record(choiceCase.expected, "choice expected");
  assert.equal(choiceExpected.campaignRevision, 9);
  assert.deepEqual(choiceExpected.eventTypes, [
    "campaign.choice_submitted",
    "check.resolved",
    "campaign.consequence",
  ]);
  assert.equal(record(choiceExpected.check, "expected check").total, 14);

  const encounter = record(fixture.encounterCase, "encounterCase");
  const encounterRequest = record(encounter.request, "encounterCase.request");
  assert.equal(encounterRequest.campaignRevision, 9);
  assert.equal(encounterRequest.rulesetId, "monster-master-duel");

  const completion = record(fixture.completionCase, "completionCase");
  const completionRequest = record(completion.request, "completionCase.request");
  assert.equal(completionRequest.encounterId, encounterRequest.encounterId);
  const outcome = record(completionRequest.outcome, "completion outcome");
  assert.equal(outcome.kind, "encounter.terminal_outcome");
  assert.equal(outcome.result, "victory");
  assert.equal(record(outcome.ruleset, "outcome ruleset").id, encounterRequest.rulesetId);
  assert.equal(array(outcome.objectiveResults, "objective results").length, 1);
  assert.equal(array(outcome.participantResults, "participant results").length, 2);

  const resume = record(fixture.resumeCase, "resumeCase");
  const resumeRequest = record(resume.request, "resumeCase.request");
  assert.equal(resumeRequest.expectedRevision, 9);
  const resumeEvents = array(resumeRequest.events, "resume events").map((value, index) =>
    record(value, `resume event ${index}`)
  );
  assert.deepEqual(resumeEvents.map((event) => event.type), [
    "encounter.completed",
    "scene.presented",
  ]);
  assert.equal(record(resume.expected, "resume expected").campaignRevision, 11);
});
