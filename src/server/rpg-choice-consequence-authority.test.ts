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

function serviceFetch(url: string, serviceId: string, body: unknown) {
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-gameframe-service-id": serviceId,
    },
    body: JSON.stringify(body),
  });
}

test("runtime consequences cannot overwrite deterministic check metadata", async (context) => {
  const server = createGameFrameServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected an internet address.");
  const base = `http://127.0.0.1:${address.port}`;

  const commandResponse = await fetch(
    `${base}/api/rpg/campaigns/${campaignId}/commands`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-gameframe-player-id": "player:ada",
      },
      body: JSON.stringify({
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
    },
  );
  assert.equal(commandResponse.status, 200);

  const presentationCase = record(
    fixture.runtimeChoicePresentationCase,
    "runtimeChoicePresentationCase",
  );
  const request = structuredClone(record(presentationCase.request, "presentation request"));
  const events = request.events as JsonRecord[];
  const payload = record(events[0]?.payload, "choice payload");
  const options = payload.options as JsonRecord[];
  const check = record(options[0]?.check, "choice check");
  const success = record(check.success, "success consequence");
  success.result = "failure";

  const response = await serviceFetch(
    `${base}/api/rpg/campaigns/${campaignId}/events`,
    "rpg-gm-runtime",
    request,
  );
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error, "invalid-command");
  assert.match(body.message, /cannot override reserved field: result/i);

  const viewResponse = await fetch(
    `${base}/api/rpg/campaigns/${campaignId}/attach`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-gameframe-player-id": "player:ada",
      },
      body: JSON.stringify({
        protocolVersion: 1,
        kind: "campaign.attach",
        campaignId,
        connectionId: "connection:reserved-consequence-check",
      }),
    },
  );
  assert.equal(viewResponse.status, 200);
  const view = await viewResponse.json();
  assert.equal(view.campaignRevision, 5);
  assert.equal(
    view.events.some((event: { type: string }) => event.type === "choice.presented"),
    false,
  );
});
