import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { readRpgSessionDiagnostics } from "./rpg-session-diagnostics.ts";
import { SqliteRuntimeCommandOutbox } from "./runtime-command-outbox.ts";
import { SqliteRpgCampaignStore } from "./sqlite-rpg-campaign-store.ts";
import { SqliteRpgCommandAcceptanceRepository } from "./sqlite-rpg-command-acceptance.ts";

const CAMPAIGN_ID = "campaign-observability-test";
const PLAYER_ID = "discord:observer";
const ISSUED_AT = "2026-08-15T15:00:00.000Z";

test("diagnostics correlate campaign events, commands, Runtime delivery state, and failures", () => {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-rpg-diagnostics-"));
  const filePath = join(directory, "rpg.sqlite");
  const campaigns = new SqliteRpgCampaignStore({ filePath });
  const commands = new SqliteRpgCommandAcceptanceRepository({ filePath });
  const outbox = new SqliteRuntimeCommandOutbox({ filePath });
  try {
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

    const receipt = commands.acceptCommand({
      campaignId: CAMPAIGN_ID,
      commandId: "command:diagnostic-cart-01",
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
          commandId: "command:diagnostic-cart-01",
          actorId: PLAYER_ID,
          text: "Uncover the checkpoint cart.",
        },
      }],
    });

    const claim = outbox.claimNext({
      now: "2026-08-15T15:00:01.000Z",
      leaseDurationMs: 30_000,
    });
    assert.ok(claim);
    outbox.markReconciliationRequired({
      deliveryId: receipt.deliveryId,
      leaseToken: claim.leaseToken,
      code: "runtime-rejected",
      message: "Provider rejected request with Authorization: Bearer very-secret-token",
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
    assert.equal(diagnostics.commands.length, 1);

    const command = diagnostics.commands[0] as Record<string, any>;
    assert.equal(command.commandId, "command:diagnostic-cart-01");
    assert.equal(command.delivery.command.text, "Uncover the checkpoint cart.");
    assert.equal(command.runtime.status, "reconciliation-required");
    assert.equal(command.runtime.attemptCount, 1);
    assert.equal(command.runtime.lastFailure.code, "runtime-rejected");
    assert.match(command.runtime.lastFailure.message, /Bearer \[REDACTED\]/);
    assert.doesNotMatch(JSON.stringify(diagnostics), /very-secret-token/);
    assert.equal("lease" in command.runtime, false);
  } finally {
    outbox.close();
    commands.close();
    campaigns.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("diagnostics fail closed for an unknown campaign", () => {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-rpg-diagnostics-"));
  const filePath = join(directory, "rpg.sqlite");
  const campaigns = new SqliteRpgCampaignStore({ filePath });
  try {
    assert.throws(
      () => readRpgSessionDiagnostics({
        filePath,
        campaignId: "campaign-does-not-exist",
      }),
      /does not exist/,
    );
  } finally {
    campaigns.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
