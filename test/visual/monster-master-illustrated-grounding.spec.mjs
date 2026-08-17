import { expect, test } from "@playwright/test";

const rosterKey = "gameframe:monster-master:arena-roster-v1";
const scenarios = [
  { trainer: ["vanguard-trainer-v1", "Vanguard", "vanguard-trainer-v1-128.webp"], monster: ["rootmaw-brute-v1", "Rootmaw Brute", "rootmaw-brute-v1-128.webp"], others: ["gloamspore-stalker-v1", "stormcrest-skitter-v1"] },
  { trainer: ["commander-trainer-v1", "Commander", "commander-trainer-v1-128.webp"], monster: ["gloamspore-stalker-v1", "Gloamspore Stalker", "gloamspore-stalker-v1-128.svg"], others: ["rootmaw-brute-v1", "stormcrest-skitter-v1"] },
  { trainer: ["arcanic-trainer-v1", "Arcanic", "arcanic-trainer-v1-128.webp"], monster: ["stormcrest-skitter-v1", "Stormcrest Skitter", "stormcrest-skitter-v1-128.webp"], others: ["rootmaw-brute-v1", "gloamspore-stalker-v1"] },
  { trainer: ["medic-trainer-v1", "Medic", "medic-trainer-v1-128.webp"], monster: ["rootmaw-brute-v1", "Rootmaw Brute", "rootmaw-brute-v1-128.webp"], others: ["stormcrest-skitter-v1", "gloamspore-stalker-v1"] },
  { trainer: ["caller-trainer-v1", "Caller", "caller-trainer-v1-128.webp"], monster: ["stormcrest-skitter-v1", "Stormcrest Skitter", "stormcrest-skitter-v1-128.webp"], others: ["rootmaw-brute-v1", "gloamspore-stalker-v1"] },
];

async function selectedDeploymentAction(page) {
  return page.evaluate(() => {
    const view = window.gameFrameMonsterController?.getView?.();
    let diagnostics = {};
    try {
      diagnostics = JSON.parse(document.querySelector("#monster-master-details")?.textContent || "{}");
    } catch {
      diagnostics = {};
    }
    if (!view || !diagnostics.selectedUnitId) return null;
    return view.observation.legalActions.find((action) => (
      action.type === "deploy-unit" && action.unitId === diagnostics.selectedUnitId
    )) ?? null;
  });
}

async function selectDeployment(page, label) {
  await expect.poll(async () => page.locator('#monster-master-options button[data-action-kind="deploy-unit"]').count(), { timeout: 12_000 }).toBeGreaterThan(0);
  const button = page.locator('#monster-master-options button[data-action-kind="deploy-unit"]', { hasText: label }).first();
  await expect(button).toBeVisible();
  await button.click();
  await expect.poll(() => selectedDeploymentAction(page)).not.toBeNull();
}

async function commitSelectedDeployment(page) {
  const action = await selectedDeploymentAction(page);
  expect(action).not.toBeNull();
  const previousRevision = await page.evaluate(() => window.gameFrameMonsterController.getView().revision);
  const dispatched = await page.evaluate(
    (coordinate) => window.gameFrameMonsterPixiBridge.dispatchCoordinate(coordinate),
    action.position,
  );
  expect(dispatched).toBe(true);
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterController.getView().revision), { timeout: 12_000 }).toBeGreaterThan(previousRevision);
}

async function expectPortrait(page, contentId, assetName) {
  const portrait = page.locator(`[data-turn-unit-id][data-content-id="${contentId}"] .monster-master-turn-portrait`).first();
  await expect(portrait).toBeVisible();
  await expect.poll(() => portrait.evaluate((node) => getComputedStyle(node).backgroundImage)).toContain(assetName);
}

