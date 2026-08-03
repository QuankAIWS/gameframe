import { test, expect } from "@playwright/test";

async function expectStyledDestinationBar(page, theme) {
  const bar = page.locator("#gameframe-destination-bar");
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute("data-theme", theme);
  await expect.poll(() => bar.evaluate((node) => getComputedStyle(node).display)).toBe("grid");
  await expect.poll(() => bar.evaluate((node) => getComputedStyle(node).position)).toBe("sticky");
  await expect.poll(() => page.locator("#gameframe-session-badge").evaluate((node) => getComputedStyle(node).position)).toBe("fixed");
}

async function openTic(page, viewport, player) {
  await page.setViewportSize(viewport);
  await page.goto(`/?game=tic-tac-toe&menu=1&player=${player}`);
  await page.locator("#challenge-theo").click();
  await expect(page.locator("body.tic-tac-toe-noir-running")).toBeVisible();
  await expectStyledDestinationBar(page, "tic");
  await expect(page.locator(".tic-noir-topbar")).toHaveCount(0);
  await expect(page.locator(".tic-noir-board-frame")).toBeVisible();
  await expect(page.locator(".tic-noir-control-rail")).toBeVisible();
}

async function visibleDeploymentAction(page) {
  return page.evaluate(() => {
    const view = window.gameFrameMonsterController?.getView?.();
    const canvas = document.querySelector("#monster-master-pixi-canvas");
    let diagnostics = {};
    try {
      diagnostics = JSON.parse(document.querySelector("#monster-master-details")?.textContent || "{}");
    } catch {
      diagnostics = {};
    }
    if (!view || !canvas || !diagnostics.selectedUnitId) return null;
    const rect = canvas.getBoundingClientRect();
    const actions = view.observation.legalActions.filter(
      (action) => action.type === "deploy-unit" && action.unitId === diagnostics.selectedUnitId,
    );
    for (const action of actions) {
      const point = window.gameFrameMonsterPixiBridge?.worldToScreen?.(action.position);
      if (!point) continue;
      const clientX = rect.left + point.x;
      const clientY = rect.top + point.y;
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) continue;
      const target = document.elementFromPoint(clientX, clientY);
      if (target?.id !== "monster-master-pixi-canvas") continue;
      const picked = window.gameFrameMonsterPixi?.screenToTile?.(point);
      if (picked?.x !== action.position.x || picked?.y !== action.position.y) continue;
      return { action, point };
    }
    return null;
  });
}

async function deployNextMonsterMasterUnit(page) {
  await expect.poll(() => page.evaluate(() => {
    const view = window.gameFrameMonsterController?.getView?.();
    return Boolean(
      view
      && view.observation.phase === "deployment"
      && view.observation.activePlayerId === view.observation.yourPlayerId
    );
  }), { timeout: 8_000 }).toBe(true);

  const previousRevision = await page.evaluate(() => window.gameFrameMonsterController.getView().revision);
  await page.locator('#monster-master-options [data-action-kind="deploy-unit"]').first().click();
  await expect.poll(() => visibleDeploymentAction(page), { timeout: 8_000 }).not.toBeNull();
  const target = await visibleDeploymentAction(page);
  const canvas = await page.locator("#monster-master-pixi-canvas").boundingBox();
  if (!canvas || !target) throw new Error("No unobstructed Pixi deployment tile was available.");
  await page.mouse.click(canvas.x + target.point.x, canvas.y + target.point.y);
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterController?.getView()?.revision ?? -1), {
    timeout: 8_000,
  }).toBeGreaterThan(previousRevision);
}

test("Tic-Tac-Toe keeps only the styled universal destination bar on mobile", async ({ page }) => {
  await openTic(page, { width: 390, height: 844 }, "tic-style-regression-mobile");

  const board = await page.locator(".tic-noir-board-frame").boundingBox();
  if (!board) throw new Error("Tic mobile board did not produce layout bounds.");
  expect(board.width).toBeGreaterThanOrEqual(330);
  expect(board.height).toBeGreaterThanOrEqual(330);
});

