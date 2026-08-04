import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

type JsonRecord = Record<string, unknown>;

const fixtureRoot = new URL("../../planning/fixtures/rpg/v1/", import.meta.url);

function readJson(filename: string): JsonRecord {
  const path = fileURLToPath(new URL(filename, fixtureRoot));
  return JSON.parse(readFileSync(path, "utf8")) as JsonRecord;
}

function record(value: unknown, label: string): JsonRecord {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  return value as JsonRecord;
}

function array(value: unknown, label: string): unknown[] {
  assert.ok(Array.isArray(value), `${label} must be an array`);
  return value;
}

function string(value: unknown, label: string): string {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.ok(value.length > 0, `${label} must not be empty`);
  return value;
}

function unique(values: string[], label: string): void {
  assert.equal(new Set(values).size, values.length, `${label} must be unique`);
}

test("shared RPG fixture manifest names versioned canonical files", () => {
  const manifest = readJson("shared-rpg-fixtures.json");
  assert.equal(manifest.manifestVersion, 1);
  assert.equal(manifest.contractVersion, 2);
  assert.equal(manifest.canonicalRepository, "QuankAIWS/scribbles-gameframe");
  assert.equal(manifest.canonicalRoot, "planning/fixtures/rpg/v1");
  assert.equal(manifest.mirrorRepository, "QuankAIWS/rpg-gm-runtime");
  assert.equal(manifest.mirrorRoot, "fixtures/rpg/v1");

  const fixtures = array(manifest.fixtures, "manifest.fixtures").map((entry, index) =>
    record(entry, `manifest.fixtures[${index}]`)
  );
  assert.ok(fixtures.length > 0);
  const ids = fixtures.map((entry, index) => string(entry.id, `fixture ${index} id`));
  const filenames = fixtures.map((entry, index) => string(entry.filename, `fixture ${index} filename`));
  unique(ids, "fixture IDs");
  unique(filenames, "fixture filenames");
  assert.ok(ids.includes("campaign-revision-linkage"));
  for (const filename of filenames) {
    assert.match(filename, /^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/);
    readJson(filename);
  }
});

test("campaign port slice A is internally consistent", () => {
  const fixture = readJson("campaign-port-a.json");
  assert.equal(fixture.fixtureVersion, 1);
  assert.equal(fixture.contract, "rpg-gameframe-port");
  assert.equal(fixture.slice, "campaign-port-a");

  const versions = record(fixture.protocolVersions, "protocolVersions");
  assert.equal(versions.campaign, 1);
  assert.equal(versions.encounter, 1);

  const campaign = record(fixture.campaign, "campaign");
  const campaignId = string(campaign.campaignId, "campaign.campaignId");
  const revision = campaign.revision;
  assert.ok(Number.isInteger(revision) && Number(revision) >= 0);
  const events = array(campaign.events, "campaign.events").map((entry, index) =>
    record(entry, `campaign.events[${index}]`)
  );
  assert.equal(events.length, revision);
  assert.deepEqual(events.map((event) => event.sequence), events.map((_event, index) => index + 1));
  const eventIds = events.map((event, index) => string(event.eventId, `event ${index} ID`));
  unique(eventIds, "event IDs");

  const sessions = array(fixture.sessionCases, "sessionCases").map((entry, index) =>
    record(entry, `sessionCases[${index}]`)
  );
  assert.equal(sessions.length, 2);
  for (const session of sessions) {
    const request = record(session.request, "session.request");
    assert.equal(request.protocolVersion, versions.campaign);
    assert.equal(request.kind, "campaign.attach");
    assert.equal(request.campaignId, campaignId);
    const expected = record(session.expected, "session.expected");
    assert.equal(expected.campaignRevision, revision);
    const visible = array(expected.visibleEventIds, "session.expected.visibleEventIds").map((id) =>
      string(id, "visible event ID")
    );
    for (const eventId of visible) assert.ok(eventIds.includes(eventId), `unknown visible event: ${eventId}`);
  }

  const commandCases = array(fixture.commandCases, "commandCases").map((entry, index) =>
    record(entry, `commandCases[${index}]`)
  );
  assert.deepEqual(
    commandCases.map((entry) => entry.caseId),
    ["submit-public-action", "exact-retry", "conflicting-command-reuse", "stale-revision"],
  );
  const firstEnvelope = record(commandCases[0]?.envelope, "first command envelope");
  assert.equal(firstEnvelope.protocolVersion, versions.campaign);
  assert.equal(firstEnvelope.campaignId, campaignId);
  assert.equal(record(commandCases[1]?.expected, "retry expected").duplicatesEvent, false);
  assert.equal(record(commandCases[2]?.expected, "conflict expected").code, "invalid-command");
  assert.equal(record(commandCases[3]?.expected, "stale expected").code, "revision-conflict");

  const encounter = record(fixture.encounterCase, "encounterCase");
  const encounterRequest = record(encounter.request, "encounterCase.request");
  assert.equal(encounterRequest.protocolVersion, versions.encounter);
  assert.equal(encounterRequest.campaignId, campaignId);
  assert.equal(encounterRequest.campaignRevision, Number(revision) + 1);
  assert.equal(encounterRequest.rulesetId, "monster-master-duel");
  assert.ok(array(encounterRequest.participants, "encounter participants").length >= 1);
  assert.ok(array(encounterRequest.objectives, "encounter objectives").length >= 1);
  assert.equal(record(encounter.expected, "encounter expected").exactRetryReturnsSameHandle, true);
});
