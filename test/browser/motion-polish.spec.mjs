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

async function centerBattlefieldInViewport(page) {
  const canvas = page.locator("#monster-master-canvas");
  await canvas.evaluate((element) => element.scrollIntoView({ block: "center", inline: "center" }));
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box.x + box.width / 2).toBeGreaterThan(0);
  expect(box.y + box.height / 2).toBeGreaterThan(0);
  return box;
}

async function projectedPoint(page, coordinate) {
  await centerBattlefieldInViewport(page);
  return page.evaluate((target) => {
    const canvas = document.querySelector("#monster-master-canvas");
    const rect = canvas.getBoundingClientRect();
    const point = window.gameFrameMonsterProjection.worldToScreen(target);
    return { x: rect.left + point.x, y: rect.top + point.y };
  }, coordinate);
}

async function setCameraQuarter(page, quarter) {
  await page.evaluate((targetQuarter) => {
    window.gameFrameMonsterProjection.setRotation(targetQuarter, { animate: false });
  }, quarter);
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterProjection.getCamera().quarter)).toBe(quarter);
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

test("Monster Master animates the exact committed movement path in rotatable three-quarter view", async ({ page, request }) => {
  const prepared = await prepareMonsterMasterMove(request);
  const move = prepared.view.observation.legalActions.find((action) => action.type === "move");
  await page.goto(`/monster-master.html?match=${encodeURIComponent(prepared.view.matchId)}&player=${encodeURIComponent(prepared.activePlayerId)}`);

  const projectedCanvas = page.locator("#monster-master-motion-canvas");
  await expect(projectedCanvas).toBeVisible();
  await expect(projectedCanvas).toHaveAttribute("data-projection", "rotatable-dimetric");
  await expect(projectedCanvas).toHaveAttribute("data-billboard", "camera-facing");
  await expect(page.locator(".combat-canvas-frame")).toHaveAttribute("data-projection-ready", "true");

  await setCameraQuarter(page, 2);
  await page.locator("#monster-master-select-move").click();
  const point = await projectedPoint(page, move.path.at(-1));
  await page.mouse.click(point.x, point.y);

  await expect(page.locator("#monster-master-canvas")).toHaveAttribute(
    "data-last-animation-steps",
    String(move.path.length),
  );
});

test("Monster Master round-trips tiles from all four corners", async ({ page, request }) => {
  const prepared = await prepareMonsterMasterMove(request);
  await page.goto(`/monster-master.html?match=${encodeURIComponent(prepared.view.matchId)}&player=${encodeURIComponent(prepared.activePlayerId)}`);

  const canvas = page.locator("#monster-master-canvas");
  await expect(canvas).toHaveAttribute("data-projection", "rotatable-dimetric");
  await expect(page.locator("#monster-master-camera-corner")).toBeVisible();

  for (const quarter of [0, 1, 2, 3]) {
    await setCameraQuarter(page, quarter);
    const roundTrip = await page.evaluate(() => {
      const point = window.gameFrameMonsterProjection.worldToScreen({ x: 11, y: 11 });
      return window.gameFrameMonsterProjection.screenToTile(point);
    });
    expect(roundTrip).toEqual({ x: 11, y: 11 });
    await expect(page.locator(".combat-canvas-frame")).toHaveAttribute("data-camera-quarter", String(quarter));
  }
});

test("Monster Master rotation controls cycle corners while preserving camera center and zoom", async ({ page, request }) => {
  const prepared = await prepareMonsterMasterMove(request);
  await page.goto(`/monster-master.html?match=${encodeURIComponent(prepared.view.matchId)}&player=${encodeURIComponent(prepared.activePlayerId)}`);

  await setCameraQuarter(page, 0);
  const before = await page.evaluate(() => window.gameFrameMonsterProjection.getCamera());
  await page.locator("#monster-master-rotate-right").click();
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterProjection.getCamera().quarter)).toBe(1);
  await expect(page.locator("#monster-master-camera-corner")).toHaveText("Northeast");
  const after = await page.evaluate(() => window.gameFrameMonsterProjection.getCamera());
  expect(after.centerX).toBeCloseTo(before.centerX, 6);
  expect(after.centerY).toBeCloseTo(before.centerY, 6);
  expect(after.zoom).toBeCloseTo(before.zoom, 6);

  await page.locator("#monster-master-rotate-left").click();
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterProjection.getCamera().quarter)).toBe(0);
});

