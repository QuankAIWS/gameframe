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

async function openPrepared(page, prepared, { mobile = false } = {}) {
  if (mobile) await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/monster-master.html?match=${encodeURIComponent(prepared.view.matchId)}&player=${encodeURIComponent(prepared.activePlayerId)}`);
  await expect(page.locator("body.monster-master-pixi-ready")).toBeVisible();
  await expect(page.locator("#monster-master-pixi-canvas")).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.gameFrameMonsterGestures))).toBe(true);
}

async function battlefieldPoint(page, coordinate) {
  return page.evaluate((target) => window.gameFrameMonsterPixiBridge.worldToScreen(target), coordinate);
}

async function settleRenderer(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function setCameraQuarter(page, quarter) {
  await page.evaluate((targetQuarter) => {
    const renderer = window.gameFrameMonsterPixi;
    const current = renderer.getCamera().quarter;
    const clockwise = (targetQuarter - current + 4) % 4;
    const counterClockwise = (current - targetQuarter + 4) % 4;
    const turns = Math.min(clockwise, counterClockwise);
    for (let index = 0; index < turns; index += 1) {
      if (clockwise <= counterClockwise) renderer.rotateRight();
      else renderer.rotateLeft();
    }
  }, quarter);
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterPixi.getCamera().quarter)).toBe(quarter);
  await settleRenderer(page);
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
  await page.goto(`/?game=american-checkers&menu=1&player=${encodeURIComponent(player)}`);
  await expect(page.locator("#board-game-menu")).toBeVisible();
  await page.locator("#board-menu-computer").click();
  await page.locator(".checkers-cell.selectable-piece:enabled").first().click();
  await page.locator(".checkers-cell.legal-destination:enabled").first().click();
  await expect(page.locator("#board")).toHaveAttribute("data-last-animation-steps", /^[1-9]\d*$/);
});

test("Monster Master presents the exact committed movement path over the Pixi battlefield", async ({ page, request }) => {
  const prepared = await prepareMonsterMasterMove(request);
  const move = prepared.view.observation.legalActions.find((action) => action.type === "move");
  await openPrepared(page, prepared);

  await page.locator("#monster-master-select-move").click();
  const point = await battlefieldPoint(page, move.path.at(-1));
  await page.locator("#monster-master-pixi-canvas").click({ position: point, force: true });

  const frame = page.locator(".combat-canvas-frame");
  await expect(frame).toHaveAttribute("data-last-animation-steps", String(move.path.length));
  await expect(frame).toHaveAttribute("data-last-effect-types", /unit-moved/);
});

test("Monster Master round-trips a legal floor tile from all four Pixi camera corners", async ({ page, request }) => {
  const prepared = await prepareMonsterMasterMove(request);
  const target = prepared.view.observation.legalActions.find((action) => action.type === "move").path.at(-1);
  await openPrepared(page, prepared);
  for (const quarter of [0, 1, 2, 3]) {
    await setCameraQuarter(page, quarter);
    const roundTrip = await page.evaluate((coordinate) => {
      const point = window.gameFrameMonsterPixiBridge.worldToScreen(coordinate);
      return window.gameFrameMonsterPixi.screenToTile(point);
    }, target);
    expect(roundTrip).toEqual(target);
  }
});

test("Monster Master rotation controls preserve camera center and zoom", async ({ page, request }) => {
  const prepared = await prepareMonsterMasterMove(request);
  await openPrepared(page, prepared);
  await setCameraQuarter(page, 0);
  const before = await page.evaluate(() => window.gameFrameMonsterPixi.getCamera());
  await page.locator("#monster-master-rotate-right").click();
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterPixi.getCamera().quarter)).toBe(1);
  const after = await page.evaluate(() => window.gameFrameMonsterPixi.getCamera());
  expect(after.x).toBeCloseTo(before.x, 6);
  expect(after.y).toBeCloseTo(before.y, 6);
  expect(after.zoom).toBeCloseTo(before.zoom, 6);
});

test("Monster Master supports wheel zoom and drag pan after rotating", async ({ page, request }) => {
  const prepared = await prepareMonsterMasterMove(request);
  await openPrepared(page, prepared);
  await setCameraQuarter(page, 3);
  const canvas = page.locator("#monster-master-pixi-canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  const beforeZoom = await page.evaluate(() => window.gameFrameMonsterPixi.getCamera().zoom);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -320);
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterPixi.getCamera().zoom)).toBeGreaterThan(beforeZoom);

  const beforePan = await page.evaluate(() => window.gameFrameMonsterPixi.getCamera());
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .55);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .62, box.y + box.height * .63, { steps: 6 });
  await page.mouse.up();
  const afterPan = await page.evaluate(() => window.gameFrameMonsterPixi.getCamera());
  expect(Math.abs(afterPan.x - beforePan.x) + Math.abs(afterPan.y - beforePan.y)).toBeGreaterThan(.5);
});

test("Monster Master supports two-finger pan and pinch zoom", async ({ page, request }) => {
  const prepared = await prepareMonsterMasterMove(request);
  await openPrepared(page, prepared, { mobile: true });
  const canvas = page.locator("#monster-master-pixi-canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const before = await page.evaluate(() => window.gameFrameMonsterPixi.getCamera());
  const first = { x: box.x + box.width * .36, y: box.y + box.height * .5 };
  const second = { x: box.x + box.width * .64, y: box.y + box.height * .5 };

  await canvas.dispatchEvent("pointerdown", { pointerId: 41, pointerType: "touch", isPrimary: true, clientX: first.x, clientY: first.y, button: 0 });
  await canvas.dispatchEvent("pointerdown", { pointerId: 42, pointerType: "touch", isPrimary: false, clientX: second.x, clientY: second.y, button: 0 });
  await canvas.dispatchEvent("pointermove", { pointerId: 41, pointerType: "touch", isPrimary: true, clientX: first.x - 30, clientY: first.y + 12, buttons: 1 });
  await canvas.dispatchEvent("pointermove", { pointerId: 42, pointerType: "touch", isPrimary: false, clientX: second.x + 30, clientY: second.y + 12, buttons: 1 });
  await canvas.dispatchEvent("pointerup", { pointerId: 41, pointerType: "touch", isPrimary: true, clientX: first.x - 30, clientY: first.y + 12 });
  await canvas.dispatchEvent("pointerup", { pointerId: 42, pointerType: "touch", isPrimary: false, clientX: second.x + 30, clientY: second.y + 12 });

  const after = await page.evaluate(() => window.gameFrameMonsterPixi.getCamera());
  expect(after.zoom).toBeGreaterThan(before.zoom);
  expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeGreaterThan(.05);
});

test("Monster Master fills the viewport and synchronizes the active-creature command HUD", async ({ page, request }) => {
  const prepared = await prepareMonsterMasterMove(request);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPrepared(page, prepared);
  await expect(page.locator("#monster-master-unit-hud")).toBeVisible();
  await expect(page.locator("#monster-master-hud-health")).not.toHaveText("—");
  const geometry = await page.evaluate(() => {
    const frame = document.querySelector(".combat-canvas-frame").getBoundingClientRect();
    const deck = document.querySelector(".monster-master-command-deck").getBoundingClientRect();
    return {
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      bodyOverflow: getComputedStyle(document.body).overflow,
      frame: { top: frame.top, bottom: frame.bottom, width: frame.width },
      deckBottom: deck.bottom,
      scrollWidth: document.scrollingElement.scrollWidth,
    };
  });
  expect(geometry.bodyOverflow).toBe("hidden");
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 2);
  expect(geometry.frame.top).toBeGreaterThanOrEqual(0);
  expect(geometry.frame.width).toBeGreaterThan(620);
  expect(geometry.deckBottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
});

test("Monster Master mobile shell keeps gameplay bounded and exposes roster and creature drawers", async ({ page, request }) => {
  const prepared = await prepareMonsterMasterMove(request);
  await openPrepared(page, prepared, { mobile: true });
  const geometry = await page.evaluate(() => {
    const deck = document.querySelector(".monster-master-command-deck").getBoundingClientRect();
    const camera = document.querySelector(".monster-master-camera-dock").getBoundingClientRect();
    return {
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      bodyOverflow: getComputedStyle(document.body).overflow,
      scrollWidth: document.scrollingElement.scrollWidth,
      deck: { top: deck.top, bottom: deck.bottom },
      cameraBottom: camera.bottom,
    };
  });
  expect(geometry.bodyOverflow).toBe("hidden");
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 2);
  expect(geometry.cameraBottom).toBeLessThanOrEqual(geometry.deck.top - 4);
  expect(geometry.deck.bottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);

  await page.locator("#monster-master-open-roster").click();
  await expect(page.locator("body")).toHaveClass(/monster-master-roster-open/);
  await page.locator("#monster-master-drawer-backdrop").click({ position: { x: 360, y: 420 } });
  await expect(page.locator("body")).not.toHaveClass(/monster-master-roster-open/);

  await page.locator("#monster-master-open-intel").click();
  await expect(page.locator("body")).toHaveClass(/monster-master-intel-open/);
  await page.keyboard.press("Escape");
  await expect(page.locator("body")).not.toHaveClass(/monster-master-intel-open/);
});