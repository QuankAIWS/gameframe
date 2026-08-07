import assert from "node:assert/strict";
import test from "node:test";
import { GAMEFRAME_BOT_PLAYER_ID } from "../agents/gameframe-bot.ts";
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

test("HTTP health advertises the tactical movement canary", async (context) => {
  const base = await startServer(context);
  const response = await fetch(`${base}/api/health`);
  const health = await response.json();
  assert.ok(health.games.includes("tactical-movement-canary"));
});

test("HTTP creates and advances a human-versus-ArenaBot tactical movement match", async (context) => {
  const base = await startServer(context);
  const createdResponse = await authenticatedFetch(`${base}/api/matches`, "human", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      gameId: "tactical-movement-canary",
      playerIds: ["human", GAMEFRAME_BOT_PLAYER_ID],
    }),
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.equal(created.gameId, "tactical-movement-canary");
  assert.equal(created.observation.board.map.width, 24);
  assert.equal(created.observation.board.map.height, 24);
  assert.equal(created.observation.activePlayerId, "human");
  assert.ok(created.observation.legalActions.length > 0);

  const actionResponse = await authenticatedFetch(
    `${base}/api/matches/${created.matchId}/actions`,
    "human",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actionId: "http-tactical-human-1",
        expectedRevision: 0,
        action: created.observation.legalActions[0],
      }),
    },
  );
  assert.equal(actionResponse.status, 200);
  const updated = await actionResponse.json();
  assert.equal(updated.revision, 2);
  assert.equal(updated.eventCount, 2);
  assert.equal(updated.observation.activePlayerId, "human");
});

test("HTTP supports two human tactical seats and complete path actions", async (context) => {
  const base = await startServer(context);
  const created = await authenticatedFetch(`${base}/api/matches`, "alice", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      gameId: "tactical-movement-canary",
      playerIds: ["alice", "bob"],
    }),
  }).then((response) => response.json());

  const action = created.observation.legalActions.find((candidate: { type: string }) => candidate.type === "move");
  assert.ok(action.path.length > 0);
  const updated = await authenticatedFetch(
    `${base}/api/matches/${created.matchId}/actions`,
    "alice",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actionId: "http-tactical-alice-1",
        expectedRevision: 0,
        action,
      }),
    },
  ).then((response) => response.json());
  assert.equal(updated.revision, 1);
  assert.equal(updated.observation.activePlayerId, "bob");

  const bobView = await authenticatedFetch(
    `${base}/api/matches/${created.matchId}`,
    "bob",
  ).then((response) => response.json());
  assert.equal(bobView.gameId, "tactical-movement-canary");
  assert.equal(bobView.observation.yourPlayerId, "bob");
  assert.ok(bobView.observation.legalActions.some((candidate: { type: string }) => candidate.type === "move"));
});
