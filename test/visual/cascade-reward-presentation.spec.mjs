import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const output = "visual-results/player-ui-review";
const stateKey = "scribbles-gameframe.cascade-state:v1";
const soundKey = "scribbles-gameframe.cascade-sound:v1";
const effectsKey = "scribbles-gameframe.cascade-effects:v1";

async function installRewardFixture(page) {
  await page.addInitScript(({ stateKey: key, soundKey: audioKey, effectsKey: fxKey }) => {
    localStorage.setItem(audioKey, "off");
    localStorage.setItem(fxKey, "full");
    localStorage.setItem(key, JSON.stringify({
      level: 5,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 3,
      hammers: 2,
    }));
  }, { stateKey, soundKey, effectsKey });
}

async function stageVictoryChoice(page) {
  await page.evaluate(async () => {
    await window.cascadePresentationDirector.demoWin({
      moves: 7,
      scoreBeforeBonus: 4_250,
      scoreAfterBonus: 4_950,
      stars: 3,
      reward: { claimed: 1 },
    });

    const dialog = document.querySelector("#result-dialog");
    document.querySelector("#result-kicker").textContent = "LEVEL COMPLETE";
    document.querySelector("#result-title").textContent = "Level 5 cleared.";
    document.querySelector("#result-copy").textContent = "★★★ this run · best ★★★ · 700 bonus points from 7 unused moves. Streak: 4. +1 hammer earned.";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "primary";
    button.textContent = "Continue";
    document.querySelector("#result-actions").replaceChildren(button);
    dialog.showModal();
  });
}

async function perceptualDifference(first, second, channelThreshold = 8) {
  const [left, right] = await Promise.all([
    sharp(first).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(second).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  expect(right.info.width).toBe(left.info.width);
  expect(right.info.height).toBe(left.info.height);
  expect(right.info.channels).toBe(left.info.channels);

  const channels = left.info.channels;
  const pixels = left.info.width * left.info.height;
  let changedPixels = 0;
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    const offset = pixel * channels;
    let changed = false;
    for (let channel = 0; channel < Math.min(3, channels); channel += 1) {
      if (Math.abs(left.data[offset + channel] - right.data[offset + channel]) > channelThreshold) {
        changed = true;
        break;
      }
    }
    if (changed) changedPixels += 1;
  }
  return changedPixels / pixels;
}

function panelGeometry(page) {
  return page.locator(".cascade-reward-panel").evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  });
}

test("Cascade reward cash-out stays legible inside a zoomed TV board", async ({ page }) => {
  await mkdir(output, { recursive: true });
  await installRewardFixture(page);

  // Approximate a 1920×1080 television viewed at 200% browser zoom.
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto("/cascade.html");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  await page.evaluate(() => {
    window.__cascadeRewardVisual = window.cascadePresentationDirector.demoWin({
      moves: 7,
      scoreBeforeBonus: 4_250,
      scoreAfterBonus: 4_950,
      stars: 3,
      reward: { claimed: 1 },
    });
  });

  const stage = page.locator(".cascade-reward-stage");
  const panel = page.locator(".cascade-reward-panel");
  await expect(stage).toHaveClass(/is-active/);
  await expect(stage.locator(".cascade-reward-stars i.is-earned")).toHaveCount(3, { timeout: 5_000 });
  await expect(stage.locator("[data-reward-hammer]")).toContainText("hammer earned");
  await expect(stage.locator(".cascade-reward-title")).toHaveText("Crushed it.");
  await expect(stage.locator(".cascade-reward-cashout")).toContainText("UNUSED MOVES");

  const geometry = await page.evaluate(() => {
    const stage = document.querySelector(".cascade-reward-stage")?.getBoundingClientRect();
    const panel = document.querySelector(".cascade-reward-panel")?.getBoundingClientRect();
    const boardWrap = document.querySelector(".cascade-board-wrap")?.getBoundingClientRect();
    if (!stage || !panel || !boardWrap) return null;
    return {
      panelInsideStage: panel.left >= stage.left - 1 && panel.right <= stage.right + 1 && panel.top >= stage.top - 1 && panel.bottom <= stage.bottom + 1,
      stageInsideBoard: stage.left >= boardWrap.left - 1 && stage.right <= boardWrap.right + 1 && stage.top >= boardWrap.top - 1 && stage.bottom <= boardWrap.bottom + 1,
      panelBottom: panel.bottom,
      viewportHeight: window.innerHeight,
    };
  });
  expect(geometry).toBeTruthy();
  expect(geometry.panelInsideStage).toBe(true);
  expect(geometry.stageInsideBoard).toBe(true);
  expect(geometry.panelBottom).toBeLessThanOrEqual(geometry.viewportHeight);

  await page.screenshot({ path: `${output}/cascade-reward-sequence-tv-zoom.png`, fullPage: true });
  await page.evaluate(() => window.__cascadeRewardVisual);
});

test("Cascade victory choice does not flash into a second popup", async ({ page }) => {
  await mkdir(output, { recursive: true });
  await installRewardFixture(page);
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto("/cascade.html");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  await stageVictoryChoice(page);
  await page.addStyleTag({
    content: ".cascade-confetti-layer,.cascade-dopamine-canvas,.cascade-win-bloom{display:none!important}",
  });

  const stage = page.locator(".cascade-reward-stage");
  const panel = stage.locator(".cascade-reward-panel");
  const summary = stage.locator(".cascade-reward-summary");
  const dialog = page.locator("#result-dialog");
  await expect(stage).toHaveClass(/is-awaiting-choice/);
  await expect(dialog).not.toHaveAttribute("open", "");
  await expect(summary).toContainText("★★★ this run");
  expect(await summary.evaluate((node) => getComputedStyle(node).color)).toBe("rgb(107, 67, 152)");

  const initialGeometry = await panelGeometry(page);
  const first = await panel.screenshot({ path: `${output}/cascade-level-complete-choice-initial.png` });
  await page.waitForTimeout(500);
  const second = await panel.screenshot({ path: `${output}/cascade-level-complete-choice-after-500ms.png` });
  const laterGeometry = await panelGeometry(page);

  expect(laterGeometry).toEqual(initialGeometry);
  expect(await perceptualDifference(first, second)).toBeLessThan(0.01);
  await expect(stage).toHaveClass(/is-awaiting-choice/);
  await expect(dialog).not.toHaveAttribute("open", "");
});