test("Monster Master supports wheel zoom and drag pan after rotating", async ({ page, request }) => {
  const prepared = await prepareMonsterMasterMove(request);
  await page.goto(`/monster-master.html?match=${encodeURIComponent(prepared.view.matchId)}&player=${encodeURIComponent(prepared.activePlayerId)}`);
  await setCameraQuarter(page, 3);

  const beforeZoom = await page.evaluate(() => window.gameFrameMonsterProjection.getCamera().zoom);
  const box = await centerBattlefieldInViewport(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -320);
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterProjection.getCamera().zoom)).toBeGreaterThan(beforeZoom);

  const beforePan = await page.evaluate(() => window.gameFrameMonsterProjection.getCamera());
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.55);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.63, { steps: 6 });
  await page.mouse.up({ button: "middle" });
  const afterPan = await page.evaluate(() => window.gameFrameMonsterProjection.getCamera());
  expect(Math.abs(afterPan.centerX - beforePan.centerX) + Math.abs(afterPan.centerY - beforePan.centerY)).toBeGreaterThan(0.5);
});

test("Monster Master fills the viewport and synchronizes the active-unit command HUD", async ({ page, request }) => {
  const prepared = await prepareMonsterMasterMove(request);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/monster-master.html?match=${encodeURIComponent(prepared.view.matchId)}&player=${encodeURIComponent(prepared.activePlayerId)}`);

  await expect(page.locator("body")).toHaveClass(/monster-master-match-active/);
  await expect(page.locator("#monster-master-unit-hud")).toBeVisible();
  await expect(page.locator("#monster-master-hud-name")).toHaveText(
    await page.locator("#monster-master-active-unit").textContent(),
  );
  await expect(page.locator("#monster-master-hud-health")).not.toHaveText("—");
  await expect(page.locator("#monster-master-hud-move")).toHaveText(/Available|Used/);
  await expect(page.locator("#monster-master-hud-primary")).toHaveText(/Available|Used/);

  const geometry = await page.evaluate(() => {
    const frame = document.querySelector(".combat-canvas-frame").getBoundingClientRect();
    const deck = document.querySelector(".monster-master-command-deck").getBoundingClientRect();
    const scrolling = document.scrollingElement;
    return {
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      scrollHeight: scrolling.scrollHeight,
      scrollWidth: scrolling.scrollWidth,
      frameHeight: frame.height,
      frameWidth: frame.width,
      deckBottom: deck.bottom,
    };
  });
  expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.viewportHeight + 2);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 2);
  expect(geometry.frameHeight).toBeGreaterThan(430);
  expect(geometry.frameWidth).toBeGreaterThan(620);
  expect(geometry.deckBottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);

  await page.keyboard.press("2");
  await expect(page.locator("#monster-master-select-move")).toHaveAttribute("aria-pressed", "true");
});

test("Monster Master mobile shell keeps gameplay bounded and exposes roster and unit drawers", async ({ page, request }) => {
  const prepared = await prepareMonsterMasterMove(request);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/monster-master.html?match=${encodeURIComponent(prepared.view.matchId)}&player=${encodeURIComponent(prepared.activePlayerId)}`);

  const dimensions = await page.evaluate(() => ({
    viewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
    scrollHeight: document.scrollingElement.scrollHeight,
    scrollWidth: document.scrollingElement.scrollWidth,
  }));
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.viewportHeight + 2);
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 2);
  await expect(page.locator(".monster-master-command-deck")).toBeVisible();

  await page.locator("#monster-master-open-roster").click();
  await expect(page.locator("body")).toHaveClass(/monster-master-roster-open/);
  await expect(page.locator("#monster-master-open-roster")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#monster-master-roster-rail")).toBeInViewport();

  await page.locator("#monster-master-drawer-backdrop").click({ position: { x: 360, y: 420 } });
  await expect(page.locator("body")).not.toHaveClass(/monster-master-roster-open/);

  await page.locator("#monster-master-open-intel").click();
  await expect(page.locator("body")).toHaveClass(/monster-master-intel-open/);
  await expect(page.locator("#monster-master-open-intel")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#monster-master-unit-hud")).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(page.locator("body")).not.toHaveClass(/monster-master-intel-open/);
});