test("Tic-Tac-Toe uses a two-row desktop viewport with an unclipped board and telemetry", async ({ page }) => {
  await openTic(page, { width: 1440, height: 960 }, "tic-style-regression-desktop");

  const rows = await page.locator("#match-panel").evaluate((node) =>
    getComputedStyle(node).gridTemplateRows.split(/\s+/).filter(Boolean),
  );
  expect(rows).toHaveLength(2);

  const board = await page.locator(".tic-noir-board-frame").boundingBox();
  const firstPlayer = await page.locator("#player-x").boundingBox();
  const secondPlayer = await page.locator("#player-o").boundingBox();
  const footer = await page.locator(".tic-noir-footer").boundingBox();
  if (!board || !firstPlayer || !secondPlayer || !footer) {
    throw new Error("Tic desktop composition did not produce complete layout bounds.");
  }

  expect(board.width).toBeGreaterThanOrEqual(460);
  expect(board.width).toBeLessThanOrEqual(700);
  expect(board.height).toBeGreaterThanOrEqual(460);
  expect(firstPlayer.height).toBeGreaterThanOrEqual(70);
  expect(secondPlayer.height).toBeGreaterThanOrEqual(70);
  expect(footer.height).toBeLessThanOrEqual(64);
  expect(board.y).toBeGreaterThanOrEqual(80);
  expect(board.y + board.height).toBeLessThanOrEqual(footer.y);
});

test("Checkers never inherits Tic-Tac-Toe presentation wrappers", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?game=american-checkers&menu=1&player=checkers-style-regression");
  await page.locator("#challenge-theo").click();

  await expect(page.locator("body.gameframe-shared-match-running")).toBeVisible();
  await expect(page.locator("body.tic-tac-toe-noir-running")).toHaveCount(0);
  await expectStyledDestinationBar(page, "checkers");
  await expect(page.locator("#board.board-checkers")).toBeVisible();
  await expect(page.locator("#board .checkers-cell")).toHaveCount(64);
  await expect(page.locator(".tic-noir-board-frame")).toHaveCount(0);
  await expect(page.locator(".tic-noir-control-rail")).toHaveCount(0);
  await expect(page.locator(".tic-noir-footer")).toHaveCount(0);
});

