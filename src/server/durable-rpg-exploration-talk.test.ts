import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { RpgExplorationProjectionV1 } from "../rpg/rpg-exploration-contract.ts";
import { SqliteRuntimeCommandOutbox } from "../rpg/runtime-command-outbox.ts";
import { SqliteRpgCommandAcceptanceRepository } from "../rpg/sqlite-rpg-command-acceptance.ts";
import type { DurableCampaignBootstrap } from "../rpg/sqlite-rpg-campaign-store.ts";
import { createDurableRpgHttpServer } from "./durable-rpg-http-server.ts";

const directories: string[] = [];
const fixturePath = fileURLToPath(
  new URL("../../planning/fixtures/rpg/v1/exploration-port-a.json", import.meta.url),
);
const semantic = JSON.parse(readFileSync(fixturePath, "utf8")).projection as RpgExplorationProjectionV1;

test.afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-rpg-talk-server-"));
  directories.push(directory);
  return join(directory, "gameframe.sqlite");
}

function bootstrap(): DurableCampaignBootstrap {
  return {
    campaignId: semantic.campaignId,
    title: "Monster Master reference campaign",
    status: "active",
    state: {
      gameframeCoordinationRevision: 3,
      presentationSequence: 0,
      linkedNarrativeRevision: 0,
    },
    memberships: [{
      playerId: semantic.viewer.playerId,
      role: "player",
      joinedPresentationSequence: 0,
    }],
    events: [],
    initializedAt: "2026-08-09T18:00:00.000Z",
  };
}

function post(value: unknown): RequestInit {
  return {
    method: "POST",
    headers: {
      "x-gameframe-player-id": semantic.viewer.playerId,
      "content-type": "application/json",
    },
    body: JSON.stringify(value),
  };
}

async function closeServer(server: ReturnType<typeof createDurableRpgHttpServer>) {
  await server.closeRealtime();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve())
  );
}

