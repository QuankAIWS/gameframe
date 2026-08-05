import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  GAMEFRAME_PROXY_AUTH_HEADERS,
  HmacProxyRequestAuthenticator,
  signGameFrameProxyRequest,
} from "../auth/hmac-proxy-request-authenticator.ts";
import { createDurableRpgHttpServer } from "./durable-rpg-http-server.ts";

const directories: string[] = [];
const proxySecret = "p".repeat(48);
const serviceToken = "s".repeat(48);
const now = 1_786_000_000_000;

test.afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-rpg-hmac-http-"));
  directories.push(directory);
  return join(directory, "gameframe.sqlite");
}

async function start() {
  const server = createDurableRpgHttpServer({
    filePath: databasePath(),
    authenticator: new HmacProxyRequestAuthenticator({
      proxySecret,
      serviceToken,
      now: () => now,
    }),
    bootstrapCampaigns: [
      {
        campaignId: "campaign-one",
        title: "Signed campaign",
        status: "active",
        state: {
          gameframeCoordinationRevision: 0,
          presentationSequence: 0,
          linkedNarrativeRevision: 0,
        },
        memberships: [
          {
            playerId: "discord:1234",
            role: "player",
            partyId: "party:keepers",
            joinedPresentationSequence: 0,
          },
        ],
        events: [],
        initializedAt: "2026-08-04T20:00:00.000Z",
      },
    ],
    clock: () => "2026-08-04T20:01:00.000Z",
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP address");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

function signedPost(
  baseUrl: string,
  path: string,
  value: unknown,
  nonce: string,
): RequestInit {
  const body = JSON.stringify(value);
  const headers = signGameFrameProxyRequest({
    proxySecret,
    method: "POST",
    url: `${baseUrl}${path}`,
    body,
    playerId: "discord:1234",
    issuedAt: now,
    nonce,
    displayName: "Ada",
  });
  headers.set("content-type", "application/json");
  return { method: "POST", headers, body };
}

async function close(server: ReturnType<typeof createDurableRpgHttpServer>): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve())
  );
}

test("accepts signed player commands and bearer-authenticated runtime results", async () => {
  const { server, baseUrl } = await start();
  try {
    const attachPath = "/api/rpg/campaigns/campaign-one/attach";
    const attachBody = { protocolVersion: 2, campaignId: "campaign-one" };
    const attachInit = signedPost(baseUrl, attachPath, attachBody, "nonce-attach-000001");
    const attached = await fetch(`${baseUrl}${attachPath}`, attachInit);
    assert.equal(attached.status, 200);
    assert.equal((await attached.json() as Record<string, unknown>).campaignId, "campaign-one");

    const replay = await fetch(`${baseUrl}${attachPath}`, attachInit);
    assert.equal(replay.status, 403);
    assert.match(
      String((await replay.json() as Record<string, unknown>).message),
      /nonce was already used/,
    );

    const commandPath = "/api/rpg/campaigns/campaign-one/commands";
    const command = {
      protocolVersion: 2,
      campaignId: "campaign-one",
      commandId: "command-one",
      issuedAt: "2026-08-04T20:00:01.000Z",
      command: {
        kind: "campaign.submit_action",
        expectedGameframeCoordinationRevision: 0,
        visibility: "public",
        text: "Inspect the gate.",
      },
    };
    const accepted = await fetch(
      `${baseUrl}${commandPath}`,
      signedPost(baseUrl, commandPath, command, "nonce-command-0001"),
    );
    assert.equal(accepted.status, 200);
    assert.equal(
      (await accepted.json() as Record<string, unknown>).gameframeCoordinationRevision,
      1,
    );

    const eventsPath = "/api/rpg/campaigns/campaign-one/events";
    const runtimeBatch = {
      protocolVersion: 2,
      coordinationMutationId: "coordination:result-one",
      campaignId: "campaign-one",
      expectedGameframeCoordinationRevision: 1,
      runtimeCommit: {
        kind: "runtime.narrative_committed",
        runtimeCommitKind: "runtime.events",
        runtimeCommitId: "runtime-commit:one",
        sourceCommandId: "command-one",
        sourceGameframeCoordinationRevision: 1,
        previousNarrativeRevision: 0,
        narrativeRevision: 1,
      },
      events: [
        {
          eventId: "event:result-one",
          type: "scene.presented",
          audience: { kind: "public" },
          payload: { narration: "The gate opens." },
          createdAt: "2026-08-04T20:00:02.000Z",
        },
      ],
    };
    const linked = await fetch(`${baseUrl}${eventsPath}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${serviceToken}`,
        [GAMEFRAME_PROXY_AUTH_HEADERS.serviceId]: "rpg-gm-runtime",
        "content-type": "application/json",
      },
      body: JSON.stringify(runtimeBatch),
    });
    assert.equal(linked.status, 200);
    assert.equal((await linked.json() as Record<string, unknown>).linkedNarrativeRevision, 1);
  } finally {
    await close(server);
  }
});

test("rejects unsigned development headers and signed body substitution", async () => {
  const { server, baseUrl } = await start();
  try {
    const path = "/api/rpg/campaigns/campaign-one/commands";
    const original = {
      protocolVersion: 2,
      campaignId: "campaign-one",
      commandId: "command-one",
      issuedAt: "2026-08-04T20:00:01.000Z",
      command: {
        kind: "campaign.submit_action",
        expectedGameframeCoordinationRevision: 0,
        visibility: "public",
        text: "Inspect the gate.",
      },
    };
    const unsigned = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-gameframe-player-id": "discord:1234",
      },
      body: JSON.stringify(original),
    });
    assert.equal(unsigned.status, 401);

    const signed = signedPost(baseUrl, path, original, "nonce-command-0002");
    const substituted = {
      ...original,
      command: { ...original.command, text: "Open the gate." },
    };
    const tampered = await fetch(`${baseUrl}${path}`, {
      ...signed,
      body: JSON.stringify(substituted),
    });
    assert.equal(tampered.status, 403);
    assert.match(
      String((await tampered.json() as Record<string, unknown>).message),
      /body digest does not match/,
    );
  } finally {
    await close(server);
  }
});
