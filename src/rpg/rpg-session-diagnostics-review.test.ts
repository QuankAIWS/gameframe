import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { readRpgSessionDiagnostics } from "./rpg-session-diagnostics.ts";
import { SqliteRpgCampaignStore } from "./sqlite-rpg-campaign-store.ts";
import { SqliteRpgCommandAcceptanceRepository } from "./sqlite-rpg-command-acceptance.ts";

const CAMPAIGN_ID = "campaign-diagnostics-review";

test("diagnostics redact Cookie and Set-Cookie values embedded in free text", () => {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-rpg-diagnostics-review-"));
  const filePath = join(directory, "rpg.sqlite");
  const campaigns = new SqliteRpgCampaignStore({ filePath });
  const commands = new SqliteRpgCommandAcceptanceRepository({ filePath });
  try {
    campaigns.bootstrap({
      campaignId: CAMPAIGN_ID,
      title: "Diagnostics Review",
      status: "active",
      state: {
        gameframeCoordinationRevision: 0,
        presentationSequence: 1,
        linkedNarrativeRevision: 0,
      },
      memberships: [{
        playerId: "discord:reviewer",
        role: "player",
        joinedPresentationSequence: 0,
      }],
      events: [{
        eventId: "event:cookie-redaction",
        kind: "scene.presented",
        audience: { kind: "public" },
        payload: {
          text: "Cookie: session=super-secret; theme=dark\nSet-Cookie: auth=other-secret; Path=/; HttpOnly",
        },
        createdAt: "2026-08-17T20:00:00.000Z",
      }],
      initializedAt: "2026-08-17T19:59:00.000Z",
    });

    const diagnostics = readRpgSessionDiagnostics({
      filePath,
      campaignId: CAMPAIGN_ID,
      generatedAt: "2026-08-17T20:01:00.000Z",
    });
    const serialized = JSON.stringify(diagnostics);
    assert.doesNotMatch(serialized, /super-secret|other-secret|theme=dark|Path=\/|HttpOnly/);

    const event = diagnostics.events[0] as Record<string, any>;
    assert.equal(
      event.payload.text,
      "Cookie: [REDACTED]\nSet-Cookie: [REDACTED]",
    );
  } finally {
    commands.close();
    campaigns.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("diagnostics reads remain inside one explicit SQLite snapshot", () => {
  const source = readFileSync(new URL("./rpg-session-diagnostics.ts", import.meta.url), "utf8");
  const begin = source.indexOf('database.exec("BEGIN")');
  const metadataRead = source.indexOf("SELECT campaign_id, title, status");
  const joinedCommandRead = source.indexOf("LEFT JOIN ${OUTBOX_TABLE} AS outbox");
  const commit = source.indexOf('database.exec("COMMIT")');
  const rollback = source.indexOf('database.exec("ROLLBACK")');

  assert.ok(begin >= 0, "diagnostics read transaction must begin explicitly");
  assert.ok(metadataRead > begin, "metadata must be read after the snapshot begins");
  assert.ok(joinedCommandRead > metadataRead, "command correlation must share the snapshot");
  assert.ok(commit > joinedCommandRead, "snapshot must commit after all correlated reads");
  assert.ok(rollback > commit, "failed diagnostics reads must roll the snapshot back");
});