async function expectGroundedToken(page, contentId) {
  const token = page.locator(`.monster-master-trainer-token[data-content-id="${contentId}"]`).first();
  const image = token.locator("img");
  await expect(image).toBeAttached();
  await expect.poll(() => image.evaluate((node) => node.complete && node.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
  const geometry = await token.evaluate((node) => {
    const imageNode = node.querySelector("img");
    const imageRect = imageNode.getBoundingClientRect();
    const layerRect = node.parentElement.getBoundingClientRect();
    const unitId = node.dataset.unitId;
    const view = window.gameFrameMonsterController.getView();
    const unit = view.observation.board.units.find((candidate) => candidate.id === unitId);
    const point = window.gameFrameMonsterPixi.worldToScreen(unit.position);
    const zoom = window.gameFrameMonsterPixi.getCamera().zoom;
    const anchorY = Number(node.dataset.anchorY);
    const artHeight = Number(node.dataset.artHeight);
    const shadow = getComputedStyle(node, "::before");
    const expectedX = layerRect.left + point.x;
    const expectedY = layerRect.top + point.y;
    return {
      anchorDeltaX: imageRect.left + imageRect.width / 2 - expectedX,
      anchorDeltaY: imageRect.top + imageRect.height * anchorY - expectedY,
      actualHeight: imageRect.height,
      expectedHeight: artHeight * zoom,
      shadowWidth: Number.parseFloat(shadow.width),
      shadowHeight: Number.parseFloat(shadow.height),
      shadowBackground: shadow.backgroundImage,
      imageTop: imageRect.top,
      imageBottom: imageRect.bottom,
      layerTop: layerRect.top,
      layerBottom: layerRect.bottom,
    };
  });
  expect(Math.abs(geometry.anchorDeltaX)).toBeLessThan(2.5);
  expect(Math.abs(geometry.anchorDeltaY)).toBeLessThan(2.5);
  expect(Math.abs(geometry.actualHeight - geometry.expectedHeight)).toBeLessThan(2.5);
  expect(geometry.imageBottom).toBeGreaterThan(geometry.layerTop);
  expect(geometry.imageTop).toBeLessThan(geometry.layerBottom);
  expect(geometry.shadowWidth).toBeLessThanOrEqual(100);
  expect(geometry.shadowHeight).toBeLessThanOrEqual(20);
  expect(geometry.shadowWidth).toBeGreaterThan(geometry.shadowHeight * 3);
  expect(geometry.shadowBackground).toContain("radial-gradient");
  expect(geometry.shadowBackground).not.toContain("rgba(7, 13, 22, 0.98)");
  expect(geometry.shadowBackground).not.toContain("rgba(15, 8, 16, 0.98)");
}

for (const [index, scenario] of scenarios.entries()) {
  test(`Arena art calibration ${index + 1}: ${scenario.trainer[1]} and ${scenario.monster[1]}`, async ({ page }, testInfo) => {
    await page.addInitScript(({ key, selection }) => {
      localStorage.setItem(key, JSON.stringify(selection));
    }, {
      key: rosterKey,
      selection: { trainerContentId: scenario.trainer[0], monsterContentIds: [scenario.monster[0], ...scenario.others] },
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/monster-master.html?player=monster-art-${index}`);
    await expect.poll(() => page.evaluate(() => Boolean(window.gameFrameMonsterController))).toBe(true);
    await page.locator("#monster-master-bot").click();
    await expect(page.locator("body.monster-master-pixi-ready")).toBeVisible();



    await expectPortrait(page, scenario.trainer[0], scenario.trainer[2]);
    await selectDeployment(page, scenario.trainer[1]);
    await commitSelectedDeployment(page);
    await expectGroundedToken(page, scenario.trainer[0]);

    await selectDeployment(page, scenario.monster[1]);
    await expect(page.locator("#monster-master-hud-name")).toContainText(scenario.monster[1]);
    await expect.poll(() => page.locator("#monster-master-hud-glyph").evaluate((node) => getComputedStyle(node).backgroundImage)).toContain(scenario.monster[2]);
    await expectPortrait(page, scenario.monster[0], scenario.monster[2]);
    await commitSelectedDeployment(page);
    await expectGroundedToken(page, scenario.monster[0]);

    await page.screenshot({
      path: testInfo.outputPath(`monster-master-art-${index + 1}.png`),
      fullPage: true,
      animations: "disabled",
    });
  });
}
