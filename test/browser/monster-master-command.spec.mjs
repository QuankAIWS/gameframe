import { expect, test } from "@playwright/test";

const gameId = "monster-master-duel";

function playerHeaders(playerId) {
  return { "x-gameframe-player-id": playerId };
}

async function createMatch(request, playerIds) {
  const response = await request.post("/api/matches", {
    headers: playerHeaders(playerIds[0]),
    data: { gameId, playerIds },
  });
  expect(response.status()).toBe(201);
  return response.json();
}

async function viewAs(request, matchId, playerId) {
  const response = await request.get(`/api/matches/${encodeURIComponent(matchId)}`, {
    headers: playerHeaders(playerId),
  });
  expect(response.status()).toBe(200);
  return response.json();
}

async function submit(request, view, playerId, action) {
  const response = await request.post(`/api/matches/${encodeURIComponent(view.matchId)}/actions`, {
    headers: playerHeaders(playerId),
    data: {
      actionId: `browser-command-${crypto.randomUUID()}`,
      expectedRevision: view.revision,
      action,
    },
  });
  expect(response.status()).toBe(200);
  return response.json();
}

async function prepareRoundTwo(request) {
  let view = await createMatch(request, ["monster-command-alpha", "monster-command-beta"]);
  for (let step = 0; step < 20 && view.observation.round < 2; step += 1) {
    const playerId = view.observation.activePlayerId;
    view = await viewAs(request, view.matchId, playerId);
    const action = view.observation.phase === "deployment"
      ? view.observation.legalActions.find((candidate) => candidate.type === "deploy-unit")
      : view.observation.legalActions.find((candidate) => candidate.type === "end-activation");
    expect(action).toBeDefined();
    view = await submit(request, view, playerId, action);
  }
  expect(view.observation.phase).toBe("combat");
  expect(view.observation.round).toBe(2);
  return view;
}

test("round start restores command energy and renders both authoritative effects", async ({ page, request }) => {
  const prepared = await prepareRoundTwo(request);
  await page.goto(`/monster-master.html?match=${encodeURIComponent(prepared.matchId)}&player=monster-command-alpha`);

  await expect(page.locator("#monster-master-round")).toHaveText("2");
  await expect(page.locator("#monster-master-alpha-command")).toHaveText("3");
  await expect(page.locator("#monster-master-beta-command")).toHaveText("3");
  await expect(page.locator("#monster-master-effects")).toContainText("Round 2 started");
  await expect(page.locator("#monster-master-effects")).toContainText("You restored 1 command");
  await expect(page.locator("#monster-master-effects")).toContainText("Opponent restored 1 command");
});
