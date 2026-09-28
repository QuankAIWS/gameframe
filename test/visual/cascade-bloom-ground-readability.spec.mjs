import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";
const stateKey = "scribbles-gameframe.cascade-state:v1";

async function openLevel(page, level, viewport = { width: 1440, height: 960 }) {
  await mkdir(output, { recursive: true });
  await page.setViewportSize(viewport);
  await page.addInitScript(({ key, targetLevel }) => {
    localStorage.setItem("scribbles-gameframe.cascade-sound:v1", "off");
    localStorage.setItem("scribbles-gameframe.cascade-effects:v1", "full");
    localStorage.setItem(key, JSON.stringify({
      level: targetLevel,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 0,
      hammers: 2,
    }));
  }, { key: stateKey, targetLevel: level });
  await page.goto("/cascade.html");
  await expect(page.locator("#level-number")).toHaveText(String(level));
}

test("Cascade Memory Blooms are large, fixed, and readable on mobile", async ({ page }) => {
  await openLevel(page, 751, { width: 390, height: 844 });
  const blooms = page.locator(".cascade-tile.has-memory-bloom");
  await expect(blooms).toHaveCount(4);
  const geometry = await blooms.first().evaluate((tile) => {
    const tileRect = tile.getBoundingClientRect();
    const markRect = tile.querySelector(".cascade-bloom-mark").getBoundingClientRect();
    return { tileWidth: tileRect.width, markWidth: markRect.width };
  });
  expect(geometry.markWidth).toBeGreaterThan(geometry.tileWidth * .72);
  await page.screenshot({ path: `${output}/cascade-memory-blooms-mobile.png`, fullPage: true });
});

test("Cascade closed Memory Blooms mirror the underlying candy color without leaking pair identity", async ({ page }) => {
  await openLevel(page, 753, { width: 390, height: 844 });
  const blooms = page.locator(".cascade-tile.has-memory-bloom");
  const marks = blooms.locator(".cascade-bloom-mark:not(.is-revealed)");
  await expect(marks).toHaveCount(4);

  await blooms.evaluateAll((nodes) => nodes.forEach((node, index) => {
    node.dataset.kind = String(index);
  }));
  const firstFour = await marks.evaluateAll((nodes) => nodes.map((node) => {
    const tile = node.closest(".cascade-tile");
    const markStyle = getComputedStyle(node);
    const tileStyle = getComputedStyle(tile);
    return {
      text: node.textContent,
      symbol: node.getAttribute("data-bloom-symbol"),
      kind: tile.dataset.kind,
      petal: markStyle.getPropertyValue("--bloom-petal").trim(),
      tileColor: tileStyle.getPropertyValue("--tile").trim(),
      background: markStyle.backgroundImage,
    };
  }));
  expect(firstFour.every((item) => item.text === "✿")).toBe(true);
  expect(firstFour.every((item) => item.symbol === null)).toBe(true);
  expect(firstFour.every((item) => item.petal === item.tileColor)).toBe(true);
  expect(new Set(firstFour.map((item) => item.background)).size).toBe(4);
  await page.screenshot({ path: `${output}/cascade-memory-blooms-piece-colors-0-3-mobile.png`, fullPage: true });

  await blooms.evaluateAll((nodes) => nodes.forEach((node, index) => {
    node.dataset.kind = String(index + 2);
  }));
  const lastFour = await marks.evaluateAll((nodes) => nodes.map((node) => {
    const tile = node.closest(".cascade-tile");
    const markStyle = getComputedStyle(node);
    const tileStyle = getComputedStyle(tile);
    return {
      petal: markStyle.getPropertyValue("--bloom-petal").trim(),
      tileColor: tileStyle.getPropertyValue("--tile").trim(),
      background: markStyle.backgroundImage,
    };
  }));
  expect(lastFour.every((item) => item.petal === item.tileColor)).toBe(true);
  expect(new Set(lastFour.map((item) => item.background)).size).toBe(4);
  await page.screenshot({ path: `${output}/cascade-memory-blooms-piece-colors-2-5-mobile.png`, fullPage: true });
});