test("exploration Talk maps an adjacent viewer-safe anchor to a private canonical Runtime target and replays durably", async () => {
  const filePath = databasePath();
  let semanticAttachCount = 0;
  let failSemanticAttach = false;
  const server = createDurableRpgHttpServer({
    filePath,
    bootstrapCampaigns: [bootstrap()],
    clock: () => "2026-08-09T18:01:00.000Z",
    explorationTransport: {
      async attach(input) {
        semanticAttachCount += 1;
        if (failSemanticAttach) throw new Error("semantic attach unavailable after commit");
        assert.equal(input.campaignId, semantic.campaignId);
        assert.equal(input.authenticatedPlayerId, semantic.viewer.playerId);
        return structuredClone(semantic);
      },
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP address");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const attachResponse = await fetch(
      `${baseUrl}/api/rpg/campaigns/${encodeURIComponent(semantic.campaignId)}/exploration/attach`,
      post({
        protocolVersion: 1,
        kind: "campaign.exploration.attach",
        campaignId: semantic.campaignId,
      }),
    );
    assert.equal(attachResponse.status, 200);
    const attached = await attachResponse.json() as any;
    let position = attached.playerPosition;

    const move = async (direction: string) => {
      const response = await fetch(
        `${baseUrl}/api/rpg/campaigns/${encodeURIComponent(semantic.campaignId)}/exploration/move`,
        post({
          type: "exploration_move",
          protocolVersion: 1,
          campaignId: semantic.campaignId,
          sceneId: semantic.scene.sceneId,
          materializationRef: attached.materialization.materializationRef,
          expectedPositionRevision: position.positionRevision,
          direction,
        }),
      );
      assert.equal(response.status, 200);
      position = await response.json();
    };
    await move("west");
    await move("west");
    await move("west");
    await move("west");
    assert.deepEqual(position.transform, { x: 10, y: 7, facing: "west" });
    assert.equal(semanticAttachCount, 1, "physical movement must remain GameFrame-only");

    const talkRequest = {
      type: "exploration_interact",
      protocolVersion: 1,
      campaignId: semantic.campaignId,
      sceneId: semantic.scene.sceneId,
      materializationRef: attached.materialization.materializationRef,
      expectedPositionRevision: position.positionRevision,
      expectedGameframeCoordinationRevision: 3,
      commandId: "command:server-talk-proof",
      issuedAt: "2026-08-09T18:01:30.000Z",
      interaction: "talk",
      interactionTargetId: "entity:npc.warden-pell",
      text: "Pell, does this checkpoint look right?",
    };
    const talkResponse = await fetch(
      `${baseUrl}/api/rpg/campaigns/${encodeURIComponent(semantic.campaignId)}/exploration/interact`,
      post(talkRequest),
    );
    assert.equal(talkResponse.status, 200);
    const committed = await talkResponse.json() as any;
    assert.equal(committed.kind, "campaign.exploration_interaction_committed");
    assert.equal(committed.interactionTargetId, "entity:npc.warden-pell");
    assert.equal(committed.targetEntityId, undefined, "canonical target must not echo to browser");
    assert.equal(committed.replayed, false);
    assert.equal(semanticAttachCount, 2, "meaningful new Talk revalidates semantic scene once");

    const outbox = new SqliteRuntimeCommandOutbox({ filePath });
    try {
      const record = outbox.get(committed.command.deliveryId);
      assert.ok(record);
      assert.deepEqual(record.delivery.command, {
        kind: "campaign.submit_action",
        visibility: "private-to-runtime",
        text: "Pell, does this checkpoint look right?",
        interaction: {
          kind: "talk",
          targetEntityId: "npc.warden-pell",
        },
      });
      assert.equal(record.delivery.issuedAt, talkRequest.issuedAt);
    } finally {
      outbox.close();
    }

    const accepted = new SqliteRpgCommandAcceptanceRepository({ filePath });
    try {
      const events = accepted.presentationEvents(semantic.campaignId, 0);
      assert.equal(events.length, 1);
      assert.deepEqual(events[0]?.audience, {
        kind: "player",
        playerId: semantic.viewer.playerId,
      });
      assert.equal(events[0]?.payload.interactionTargetId, "entity:npc.warden-pell");
      assert.equal(events[0]?.payload.targetDisplayLabel, "veteran field warden");
    } finally {
      accepted.close();
    }

    failSemanticAttach = true;
    const retryResponse = await fetch(
      `${baseUrl}/api/rpg/campaigns/${encodeURIComponent(semantic.campaignId)}/exploration/interact`,
      post(talkRequest),
    );
    assert.equal(retryResponse.status, 200);
    const replayed = await retryResponse.json() as any;
    assert.equal(replayed.replayed, true);
    assert.equal(replayed.command.deliveryId, committed.command.deliveryId);
    assert.equal(semanticAttachCount, 2, "committed exact retry must not reauthorize against a changed world");

    const changedRetry = await fetch(
      `${baseUrl}/api/rpg/campaigns/${encodeURIComponent(semantic.campaignId)}/exploration/interact`,
      post({ ...talkRequest, text: "Different words under the same command ID." }),
    );
    assert.equal(changedRetry.status, 409);
    const conflict = await changedRetry.json() as any;
    assert.equal(conflict.error, "command-conflict");
    assert.equal(semanticAttachCount, 2, "conflicting retry must fail before semantic reauthorization");
  } finally {
    await closeServer(server);
  }
});

test("generic command ingress cannot manufacture typed Talk metadata", async () => {
  const filePath = databasePath();
  const server = createDurableRpgHttpServer({
    filePath,
    bootstrapCampaigns: [bootstrap()],
    explorationTransport: {
      async attach() {
        return structuredClone(semantic);
      },
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP address");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const response = await fetch(
      `${baseUrl}/api/rpg/campaigns/${encodeURIComponent(semantic.campaignId)}/commands`,
      post({
        protocolVersion: 2,
        campaignId: semantic.campaignId,
        commandId: "command:browser-cannot-target",
        issuedAt: "2026-08-09T18:02:00.000Z",
        command: {
          kind: "campaign.submit_action",
          expectedGameframeCoordinationRevision: 3,
          visibility: "public",
          text: "I talk to Pell.",
          interaction: {
            kind: "talk",
            targetEntityId: "npc.warden-pell",
          },
        },
      }),
    );
    assert.equal(response.status, 200);
    const committed = await response.json() as any;

    const outbox = new SqliteRuntimeCommandOutbox({ filePath });
    try {
      const record = outbox.get(committed.deliveryId);
      assert.ok(record);
      assert.deepEqual(record.delivery.command, {
        kind: "campaign.submit_action",
        visibility: "public",
        text: "I talk to Pell.",
      });
    } finally {
      outbox.close();
    }
  } finally {
    await closeServer(server);
  }
});
