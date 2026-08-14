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
    const card = getComputedStyle(document.querySelector(".cascade-side .cascade-card:nth-child(2)"));
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
    const visibleMapRows = mapRows.filter((node) => getComputedStyle(node).display !== "none");
    const mapRect = document.querySelector("#level-map")?.getBoundingClientRect();
    const firstMapRect = visibleMapRows.at(0)?.getBoundingClientRect();
    const lastMapRect = visibleMapRows.at(-1)?.getBoundingClientRect();
    const statusRows = [...document.querySelectorAll(".cascade-status > div")];
    const shellRect = document.querySelector(".cascade-shell")?.getBoundingClientRect();
    const statusRect = document.querySelector(".cascade-status")?.getBoundingClientRect();
    const movesRect = document.querySelector(".cascade-status > div:nth-child(4)")?.getBoundingClientRect();
    const visibleDescriptions = [...document.querySelectorAll(".cascade-side .cascade-card > span:not(#star-progress)")]
      .filter((node) => getComputedStyle(node).display !== "none").length;
    const weeklyCopy = document.querySelector("[data-weekly-copy]");
    const weeklyStandings = document.querySelector("[data-weekly-leaderboard]");
    const starProgress = document.querySelector("#star-progress");
    const bonusStatus = document.querySelector("#bonus-status");
    const visibleMapCoverage = mapRect && firstMapRect && lastMapRect
      ? (lastMapRect.bottom - firstMapRect.top) / mapRect.height
      : 0;
    return {
      boardGap: Number.parseFloat(board.columnGap),
      tileBorder: Number.parseFloat(tile.borderTopWidth),
      visibleMapRows: visibleMapRows.length,
      visibleMapCoverage,
      visibleStatusRows: statusRows.filter((node) => getComputedStyle(node).display !== "none").length,
      statusHeightRatio: shellRect && statusRect ? statusRect.height / shellRect.height : 1,
      movesAspectRatio: movesRect?.height ? movesRect.width / movesRect.height : 0,
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

  expect(map.x - shell.x).toBeLessThanOrEqual(7);
  expect((shell.x + shell.width) - (status.x + status.width)).toBeLessThanOrEqual(7);
}

async function expectUnifiedRightDock(page) {
  const status = await page.locator(".cascade-status").boundingBox();
  const side = await page.locator(".cascade-side").boundingBox();
  expect(status).toBeTruthy();
  expect(side).toBeTruthy();
  expect(Math.abs(status.x - side.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(status.width - side.width)).toBeLessThanOrEqual(1);
  expect(Math.abs((status.y + status.height) - side.y)).toBeLessThanOrEqual(2);
}

async function expectCompactControlDock(page) {
  const side = await page.locator(".cascade-side").boundingBox();
  const streak = await page.locator(".cascade-side > .cascade-card:nth-child(1)").boundingBox();
  const hammer = await page.locator(".cascade-side > .cascade-card:nth-child(2)").boundingBox();
  const best = await page.locator(".cascade-side > .cascade-card:nth-child(3)").boundingBox();
  const settings = await page.locator("#cascade-feedback-card").boundingBox();
  const blitz = await page.locator("#cascade-weekly-card").boundingBox();
  for (const box of [side, streak, hammer, best, settings, blitz]) expect(box).toBeTruthy();

  // Streak and Best are paired game tokens rather than two full-width menu
  // sections. The booster and lower controls then span the shared dock.
  expect(Math.abs(streak.y - best.y)).toBeLessThanOrEqual(2);
  expect(streak.width).toBeLessThan(side.width * .56);
  expect(best.width).toBeLessThan(side.width * .56);
  expect(hammer.y).toBeGreaterThanOrEqual(streak.y + streak.height - 2);
  expect(hammer.width).toBeGreaterThan(side.width * .82);
  expect(settings.y).toBeGreaterThanOrEqual(hammer.y + hammer.height - 2);
  expect(blitz.y).toBeGreaterThanOrEqual(settings.y + settings.height - 2);
  expect(blitz.y + blitz.height).toBeLessThan(side.y + side.height * .72);
}

async function expectMatch3PlayHierarchy(page, { minMapRows, maxMapRows, minMapCoverage }) {
  const stats = await playHierarchyStats(page);

  expect(stats.boardGap).toBeLessThanOrEqual(4);
  expect(stats.tileBorder).toBeLessThanOrEqual(1.5);
  expect(stats.visibleMapRows).toBeGreaterThanOrEqual(minMapRows);
  expect(stats.visibleMapRows).toBeLessThanOrEqual(maxMapRows);
  expect(stats.visibleMapCoverage).toBeGreaterThan(minMapCoverage);
  expect(stats.visibleStatusRows).toBe(2);
  expect(stats.statusHeightRatio).toBeLessThan(.28);
  expect(stats.movesAspectRatio).toBeGreaterThan(.72);
  expect(stats.movesAspectRatio).toBeLessThan(1.55);
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
  await expectUnifiedRightDock(page);
  await expectCompactControlDock(page);
  await expectMatch3PlayHierarchy(page, { minMapRows: 9, maxMapRows: 11, minMapCoverage: .68 });

  const surfaces = await cabinetSurfaceStats(page);
  expect(surfaces.shellRadius).toBeGreaterThanOrEqual(24);
  expect(surfaces.shellBorder).toBeGreaterThanOrEqual(3);
  expect(surfaces.cardRadius).toBe(0);
  expect(surfaces.cardBorder).toBe(0);
  expect(surfaces.cardShadow).toBe("none");
  expect(surfaces.ordinaryStatusRadius).toBe(0);
  expect(surfaces.ordinaryStatusBorder).toBe(0);
  expect(surfaces.movesStatusRadius).toBeGreaterThanOrEqual(18);

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
  await expectUnifiedRightDock(page);
  await expectCompactControlDock(page);
  await expectMatch3PlayHierarchy(page, { minMapRows: 14, maxMapRows: 17, minMapCoverage: .68 });

  const surfaces = await cabinetSurfaceStats(page);
  expect(surfaces.shellRadius).toBeGreaterThanOrEqual(24);
  expect(surfaces.cardRadius).toBe(0);
  expect(surfaces.ordinaryStatusRadius).toBe(0);
  expect(surfaces.movesStatusRadius).toBeGreaterThanOrEqual(18);

  await page.screenshot({ path: `${output}/cascade-tv-cabinet-wide.png`, fullPage: true });
});
