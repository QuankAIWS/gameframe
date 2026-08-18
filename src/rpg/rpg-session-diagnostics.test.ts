import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { readRpgSessionDiagnostics } from "./rpg-session-diagnostics.ts";
import { SqliteRuntimeCommandOutbox } from "./runtime-command-outbox.ts";
import { SqliteRpgCampaignStore } from "./sqlite-rpg-campaign-store.ts";
import { SqliteRpgCommandAcceptanceRepository } from "./sqlite-rpg-command-acceptance.ts";

const CAMPAIGN_ID = "campaign-observability-test";
const PLAYER_ID = "discord:observer";
const ISSUED_AT = "2026-08-15T15:00:00.000Z";
const MAX_DIAGNOSTICS_BYTES = 3_500_000;

test("diagnostics correlate canonical evidence and redact credential-like data", () => {
  const { directory, filePath, campaigns, commands, outbox } = fixture();
  try {
    const corruption = new DatabaseSync(filePath);
    try {
      const row = corruption.prepare(`
        SELECT event_json FROM rpg_presentation_events_v1
        WHERE campaign_id = ? AND presentation_sequence = 1
      `).get(CAMPAIGN_ID) as { event_json: string };
      const event = JSON.parse(row.event_json) as Record<string, unknown>;
      corruption.prepare(`
        UPDATE rpg_presentation_events_v1 SET event_json = ?
        WHERE campaign_id = ? AND presentation_sequence = 1
      `).run(JSON.stringify({
        ...event,
        presentationSequence: 999,
        debug: {
          serviceToken: "hidden-service-token",
          apiKey: "hidden-api-key",
          hmacSecret: "hidden-hmac-secret",
          clientSecret: "hidden-client-secret",
          privateKey: "hidden-private-key",
        },
      }), CAMPAIGN_ID);
    } finally {
      corruption.close();
    }

    const receipt = acceptAction(commands, "command:diagnostic-cart-01");
    const claim = outbox.claimNext({
      now: "2026-08-15T15:00:01.000Z",
      leaseDurationMs: 30_000,
    });
    assert.ok(claim);
    outbox.markReconciliationRequired({
      deliveryId: receipt.deliveryId,
      leaseToken: claim.leaseToken,
      code: "runtime-rejected",
      message: "Provider rejected Authorization: Bearer very-secret-token clientSecret=also-secret",
      now: "2026-08-15T15:00:02.000Z",
    });

    const diagnostics = readRpgSessionDiagnostics({
      filePath,
      campaignId: CAMPAIGN_ID,
      generatedAt: "2026-08-15T15:01:00.000Z",
    });
    assert.equal(diagnostics.schemaVersion, "gameframe.rpg.session-diagnostics.v1");
    assert.equal(diagnostics.campaign.campaignId, CAMPAIGN_ID);
    assert.equal(diagnostics.campaign.coordination.gameframeCoordinationRevision, 1);
    assert.equal(diagnostics.events.length, 2);
    assert.equal((diagnostics.events[0] as Record<string, any>).presentationSequence, 1);
    assert.equal(diagnostics.commands.length, 1);
    assert.equal(diagnostics.limits.payloadTruncated, false);
    assert.equal(diagnostics.limits.payloadBytes, Buffer.byteLength(JSON.stringify(diagnostics), "utf8"));

    const serialized = JSON.stringify(diagnostics);
    assert.doesNotMatch(
      serialized,
      /hidden-service-token|hidden-api-key|hidden-hmac-secret|hidden-client-secret|hidden-private-key|very-secret-token|also-secret/,
    );
    const debug = (diagnostics.events[0] as Record<string, any>).debug;
    assert.equal(debug.serviceToken, "[REDACTED]");
    assert.equal(debug.apiKey, "[REDACTED]");
    assert.equal(debug.hmacSecret, "[REDACTED]");
    assert.equal(debug.clientSecret, "[REDACTED]");
    assert.equal(debug.privateKey, "[REDACTED]");

    const command = diagnostics.commands[0] as Record<string, any>;
    assert.equal(command.commandId, "command:diagnostic-cart-01");
    assert.equal(command.delivery.command.text, "Uncover the checkpoint cart.");
    assert.equal(command.runtime.status, "reconciliation-required");
    assert.equal(command.runtime.attemptCount, 1);
    assert.equal(command.runtime.lastFailure.code, "runtime-rejected");
    assert.match(command.runtime.lastFailure.message, /Bearer \[REDACTED\]/);
    assert.match(command.runtime.lastFailure.message, /clientSecret=\[REDACTED\]/i);
    assert.equal("lease" in command.runtime, false);
    assert.equal(serialized.includes("fingerprint"), false);
  } finally {
    closeFixture({ directory, campaigns, commands, outbox });
  }
});

