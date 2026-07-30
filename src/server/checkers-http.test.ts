import assert from "node:assert/strict";
import test from "node:test";
import { createGameFrameServer } from "./http-server.ts";

function authenticatedFetch(url: string, playerId: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-gameframe-player-id", playerId);
  return fetch(url, { ...init, headers });
}

async function startServer(context: { after(callback: () => void): void }) {
  const server = createGameFrameServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected an internet address.");
  return `http://127.0.0.1:${address.port}`;
}

test("HTTP health advertises every supported deterministic game", async (context) => {
  const base = await startServer(context);
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  const health = await response.json();
  assert.deepEqual(health.games, [
    "tic-tac-toe",
    "american-checkers",
    "tactical-movement-canary",
  ]);
});

test("HTTP boundary creates and advances human-versus-Theo Checkers", async (context) => {
  const base = await startServer(context);
  const createdResponse = await authenticatedFetch(`${base}/api/matches`, "human", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      gameId: "american-checkers",
      playerIds: ["human", "theo"],
    }),
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.equal(created.gameId, "american-checkers");
  assert.equal(created.revision, 0);
  assert.equal(created.observation.yourColor, "black");
  assert.equal(created.observation.legalActions.length, 7);

  const actionResponse = await authenticatedFetch(
    `${base}/api/matches/${created.matchId}/actions`,
    "human",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actionId: "http-checkers-human-1",
        expectedRevision: created.revision,
        action: created.observation.legalActions[0],
      }),
    },
  );
  assert.equal(actionResponse.status, 200);
  const updated = await actionResponse.json();
  assert.equal(updated.gameId, "american-checkers");
  assert.equal(updated.revision, 2);
  assert.equal(updated.eventCount, 2);
  assert.equal(updated.observation.activePlayerId, "human");
});

test("HTTP boundary supports separate human Checkers seats", async (context) => {
  const base = await startServer(context);
  const created = await authenticatedFetch(`${base}/api/matches`, "alice", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      gameId: "american-checkers",
      playerIds: ["alice", "bob"],
    }),
  }).then((response) => response.json());

  const afterAlice = await authenticatedFetch(
    `${base}/api/matches/${created.matchId}/actions`,
    "alice",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actionId: "http-checkers-alice-1",
        expectedRevision: 0,
        action: created.observation.legalActions[0],
      }),
    },
  ).then((response) => response.json());
  assert.equal(afterAlice.revision, 1);
  assert.equal(afterAlice.observation.activePlayerId, "bob");

  const bobView = await authenticatedFetch(
    `${base}/api/matches/${created.matchId}`,
    "bob",
  ).then((response) => response.json());
  assert.equal(bobView.gameId, "american-checkers");
  assert.equal(bobView.observation.yourColor, "red");
  assert.ok(bobView.observation.legalActions.length > 0);
});

test("HTTP boundary rejects unknown game IDs without creating a match", async (context) => {
  const base = await startServer(context);
  const response = await authenticatedFetch(`${base}/api/matches`, "alice", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      gameId: "imaginary-game",
      playerIds: ["alice", "bob"],
    }),
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error, "unknown_game");
});
