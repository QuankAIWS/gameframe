import { expect, test } from "@playwright/test";

async function waitForPixi(page) {
  await expect(page.locator("body.monster-master-match-active")).toBeVisible();
  await expect(page.locator("body.monster-master-pixi-ready")).toBeVisible();
  await expect(page.locator("#monster-master-pixi-canvas")).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.gameFrameMonsterPixiBridge))).toBe(true);
}

async function dispatchBoardCoordinate(page, coordinate) {
  const dispatched = await page.evaluate(
    (target) => window.gameFrameMonsterPixiBridge.dispatchCoordinate(target),
    coordinate,
  );
  expect(dispatched).toBe(true);
}

async function deploySelectedUnit(page) {
  const action = await page.evaluate(() => {
    const view = window.gameFrameMonsterController.getView();
    const state = JSON.parse(document.querySelector("#monster-master-details")?.textContent || "{}");
    return view.observation.legalActions.find((candidate) => (
      candidate.type === "deploy-unit" && candidate.unitId === state.selectedUnitId
    )) ?? null;
  });
  expect(action).not.toBeNull();
  await dispatchBoardCoordinate(page, action.position);
}

async function enterCombat(page, player, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(`/monster-master.html?player=${encodeURIComponent(player)}`);
  await expect(page.locator("#monster-master-lobby")).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.gameFrameMonsterController))).toBe(true);
  const battleBot = page.locator("#monster-master-bot");
  await expect(battleBot).toBeVisible();
  await expect(battleBot).toBeEnabled();
  await battleBot.click();
  await waitForPixi(page);
  for (let deployment = 1; deployment <= 4; deployment += 1) {
    await deploySelectedUnit(page);
    await expect(page.locator("#monster-master-revision")).toHaveText(`Revision ${deployment * 2}`);
  }
  await expect(page.locator("#monster-master-phase")).toHaveText("Combat");
}

async function visibleButtonHitResults(buttons) {
  return await buttons.evaluateAll((nodes) => {
    const layer = document.querySelector('#monster-master-options[data-option-layer="true"]');
    const layerRect = layer.getBoundingClientRect();
    return nodes.map((button) => {
      const rect = button.getBoundingClientRect();
      const left = Math.max(rect.left, layerRect.left, 0);
      const right = Math.min(rect.right, layerRect.right, window.innerWidth);
      const top = Math.max(rect.top, layerRect.top, 0);
      const bottom = Math.min(rect.bottom, layerRect.bottom, window.innerHeight);
      if (right - left <= 1 || bottom - top <= 1) return { visible: false };
      const x = (left + right) / 2;
      const y = (top + bottom) / 2;
      const hit = document.elementFromPoint(x, y);
      return {
        visible: true,
        ownsHit: hit === button || button.contains(hit),
        hitTag: hit?.tagName ?? null,
        hitId: hit?.id ?? null,
        hitClass: hit?.className ?? null,
      };
    }).filter((result) => result.visible);
  });
}

async function assertOptionsOwnTheirHitArea(page) {
  const options = page.locator('#monster-master-options[data-option-layer="true"]');
  await expect(options).toBeVisible();
  const buttons = options.locator("button");
  await expect.poll(() => buttons.count()).toBeGreaterThan(0);

  const layerState = await options.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    const canvas = document.querySelector("#monster-master-pixi-canvas");
    const canvasZ = Number.parseInt(canvas ? getComputedStyle(canvas).zIndex : "0", 10) || 0;
    const layerZ = Number.parseInt(style.zIndex, 10) || 0;
    return {
      parentIsBody: node.parentElement === document.body,
      position: style.position,
      insideViewport: rect.left >= 0
        && rect.top >= 0
        && rect.right <= window.innerWidth
        && rect.bottom <= window.innerHeight,
      aboveCanvas: layerZ > canvasZ,
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  expect(layerState).toEqual({
    parentIsBody: true,
    position: "fixed",
    insideViewport: true,
    aboveCanvas: true,
    horizontalOverflow: 0,
  });

  const visibleResults = await visibleButtonHitResults(buttons);
  expect(visibleResults.length).toBeGreaterThan(0);
  for (const result of visibleResults) {
    expect(result.ownsHit, JSON.stringify(result)).toBe(true);
  }

  await page.evaluate(() => {
    window.__monsterMasterStableOption = document.querySelector("#monster-master-options button");
  });
  await page.waitForTimeout(1_500);
  await expect.poll(() => page.evaluate(() => (
    window.__monsterMasterStableOption?.isConnected
    && window.__monsterMasterStableOption === document.querySelector("#monster-master-options button")
  ))).toBe(true);

  const lastButton = buttons.last();
  await lastButton.scrollIntoViewIfNeeded();
  await expect(lastButton).toBeVisible();
  const lastOwnsHit = await lastButton.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit === button || button.contains(hit);
  });
  expect(lastOwnsHit).toBe(true);

  const firstButton = buttons.first();
  await firstButton.scrollIntoViewIfNeeded();
  await firstButton.click();
  await expect(page.locator("#monster-master-revision")).toHaveText("Revision 9");
}

for (const candidate of [
  { name: "desktop", viewport: { width: 1440, height: 900 } },
  { name: "mobile", viewport: { width: 390, height: 844 } },
]) {
  test(`Monster Master ${candidate.name} target options remain stable and physically clickable above Pixi`, async ({ page }) => {
    test.setTimeout(45_000);
    await enterCombat(page, `monster-option-hit-${candidate.name}`, candidate.viewport);
    await page.locator("#monster-master-select-move").click();
    await assertOptionsOwnTheirHitArea(page);
  });
}