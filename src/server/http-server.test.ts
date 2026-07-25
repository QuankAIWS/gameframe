import assert from "node:assert/strict";
import test from "node:test";
import { createGameFrameServer } from "./http-server.ts";

function authenticatedFetch(url: string, playerId: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-gameframe-player-id", playerId);
  return fetch(url, { ...init, headers });
}

test("HTTP boundary creates and advances a human-versus-Theo match", async (context) => {
  const server = createGameFrameServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected an internet address.");
  const base = `http://127.0.0.1:${address.port}`;

  const health = await fetch(`${base}/api/health`).then((response) => response.json());
  assert.equal(health.status, "ok");

  const createdResponse = await authenticatedFetch(`${base}/api/matches`, "human", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerIds: ["human", "theo"] }),
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();

  const actionResponse = await authenticatedFetch(`${base}/api/matches/${created.matchId}/actions`, "human", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actionId: "http-1",
      expectedRevision: 0,
      action: { type: "place", cell: 0 },
    }),
  });
  assert.equal(actionResponse.status, 200);
  const updated = await actionResponse.json();
  assert.equal(updated.revision, 2);
  assert.equal(updated.observation.board[0], "X");
  assert.equal(updated.observation.board[4], "O");
});

test("HTTP boundary supports a two-human match without invoking Theo", async (context) => {
  const server = createGameFrameServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected an internet address.");
  const base = `http://127.0.0.1:${address.port}`;

  const created = await authenticatedFetch(`${base}/api/matches`, "alice", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerIds: ["alice", "bob"] }),
  }).then((response) => response.json());

  const afterAlice = await authenticatedFetch(`${base}/api/matches/${created.matchId}/actions`, "alice", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actionId: "http-alice-1",
      expectedRevision: 0,
      action: { type: "place", cell: 0 },
    }),
  }).then((response) => response.json());

  assert.equal(afterAlice.revision, 1);
  assert.equal(afterAlice.observation.nextPlayerId, "bob");

  const bobView = await authenticatedFetch(
    `${base}/api/matches/${created.matchId}`, "bob",
  ).then((response) => response.json());
  assert.equal(bobView.observation.yourMark, "O");
  assert.ok(bobView.observation.legalActions.some((action) => action.cell === 4));
});

test("HTTP boundary rejects anonymous and spoofed identities", async (context) => {
  const server = createGameFrameServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected an internet address.");
  const base = `http://127.0.0.1:${address.port}`;

  const anonymous = await fetch(`${base}/api/matches`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerIds: ["alice", "theo"] }),
  });
  assert.equal(anonymous.status, 401);

  const forbiddenCreate = await authenticatedFetch(`${base}/api/matches`, "mallory", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerIds: ["alice", "theo"] }),
  });
  assert.equal(forbiddenCreate.status, 403);

  const created = await authenticatedFetch(`${base}/api/matches`, "alice", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerIds: ["alice", "bob"] }),
  }).then((response) => response.json());

  const spoofed = await authenticatedFetch(`${base}/api/matches/${created.matchId}/actions`, "alice", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      playerId: "bob",
      actionId: "spoof-http-1",
      expectedRevision: 0,
      action: { type: "place", cell: 0 },
    }),
  });
  assert.equal(spoofed.status, 403);

  const unchanged = await authenticatedFetch(
    `${base}/api/matches/${created.matchId}`, "alice",
  ).then((response) => response.json());
  assert.equal(unchanged.revision, 0);
});