test("diagnostics retain the newest 2048 events and commands in chronological order", () => {
  const { directory, filePath, campaigns, commands, outbox } = fixture();
  try {
    commands.close();
    outbox.close();
    const database = new DatabaseSync(filePath);
    try {
      insertSyntheticEvidence(database, { eventCount: 2_050, commandCount: 2_050 });
    } finally {
      database.close();
    }

    const diagnostics = readRpgSessionDiagnostics({
      filePath,
      campaignId: CAMPAIGN_ID,
      generatedAt: "2026-08-15T18:00:00.000Z",
    });
    assert.equal(diagnostics.events.length, 2_048);
    assert.equal(diagnostics.commands.length, 2_048);
    assert.equal((diagnostics.events[0] as Record<string, any>).presentationSequence, 4);
    assert.equal((diagnostics.events.at(-1) as Record<string, any>).presentationSequence, 2_051);
    assert.equal((diagnostics.commands[0] as Record<string, any>).commandId, "command:0002");
    assert.equal((diagnostics.commands.at(-1) as Record<string, any>).commandId, "command:2049");
    assert.equal(diagnostics.limits.eventsAvailable, 2_051);
    assert.equal(diagnostics.limits.commandsAvailable, 2_050);
    assert.equal(diagnostics.limits.eventsTruncated, true);
    assert.equal(diagnostics.limits.commandsTruncated, true);
    assert.equal(diagnostics.limits.payloadTruncated, false);
  } finally {
    campaigns.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("diagnostics enforce a transport-safe byte budget while retaining newest evidence", () => {
  const { directory, filePath, campaigns, commands, outbox } = fixture();
  try {
    commands.close();
    outbox.close();
    const database = new DatabaseSync(filePath);
    try {
      insertSyntheticEvidence(database, {
        eventCount: 300,
        commandCount: 300,
        eventTextLength: 12_000,
        commandTextLength: 4_000,
      });
    } finally {
      database.close();
    }

    const diagnostics = readRpgSessionDiagnostics({
      filePath,
      campaignId: CAMPAIGN_ID,
      generatedAt: "2026-08-15T18:00:00.000Z",
    });
    const bytes = Buffer.byteLength(JSON.stringify(diagnostics), "utf8");
    assert.ok(bytes <= MAX_DIAGNOSTICS_BYTES, `${bytes} exceeds diagnostics budget`);
    assert.equal(diagnostics.limits.payloadBytes, bytes);
    assert.equal(diagnostics.limits.payloadTruncated, true);
    assert.ok(diagnostics.events.length > 0);
    assert.ok(diagnostics.commands.length > 0);
    assert.equal((diagnostics.events.at(-1) as Record<string, any>).presentationSequence, 301);
    assert.equal((diagnostics.commands.at(-1) as Record<string, any>).commandId, "command:0299");
    assert.ok(diagnostics.limits.eventsTruncated || diagnostics.limits.commandsTruncated);
  } finally {
    campaigns.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("diagnostics fail closed when a persisted Runtime receipt identity is corrupt", () => {
  const { directory, filePath, campaigns, commands, outbox } = fixture();
  let outboxClosed = false;
  try {
    const receipt = commands.acceptCommand({
      campaignId: CAMPAIGN_ID,
      commandId: "command:receipt-mismatch",
      authenticatedPlayerId: PLAYER_ID,
      expectedGameframeCoordinationRevision: 0,
      issuedAt: ISSUED_AT,
      command: {
        kind: "campaign.submit_choice",
        choiceId: "choice-1",
        optionId: "option-1",
      },
      presentationEvents: [],
    });
    const claim = outbox.claimNext({
      now: "2026-08-15T15:00:01.000Z",
      leaseDurationMs: 30_000,
    });
    assert.ok(claim);
    const acceptedAt = "2026-08-15T15:00:02.000Z";
    outbox.markRuntimeAccepted({
      deliveryId: receipt.deliveryId,
      leaseToken: claim.leaseToken,
      receipt: {
        protocolVersion: 1,
        kind: "runtime.command_accepted",
        deliveryId: receipt.deliveryId,
        campaignId: CAMPAIGN_ID,
        commandId: "command:receipt-mismatch",
        acceptedAt,
      },
      now: acceptedAt,
    });
    outbox.close();
    outboxClosed = true;

    const corruption = new DatabaseSync(filePath);
    try {
      corruption.prepare(`
        UPDATE rpg_runtime_command_outbox_v1
        SET runtime_receipt_json = ?
        WHERE delivery_id = ?
      `).run(JSON.stringify({
        protocolVersion: 1,
        kind: "runtime.command_accepted",
        deliveryId: receipt.deliveryId,
        campaignId: "campaign-wrong",
        commandId: "command-wrong",
        acceptedAt,
      }), receipt.deliveryId);
    } finally {
      corruption.close();
    }

    assert.throws(
      () => readRpgSessionDiagnostics({ filePath, campaignId: CAMPAIGN_ID }),
      /inconsistent Runtime receipt identity/,
    );
  } finally {
    if (!outboxClosed) outbox.close();
    commands.close();
    campaigns.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("diagnostics fail closed for an unknown campaign", () => {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-rpg-diagnostics-unknown-"));
  const filePath = join(directory, "rpg.sqlite");
  const campaigns = new SqliteRpgCampaignStore({ filePath });
  try {
    assert.throws(
      () => readRpgSessionDiagnostics({ filePath, campaignId: "campaign-does-not-exist" }),
      /does not exist/,
    );
  } finally {
    campaigns.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-rpg-diagnostics-"));
  const filePath = join(directory, "rpg.sqlite");
  const campaigns = new SqliteRpgCampaignStore({ filePath });
  const commands = new SqliteRpgCommandAcceptanceRepository({ filePath });
  const outbox = new SqliteRuntimeCommandOutbox({ filePath });
  campaigns.bootstrap({
    campaignId: CAMPAIGN_ID,
    title: "Observability Test",
    status: "active",
    state: {
      gameframeCoordinationRevision: 0,
      presentationSequence: 1,
      linkedNarrativeRevision: 0,
    },
    memberships: [{
      playerId: PLAYER_ID,
      role: "player",
      joinedPresentationSequence: 0,
    }],
    events: [{
      eventId: "event:intro",
      kind: "scene.presented",
      audience: { kind: "public" },
      payload: { text: "A covered cart knocks from inside." },
      createdAt: "2026-08-15T14:59:00.000Z",
    }],
    initializedAt: "2026-08-15T14:58:00.000Z",
  });
  return { directory, filePath, campaigns, commands, outbox };
}

function acceptAction(commands: SqliteRpgCommandAcceptanceRepository, commandId: string) {
  return commands.acceptCommand({
    campaignId: CAMPAIGN_ID,
    commandId,
    authenticatedPlayerId: PLAYER_ID,
    expectedGameframeCoordinationRevision: 0,
    issuedAt: ISSUED_AT,
    command: {
      kind: "campaign.submit_action",
      visibility: "public",
      text: "Uncover the checkpoint cart.",
    },
    presentationEvents: [{
      eventId: "event:cart-action",
      kind: "campaign.action_submitted",
      audience: { kind: "public" },
      payload: {
        commandId,
        actorId: PLAYER_ID,
        text: "Uncover the checkpoint cart.",
      },
    }],
  });
}

function closeFixture(input: {
  directory: string;
  campaigns: SqliteRpgCampaignStore;
  commands: SqliteRpgCommandAcceptanceRepository;
  outbox: SqliteRuntimeCommandOutbox;
}): void {
  input.outbox.close();
  input.commands.close();
  input.campaigns.close();
  rmSync(input.directory, { recursive: true, force: true });
}

function insertSyntheticEvidence(database: DatabaseSync, input: {
  eventCount: number;
  commandCount: number;
  eventTextLength?: number;
  commandTextLength?: number;
}): void {
  const insertEvent = database.prepare(`
    INSERT INTO rpg_presentation_events_v1 (
      campaign_id, presentation_sequence, event_id, event_json, created_at
    ) VALUES (?, ?, ?, ?, ?)
  `);
  const insertCommand = database.prepare(`
    INSERT INTO rpg_command_receipts_v1 (
      campaign_id, command_id, fingerprint, receipt_json, delivery_id, committed_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertOutbox = database.prepare(`
    INSERT INTO rpg_runtime_command_outbox_v1 (
      delivery_id, campaign_id, command_id, fingerprint, payload_json,
      status, accepted_at, updated_at, attempt_count
    ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, 0)
  `);
  const base = Date.parse("2026-08-15T15:00:00.000Z");
  const eventText = "E".repeat(input.eventTextLength ?? 8);
  const commandText = "C".repeat(input.commandTextLength ?? 8);

  database.exec("BEGIN IMMEDIATE");
  try {
    for (let index = 0; index < input.eventCount; index += 1) {
      const sequence = index + 2;
      const createdAt = new Date(base + index * 1_000).toISOString();
      const eventId = `event:synthetic:${String(index).padStart(4, "0")}`;
      insertEvent.run(
        CAMPAIGN_ID,
        sequence,
        eventId,
        JSON.stringify({
          eventId,
          kind: "diagnostic.synthetic",
          audience: { kind: "public" },
          payload: { text: eventText, index },
          createdAt,
        }),
        createdAt,
      );
    }

    for (let index = 0; index < input.commandCount; index += 1) {
      const suffix = String(index).padStart(4, "0");
      const commandId = `command:${suffix}`;
      const deliveryId = `delivery:${suffix}`;
      const committedAt = new Date(base + index * 1_000).toISOString();
      const receipt = {
        kind: "gameframe.command_committed",
        campaignId: CAMPAIGN_ID,
        commandId,
        deliveryId,
        gameframeCoordinationRevision: index + 1,
        presentationSequence: 1,
        linkedNarrativeRevision: 0,
        eventIds: [],
      };
      const delivery = {
        protocolVersion: 1,
        deliveryId,
        campaignId: CAMPAIGN_ID,
        commandId,
        authenticatedPlayerId: PLAYER_ID,
        sourceGameframeCoordinationRevision: index,
        acceptedGameframeCoordinationRevision: index + 1,
        sourcePresentationSequence: 1,
        acceptedPresentationSequence: 1,
        issuedAt: committedAt,
        command: {
          kind: "campaign.submit_action",
          visibility: "public",
          text: commandText,
        },
      };
      insertCommand.run(
        CAMPAIGN_ID,
        commandId,
        `fingerprint:${suffix}`,
        JSON.stringify(receipt),
        deliveryId,
        committedAt,
      );
      insertOutbox.run(
        deliveryId,
        CAMPAIGN_ID,
        commandId,
        `fingerprint:${suffix}`,
        JSON.stringify(delivery),
        committedAt,
        committedAt,
      );
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