test("Monster Master keeps its mobile setup control and session badge inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/monster-master.html?player=monster-mobile-regression");
  await expect.poll(() => page.evaluate(() => Boolean(window.gameFrameMonsterController))).toBe(true);
  await page.locator("#monster-master-theo").click();

  await expect(page.locator("body.monster-master-match-active")).toBeVisible();
  await expectStyledDestinationBar(page, "monster");
  await expect(page.locator("#gameframe-session-badge")).toBeVisible();
  await expect(page.locator("body.monster-master-overlay-ready")).toBeVisible();
  await expect(page.locator("body.monster-master-pixi-ready")).toBeVisible();

  const setup = await page.locator("#monster-master-new-match").boundingBox();
  const status = await page.locator("#monster-master-status").boundingBox();
  const viewport = page.viewportSize();
  if (!setup || !status || !viewport) throw new Error("Monster Master mobile header did not produce layout bounds.");

  expect(setup.width).toBeGreaterThanOrEqual(52);
  expect(setup.x).toBeGreaterThanOrEqual(0);
  expect(setup.x + setup.width).toBeLessThanOrEqual(viewport.width);
  expect(status.width).toBeGreaterThanOrEqual(120);
  await expect(page.locator("#monster-master-camera-dock")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("Monster Master uses a battlefield background with working contextual unit and camera overlays", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/monster-master.html?player=monster-overlay-regression");
  await expect.poll(() => page.evaluate(() => Boolean(window.gameFrameMonsterController))).toBe(true);
  await page.locator("#monster-master-theo").click();
  await expect(page.locator("body.monster-master-overlay-ready")).toBeVisible();
  await expect(page.locator("body.monster-master-pixi-ready")).toBeVisible();

  const match = await page.locator("#monster-master-match").boundingBox();
  const battlefield = await page.locator(".monster-master-battlefield-stage").boundingBox();
  const frame = await page.locator(".monster-master-battlefield-stage .combat-canvas-frame").boundingBox();
  if (!match || !battlefield || !frame) throw new Error("Monster Master battlefield did not produce full-layer bounds.");
  expect(Math.abs(match.width - battlefield.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(match.height - battlefield.height)).toBeLessThanOrEqual(2);
  expect(Math.abs(match.width - frame.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(match.height - frame.height)).toBeLessThanOrEqual(2);

  await expect(page.locator("#monster-master-camera-dock .monster-master-camera-dpad")).toBeVisible();
  await expect(page.locator("#monster-master-camera-dock .monster-master-camera-zoom")).toBeVisible();
  await expect(page.locator("#monster-master-camera-dock .monster-master-rotation-controls")).toBeVisible();
  await expect(page.locator("#monster-master-unit-hud .section-label")).toHaveText("DEPLOYING UNIT");
  await expect(page.locator("#monster-master-hud-health")).toHaveText("14/14");
  await expect(page.locator("#monster-master-hud-initiative")).toHaveText("Initiative 7");
  await expect(page.locator("#monster-master-return-active")).toHaveCount(1);
  await expect(page.locator("#monster-master-return-active")).toBeHidden();

  await deployNextMonsterMasterUnit(page);
  await deployNextMonsterMasterUnit(page);
  await deployNextMonsterMasterUnit(page);
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterController?.getView()?.observation.phase), {
    timeout: 8_000,
  }).toBe("combat");
  await expect(page.locator("#monster-master-unit-hud")).toHaveAttribute("data-role", "emberling");
  await expect(page.locator("#monster-master-unit-hud .section-label")).toHaveText("ACTIVE UNIT");
  await expect(page.locator("#monster-master-hud-health")).toHaveText("8/8");
  await expect(page.locator("#monster-master-hud-initiative")).toHaveText("Initiative 9");
  await expect(page.locator("#monster-master-select-attack .monster-master-action-label")).toHaveText("Cinder Volley");
  await expect(page.locator("#monster-master-select-mend")).toBeHidden();
  await expect(page.locator('#monster-master-ability-list [data-ability-id="cinder-volley"]')).toBeVisible();
  await expect(page.locator('#monster-master-ability-list [data-ability-id="mend"]')).toHaveCount(0);

  const nowTurn = page.locator(".monster-master-turn-unit.is-active");
  await expect(nowTurn).toBeVisible();
  await expect.poll(() => nowTurn.locator(".monster-master-turn-portrait").evaluate(
    (node) => getComputedStyle(node).animationName,
  )).toContain("monster-master-now-wiggle");

  await page.screenshot({ path: testInfo.outputPath("monster-master-contextual-combat-desktop.png"), fullPage: true });

  const enemyTurn = page.locator('.monster-master-turn-unit[data-owner="enemy"]').first();
  await enemyTurn.click();
  await expect(enemyTurn).toHaveClass(/is-inspected/);
  await expect.poll(() => enemyTurn.evaluate((node) => ({
    content: getComputedStyle(node, "::after").content,
    animationName: getComputedStyle(node, "::after").animationName,
  }))).toEqual({
    content: '"VIEWING"',
    animationName: "monster-master-viewing-flash",
  });
  await expect(page.locator("#monster-master-unit-hud")).toHaveAttribute("data-owner", "enemy");
  await expect(page.locator("#monster-master-return-active")).toBeVisible();
  await page.locator("#monster-master-return-active").click();
  await expect(page.locator("#monster-master-unit-hud")).toHaveAttribute("data-role", "emberling");
});
