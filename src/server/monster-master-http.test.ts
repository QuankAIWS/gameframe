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

test("HTTP boundary alternates human and Monster Master BattleBot deployments", async (context) => {
  const base = await startServer(context);
  const createdResponse = await authenticatedFetch(`${base}/api/matches`, "human", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      gameId: "monster-master-duel",
      playerIds: ["human", GAMEFRAME_BOT_PLAYER_ID],
    }),
  });
  assert.equal(createdResponse.status, 201);
  let view = await createdResponse.json();
  assert.equal(view.gameId, "monster-master-duel");
  assert.equal(view.observation.phase, "deployment");

  for (let deployment = 0; deployment < 3; deployment += 1) {
    const action = view.observation.legalActions.find((candidate: { type: string }) => (
      candidate.type === "deploy-unit"
    ));
    assert.ok(action);
    const response = await authenticatedFetch(
      `${base}/api/matches/${view.matchId}/actions`,
      "human",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actionId: `http-mm-human-deploy-${deployment}`,
          expectedRevision: view.revision,
          action,
        }),
      },
    );
    assert.equal(response.status, 200);
    view = await response.json();
  }

  assert.equal(view.revision, 6);
  assert.equal(view.eventCount, 6);
  assert.equal(view.observation.phase, "combat");
  assert.equal(view.observation.board.units.length, 6);
  assert.equal(view.observation.activePlayerId, "human");
  assert.equal(view.observation.activeUnitId, "alpha-emberling");
});

test("HTTP boundary preserves player-specific Monster Master legal actions", async (context) => {
  const base = await startServer(context);
  const created = await authenticatedFetch(`${base}/api/matches`, "alpha", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      gameId: "monster-master-duel",
      playerIds: ["alpha", "beta"],
    }),
  }).then((response) => response.json());
  assert.ok(created.observation.legalActions.length > 0);

  const betaView = await authenticatedFetch(
    `${base}/api/matches/${created.matchId}`,
    "beta",
  ).then((response) => response.json());
  assert.equal(betaView.observation.activePlayerId, "alpha");
  assert.equal(betaView.observation.legalActions.length, 0);

  const afterAlpha = await authenticatedFetch(
    `${base}/api/matches/${created.matchId}/actions`,
    "alpha",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actionId: "http-mm-alpha-deploy",
        expectedRevision: 0,
        action: created.observation.legalActions[0],
      }),
    },
  ).then((response) => response.json());
  assert.equal(afterAlpha.observation.activePlayerId, "beta");
  assert.equal(afterAlpha.observation.legalActions.length, 0);

  const activeBetaView = await authenticatedFetch(
    `${base}/api/matches/${created.matchId}`,
    "beta",
  ).then((response) => response.json());
  assert.ok(activeBetaView.observation.legalActions.length > 0);
});
