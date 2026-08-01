import { expect, test } from "@playwright/test";

function playerHeaders(playerId) {
  return { "x-gameframe-player-id": playerId };
}

async function createMatch(request, gameId, playerIds) {
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
      actionId: `presentation-${crypto.randomUUID()}`,
      expectedRevision: view.revision,
      action,
    },
  });
  expect(response.status()).toBe(200);
  return response.json();
}

async function completeTicTacToe(request) {
  const players = [`polish-x-${crypto.randomUUID()}`, `polish-o-${crypto.randomUUID()}`];
  let view = await createMatch(request, "tic-tac-toe", players);
  for (const [playerId, cell] of [[players[0], 0], [players[1], 3], [players[0], 1], [players[1], 4], [players[0], 2]]) {
    view = await viewAs(request, view.matchId, playerId);
    view = await submit(request, view, playerId, { type: "place", cell });
  }
  return { view, players };
}

async function prepareMonsterMasterMove(request) {
  const players = [`motion-alpha-${crypto.randomUUID()}`, `motion-beta-${crypto.randomUUID()}`];
  let view = await createMatch(request, "monster-master-duel", players);
  for (let step = 0; step < 30; step += 1) {
    const activePlayerId = view.observation.activePlayerId;
    view = await viewAs(request, view.matchId, activePlayerId);
    const move = view.observation.legalActions.find((action) => action.type === "move");
    if (move) return { view, activePlayerId };
    const action = view.observation.legalActions.find((candidate) => candidate.type === "deploy-unit")
      ?? view.observation.legalActions.find((candidate) => candidate.type === "end-activation");
    expect(action).toBeDefined();
    view = await submit(request, view, activePlayerId, action);
  }
  throw new Error("Monster Master did not reach a legal movement action.");
}

test("Tic-Tac-Toe presents a board-level result and starts a rematch", async ({ page, request }) => {
  const { view, players } = await completeTicTacToe(request);
  await page.goto(`/?match=${encodeURIComponent(view.matchId)}&player=${encodeURIComponent(players[0])}`);

  const overlay = page.locator("#game-outcome-overlay");
  await expect(overlay).toBeVisible();
  await expect(overlay.getByRole("heading")).toHaveText("You won");
  await overlay.getByRole("button", { name: "Rematch" }).click();

  await expect(page.locator("#revision")).toHaveText("Revision 0");
  await expect(overlay).toBeHidden();
});

test("Checkers exposes a visible movement animation after a committed turn", async ({ page }) => {
  const player = `checkers-motion-${crypto.randomUUID()}`;
  await page.goto(`/?player=${encodeURIComponent(player)}`);
  await page.locator("#select-checkers").click();
  await page.getByRole("button", { name: "Challenge Theo" }).click();

  await page.locator(".checkers-cell.selectable-piece:enabled").first().click();
  await page.locator(".checkers-cell.legal-destination:enabled").first().click();
  await expect(page.locator("#board")).toHaveAttribute("data-last-animation-steps", /^[1-9]\d*$/);
});

test("Monster Master animates the exact committed movement path", async ({ page, request }) => {
  const prepared = await prepareMonsterMasterMove(request);
  const move = prepared.view.observation.legalActions.find((action) => action.type === "move");
  await page.goto(`/monster-master.html?match=${encodeURIComponent(prepared.view.matchId)}&player=${encodeURIComponent(prepared.activePlayerId)}`);

  await page.locator("#monster-master-select-move").click();
  await page.locator(`#monster-master-options button[data-destination="${move.path.at(-1).x},${move.path.at(-1).y}"]`).click();

  await expect(page.locator("#monster-master-canvas")).toHaveAttribute(
    "data-last-animation-steps",
    String(move.path.length),
  );
});
