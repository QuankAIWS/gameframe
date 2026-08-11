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

test("HTTP health advertises every supported deterministic game", async (context) => {
  const base = await startServer(context);
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  const health = await response.json();
  assert.deepEqual(health.games, [
    "tic-tac-toe",
    "american-checkers",
    "othello",
    "tactical-movement-canary",
    "tactical-combat-canary",
    "monster-master-duel",
  ]);
});

test("HTTP boundary creates and advances human-versus-CheckersBot", async (context) => {
  const base = await startServer(context);
  const createdResponse = await authenticatedFetch(`${base}/api/matches`, "human", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      gameId: "american-checkers",
      playerIds: ["human", GAMEFRAME_BOT_PLAYER_ID],
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
  const afterHuman = await actionResponse.json();
  assert.equal(afterHuman.revision, 2);
  assert.equal(afterHuman.observation.you, "human");
  assert.equal(afterHuman.observation.currentPlayerId, "human");
});

test("HTTP boundary rejects missing and mismatched authenticated identities", async (context) => {
  const base = await startServer(context);
  const unauthenticated = await fetch(`${base}/api/matches`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      gameId: "american-checkers",
      playerIds: ["human", GAMEFRAME_BOT_PLAYER_ID],
    }),
  });
  assert.equal(unauthenticated.status, 401);

  const createdResponse = await authenticatedFetch(`${base}/api/matches`, "human", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      gameId: "american-checkers",
      playerIds: ["human", GAMEFRAME_BOT_PLAYER_ID],
    }),
  });
  const created = await createdResponse.json();
  const mismatched = await authenticatedFetch(
    `${base}/api/matches/${created.matchId}`,
    "someone-else",
  );
  assert.equal(mismatched.status, 403);
});