test("Cascade open Memory Bloom shows redundant symbol and color", async ({ page }) => {
  await openLevel(page, 751, { width: 390, height: 844 });
  const exported = await page.evaluate(() => window.cascadeResearch.exportLevel());
  const bloomIndex = exported.progress.blooms.symbols.findIndex((symbol) => symbol >= 0);
  expect(bloomIndex).toBeGreaterThanOrEqual(0);

  await page.evaluate((index) => {
    const live = window.cascadeResearch.exportLevel();
    live.progress.blooms.activeIndex = index;
  }, bloomIndex);
  // Reload through the production pagehide persistence path. Mutating only
  // localStorage here is invalid because the runtime correctly commits its
  // live in-memory run during pagehide.
  await page.reload();

  const open = page.locator(".cascade-tile.has-memory-bloom .cascade-bloom-mark.is-revealed");
  await expect(open).toHaveCount(1);
  const cue = await open.evaluate((element) => {
    const tile = element.closest(".cascade-tile");
    const style = getComputedStyle(element);
    const tileStyle = getComputedStyle(tile);
    return {
      text: element.textContent,
      fontSize: Number.parseFloat(style.fontSize),
      petal: style.getPropertyValue("--bloom-petal").trim(),
      tileColor: tileStyle.getPropertyValue("--tile").trim(),
    };
  });
  expect(["♥", "◆", "★", "☾", "✦", "☼"]).toContain(cue.text);
  expect(cue.fontSize).toBeGreaterThanOrEqual(18);
  expect(cue.petal).toBe(cue.tileColor);
  await page.screenshot({ path: `${output}/cascade-memory-bloom-revealed-mobile.png`, fullPage: true });
});

test("Cascade wrong Bloom pair stays open as two distinct flowers until the next Bloom", async ({ page }) => {
  await openLevel(page, 753, { width: 390, height: 844 });
  const exported = await page.evaluate(() => window.cascadeResearch.exportLevel());
  const entries = exported.progress.blooms.symbols
    .map((symbol, index) => ({ symbol, index }))
    .filter(({ symbol }) => symbol >= 0);
  const first = entries[0];
  const second = entries.find(({ symbol }) => symbol !== first.symbol);
  expect(first).toBeTruthy();
  expect(second).toBeTruthy();

  await page.evaluate(({ firstIndex, secondIndex }) => {
    const live = window.cascadeResearch.exportLevel();
    live.progress.blooms.activeIndex = -1;
    live.progress.blooms.mismatchIndices = [firstIndex, secondIndex];
  }, { firstIndex: first.index, secondIndex: second.index });
  await page.reload();

  const openTiles = page.locator(".cascade-tile.is-bloom-mismatch-open");
  await expect(openTiles).toHaveCount(2);
  const marks = openTiles.locator(".cascade-bloom-mark.is-revealed");
  await expect(marks).toHaveCount(2);
  const details = await marks.evaluateAll((nodes) => nodes.map((node) => {
    const style = getComputedStyle(node);
    return {
      text: node.textContent,
      color: style.color,
      background: style.backgroundImage,
      mask: style.maskImage || style.webkitMaskImage,
    };
  }));
  expect(new Set(details.map((item) => item.text)).size).toBe(2);
  expect(new Set(details.map((item) => item.color)).size).toBe(2);
  expect(details.every((item) => item.background.includes("conic-gradient"))).toBe(true);
  expect(details.every((item) => item.mask.includes("svg"))).toBe(true);
  await page.screenshot({ path: `${output}/cascade-memory-bloom-mismatch-persistent-mobile.png`, fullPage: true });
});

test("Cascade Enchanted Ground remains visible beneath candy on desktop and mobile", async ({ page }) => {
  await openLevel(page, 801);
  await expect(page.locator(".cascade-tile.has-enchanted-ground")).toHaveCount(3);
  await page.screenshot({ path: `${output}/cascade-enchanted-ground-desktop.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".cascade-tile.has-enchanted-ground").first()).toBeVisible();
  await page.screenshot({ path: `${output}/cascade-enchanted-ground-mobile.png`, fullPage: true });
});
