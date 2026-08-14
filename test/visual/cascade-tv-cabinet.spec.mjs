import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";
const stateKey = "scribbles-gameframe.cascade-state:v1";
const soundKey = "scribbles-gameframe.cascade-sound:v1";
const effectsKey = "scribbles-gameframe.cascade-effects:v1";

async function prepare(page) {
  await mkdir(output, { recursive: true });
  await page.addInitScript(({ stateKey: key, soundKey: audioKey, effectsKey: fxKey }) => {
    localStorage.setItem(audioKey, "off");
    localStorage.setItem(fxKey, "full");
    localStorage.setItem(key, JSON.stringify({
      level: 58,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 4,
      hammers: 2,
    }));
  }, { stateKey, soundKey, effectsKey });
}

async function cabinetSurfaceStats(page) {
  return page.evaluate(() => {
    const shell = getComputedStyle(document.querySelector(".cascade-shell"));
    const card = getComputedStyle(document.querySelector(".cascade-side .cascade-card"));
    const ordinaryStatus = getComputedStyle(document.querySelector(".cascade-status > div:first-child"));
    const movesStatus = getComputedStyle(document.querySelector(".cascade-status > div:nth-child(4)"));
    const side = getComputedStyle(document.querySelector(".cascade-side"));
    return {
      shellRadius: Number.parseFloat(shell.borderTopLeftRadius),
      shellBorder: Number.parseFloat(shell.borderTopWidth),
      cardRadius: Number.parseFloat(card.borderTopLeftRadius),
      cardBorder: Number.parseFloat(card.borderTopWidth),
      cardShadow: card.boxShadow,
      ordinaryStatusRadius: Number.parseFloat(ordinaryStatus.borderTopLeftRadius),
      ordinaryStatusBorder: Number.parseFloat(ordinaryStatus.borderTopWidth),
      movesStatusRadius: Number.parseFloat(movesStatus.borderTopLeftRadius),
      sideGap: side.rowGap,
    };
  });
}

async function playHierarchyStats(page) {
  return page.evaluate(() => {
    const board = getComputedStyle(document.querySelector("#board"));
    const tile = getComputedStyle(document.querySelector(".cascade-tile"));
    const mapRows = [...document.querySelectorAll("#level-map > li")];
    const statusRows = [...document.querySelectorAll(".cascade-status > div")];
    const visibleDescriptions = [...document.querySelectorAll(".cascade-side .cascade-card > span:not(#star-progress)")]
      .filter((node) => getComputedStyle(node).display !== "none").length;
    const weeklyCopy = document.querySelector("[data-weekly-copy]");
    const weeklyStandings = document.querySelector("[data-weekly-leaderboard]");
    const starProgress = document.querySelector("#star-progress");
    const bonusStatus = document.querySelector("#bonus-status");
    return {
      boardGap: Number.parseFloat(board.columnGap),
      tileBorder: Number.parseFloat(tile.borderTopWidth),
      visibleMapRows: mapRows.filter((node) => getComputedStyle(node).display !== "none").length,
      visibleStatusRows: statusRows.filter((node) => getComputedStyle(node).display !== "none").length,
      visibleDescriptions,
      weeklyCopyDisplay: weeklyCopy ? getComputedStyle(weeklyCopy).display : "missing",
      weeklyStandingsDisplay: weeklyStandings ? getComputedStyle(weeklyStandings).display : "missing",
      starProgressDisplay: starProgress ? getComputedStyle(starProgress).display : "missing",
      bonusStatusDisplay: bonusStatus ? getComputedStyle(bonusStatus).display : "missing",
    };
  });
}

async function expectCabinetHugsInstrumentBanks(page) {
  const shell = await page.locator(".cascade-shell").boundingBox();
  const map = await page.locator(".cascade-map").boundingBox();
  const status = await page.locator(".cascade-status").boundingBox();
  expect(shell).toBeTruthy();
  expect(map).toBeTruthy();
  expect(status).toBeTruthy();

  // The outer chassis should wrap its left/right instrument banks instead of
  // stretching into large decorative slabs beside the actual game controls.
  expect(map.x - shell.x).toBeLessThanOrEqual(7);
  expect((shell.x + shell.width) - (status.x + status.width)).toBeLessThanOrEqual(7);
}

async function expectMatch3PlayHierarchy(page) {
  const stats = await playHierarchyStats(page);

  // Mature match-3 play screens keep the board dense and put meta systems in
  // the periphery. Guard against drifting back toward a 30-row dashboard and
  // 64 individually outlined UI buttons.
  expect(stats.boardGap).toBeLessThanOrEqual(4);
  expect(stats.tileBorder).toBeLessThanOrEqual(1.5);
  expect(stats.visibleMapRows).toBeGreaterThanOrEqual(4);
  expect(stats.visibleMapRows).toBeLessThanOrEqual(6);
  expect(stats.visibleStatusRows).toBe(2);
  expect(stats.visibleDescriptions).toBe(0);
  expect(stats.weeklyCopyDisplay).toBe("none");
  expect(stats.weeklyStandingsDisplay).toBe("none");
  expect(stats.starProgressDisplay).toBe("none");
  expect(stats.bonusStatusDisplay).toBe("none");
}

test("Cascade pastel cabinet uses television width while keeping the board height-first", async ({ page }) => {
  await prepare(page);
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto("/cascade.html");

  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  await expect(page.locator(".cascade-map")).toBeVisible();
  await expect(page.locator(".cascade-side")).toBeVisible();
  await expect(page.locator(".cascade-status")).toBeVisible();
  await expect(page.locator("#moves")).toBeVisible();
  await expect(page.locator("#lives")).toBeVisible();

  const board = await page.locator("#board").boundingBox();
  expect(board).toBeTruthy();
  expect(board.y + board.height).toBeLessThanOrEqual(540);
  expect(board.width).toBeGreaterThan(350);
  await expectCabinetHugsInstrumentBanks(page);
  await expectMatch3PlayHierarchy(page);

  const surfaces = await cabinetSurfaceStats(page);
  expect(surfaces.shellRadius).toBeGreaterThanOrEqual(24);
  expect(surfaces.shellBorder).toBeGreaterThanOrEqual(3);
  expect(surfaces.cardRadius).toBe(0);
  expect(surfaces.cardBorder).toBe(0);
  expect(surfaces.cardShadow).toBe("none");
  expect(surfaces.ordinaryStatusRadius).toBe(0);
  expect(surfaces.ordinaryStatusBorder).toBe(0);
  expect(surfaces.movesStatusRadius).toBeGreaterThanOrEqual(20);
  expect(surfaces.sideGap).toBe("0px");

  await page.screenshot({ path: `${output}/cascade-tv-cabinet-zoom.png`, fullPage: true });
});

test("Cascade pastel cabinet remains composed on a wide desktop television viewport", async ({ page }) => {
  await prepare(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/cascade.html");

  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  const board = await page.locator("#board").boundingBox();
  const map = await page.locator(".cascade-map").boundingBox();
  const status = await page.locator(".cascade-status").boundingBox();
  expect(board).toBeTruthy();
  expect(map).toBeTruthy();
  expect(status).toBeTruthy();
  expect(map.x + map.width).toBeLessThan(board.x);
  expect(board.x + board.width).toBeLessThan(status.x);
  await expectCabinetHugsInstrumentBanks(page);
  await expectMatch3PlayHierarchy(page);

  const surfaces = await cabinetSurfaceStats(page);
  expect(surfaces.shellRadius).toBeGreaterThanOrEqual(24);
  expect(surfaces.cardRadius).toBe(0);
  expect(surfaces.ordinaryStatusRadius).toBe(0);
  expect(surfaces.movesStatusRadius).toBeGreaterThanOrEqual(20);

  await page.screenshot({ path: `${output}/cascade-tv-cabinet-wide.png`, fullPage: true });
});