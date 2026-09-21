import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";
const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const ACTIVE_RUN_KEY = "scribbles-gameframe.cascade-active-run:v1";
const TUTORIAL_KEY = "scribbles-gameframe.cascade-tutorial:v1";
const LEVEL = 753;
const VIEWPORT = { width: 390, height: 844 };

const PRE_BLOOM_TUTORIALS_SEEN = Object.freeze({
  match: true,
  stripe: true,
  bomb: true,
  combo: true,
  color: true,
  ice: true,
  collect: true,
  "layered-ice": true,
  hammer: true,
  weekly: true,
});

function adjacent(index) {
  const row = Math.floor(index / 8);
  const col = index % 8;
  return [
    row > 0 ? index - 8 : -1,
    row < 7 ? index + 8 : -1,
    col > 0 ? index - 1 : -1,
    col < 7 ? index + 1 : -1,
  ].filter((value) => value >= 0);
}

function triggerSet(cell, blooms) {
  return blooms.filter((index) => index === cell || adjacent(index).includes(cell)).sort((a, b) => a - b);
}

async function openLevel(page) {
  await mkdir(output, { recursive: true });
  await page.setViewportSize(VIEWPORT);
  await page.addInitScript(({ stateKey, tutorialKey, seen, level }) => {
    localStorage.removeItem("scribbles-gameframe.cascade-active-run:v1");
    localStorage.setItem("scribbles-gameframe.cascade-sound:v1", "off");
    localStorage.setItem("scribbles-gameframe.cascade-effects:v1", "full");
    localStorage.setItem(tutorialKey, JSON.stringify({ enabled: true, seen }));
    localStorage.setItem(stateKey, JSON.stringify({
      level,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 0,
      hammers: 2,
    }));
  }, {
    stateKey: STATE_KEY,
    tutorialKey: TUTORIAL_KEY,
    seen: PRE_BLOOM_TUTORIALS_SEEN,
    level: LEVEL,
  });
  await page.goto(`/cascade.html?tutorials=force&player=bloom-full-audit`);
  await expect(page.locator("#level-number")).toHaveText(String(LEVEL));
  await expect(page.locator(".cascade-tile.has-memory-bloom")).toHaveCount(4);
}

async function pairData(page) {
  return page.evaluate(() => {
    const symbols = window.cascadeResearch.exportLevel().progress.blooms.symbols;
    const map = new Map();
    symbols.forEach((symbol, index) => {
      if (symbol < 0) return;
      if (!map.has(symbol)) map.set(symbol, []);
      map.get(symbol).push(index);
    });
    return [...map.entries()]
      .map(([symbol, indices]) => ({ symbol, indices: indices.slice().sort((a, b) => a - b) }))
      .filter((entry) => entry.indices.length === 2)
      .sort((a, b) => a.indices[0] - b.indices[0]);
  });
}

async function saveConfiguredRun(page, config = {}) {
  return page.evaluate(async ({ activeRunKey, config }) => {
    const engine = await import("/cascade-engine.js");
    const special = await import("/cascade-special-engine.js");
    const run = window.cascadeResearch.exportActiveRun();
    const live = window.cascadeResearch.exportLevel();
    const symbols = run.levelProgress.blooms.symbols;
    const groups = new Map();
    symbols.forEach((symbol, index) => {
      if (symbol < 0) return;
      if (!groups.has(symbol)) groups.set(symbol, []);
      groups.get(symbol).push(index);
    });
    const pairs = [...groups.entries()]
      .map(([symbol, indices]) => ({ symbol, indices: indices.slice().sort((a, b) => a - b) }))
      .filter((entry) => entry.indices.length === 2)
      .sort((a, b) => a.indices[0] - b.indices[0]);

    const first = pairs[0];
    const second = pairs[1];

    if (config.removeFirstPair) {
      first.indices.forEach((index) => { run.levelProgress.blooms.symbols[index] = -1; });
      run.levelProgress.blooms.collectedPairs = 1;
    } else {
      run.levelProgress.blooms.collectedPairs = 0;
    }

    if (config.active === "first") run.levelProgress.blooms.activeIndex = first.indices[0];
    else if (config.active === "second") run.levelProgress.blooms.activeIndex = second.indices[0];
    else if (Number.isInteger(config.activeIndex)) run.levelProgress.blooms.activeIndex = config.activeIndex;
    else run.levelProgress.blooms.activeIndex = -1;

    run.levelProgress.blooms.lastEvents = [];
    if (config.scoreComplete) run.score = live.level.target;
    if (Number.isFinite(config.score)) run.score = config.score;

    const target = Number.isInteger(config.hammerTarget) ? config.hammerTarget : null;
    if (target !== null) {
      let found = null;
      for (let seed = 1; seed <= 5000 && !found; seed += 1) {
        const makeRng = engine.createRng(seed);
        const board = engine.createBoard({ rng: makeRng });
        const rngState = makeRng.snapshot();
        const result = special.applySpecialHammer(
          board,
          Array(64).fill(null),
          target,
          engine.createRng(rngState),
          {
            ice: run.levelProgress.ice,
            locks: run.levelProgress.locks,
            rules: {},
          },
        );
        if (result.transitions.length === 1) found = { board, rngState, seed };
      }
      if (!found) throw new Error(`Could not find stable Hammer board for target ${target}`);
      run.board = found.board;
      run.specials = Array(64).fill(null);
      run.rngState = found.rngState;
    }

    localStorage.setItem(activeRunKey, JSON.stringify(run));
    return { pairs, target };
  }, { activeRunKey: ACTIVE_RUN_KEY, config });
}

async function reloadRun(page) {
  await page.reload();
  await expect(page.locator("#level-number")).toHaveText(String(LEVEL));
}

async function hammer(page, index) {
  await page.locator("#booster-hammer").click();
  await page.locator("#board .cascade-tile").nth(index).click();
}

async function screenshot(page, name) {
  await page.screenshot({ path: `${output}/cascade-bloom-full-${name}.png`, fullPage: false });
}

async function configureStableAdjacentReveal(page, bloomIndex) {
  return page.evaluate(async ({ activeRunKey, bloomIndex }) => {
    const engine = await import("/cascade-engine.js");
    const special = await import("/cascade-special-engine.js");
    const run = window.cascadeResearch.exportActiveRun();
    const blooms = run.levelProgress.blooms.symbols
      .flatMap((symbol, index) => symbol >= 0 ? [index] : []);

    const neighbors = (index) => {
      const row = Math.floor(index / 8);
      const col = index % 8;
      return [
        row > 0 ? index - 8 : -1,
        row < 7 ? index + 8 : -1,
        col > 0 ? index - 1 : -1,
        col < 7 ? index + 1 : -1,
      ].filter((value) => value >= 0);
    };
    const touched = (clearIndices) => blooms
      .filter((index) => clearIndices.includes(index) || neighbors(index).some((cell) => clearIndices.includes(cell)))
      .sort((a, b) => a - b);

    for (let seed = 1; seed <= 12000; seed += 1) {
      const makeRng = engine.createRng(seed);
      const board = engine.createBoard({ rng: makeRng });
      const rngState = makeRng.snapshot();
      const moves = engine.listLegalMoves(board, run.levelProgress.locks?.layers || []);
      for (const move of moves) {
        if (move.matched !== 3) continue;
        const result = special.applySpecialSwap(
          board,
          Array(64).fill(null),
          move.from,
          move.to,
          engine.createRng(rngState),
          {
            ice: run.levelProgress.ice,
            locks: run.levelProgress.locks,
            rules: {},
          },
        );
        if (!result.legal || result.transitions.length !== 1) continue;
        const clear = result.transitions[0].matchedForProgress || result.transitions[0].matched || [];
        if (clear.includes(bloomIndex)) continue;
        const triggered = touched(clear);
        if (triggered.length !== 1 || triggered[0] !== bloomIndex) continue;
        run.board = board;
        run.specials = Array(64).fill(null);
        run.rngState = rngState;
        run.levelProgress.blooms.activeIndex = -1;
        run.levelProgress.blooms.collectedPairs = 0;
        run.levelProgress.blooms.lastEvents = [];
        localStorage.setItem(activeRunKey, JSON.stringify(run));
        return { seed, move, clear, triggered };
      }
    }
    throw new Error(`No stable ordinary 3-match adjacent reveal found for Bloom ${bloomIndex}`);
  }, { activeRunKey: ACTIVE_RUN_KEY, bloomIndex });
}

test("Bloom first impression and direct tap behavior", async ({ page }) => {
  await openLevel(page);
  const pairs = await pairData(page);
  expect(pairs).toHaveLength(2);
  console.log("BLOOM_AUDIT pairs", JSON.stringify(pairs));

  await page.waitForTimeout(500);
  await screenshot(page, "01-closed-first-impression");

  const first = pairs[0].indices[0];
  await page.locator("#board .cascade-tile").nth(first).click();
  await expect.poll(async () => page.evaluate(() => window.cascadeResearch.exportLevel().progress.blooms.activeIndex)).toBe(-1);
  await expect(page.locator("#board .cascade-tile").nth(first)).toHaveClass(/is-selected/);
  await screenshot(page, "02-tapping-flower-only-selects-candy");
});

test("ordinary adjacent match opens a Bloom and the open cue survives reload", async ({ page }) => {
  await openLevel(page);
  const pairs = await pairData(page);
  const first = pairs[0].indices[0];
  const setup = await configureStableAdjacentReveal(page, first);
  console.log("BLOOM_AUDIT adjacent reveal", JSON.stringify(setup));
  await reloadRun(page);

  await page.locator("#board .cascade-tile").nth(setup.move.from).click();
  await page.locator("#board .cascade-tile").nth(setup.move.to).click();
  await expect.poll(async () => page.evaluate(() => window.cascadeResearch.exportLevel().progress.blooms.activeIndex)).toBe(first);
  await screenshot(page, "03-adjacent-match-opens-first-bloom");

  await page.reload();
  await expect.poll(async () => page.evaluate(() => window.cascadeResearch.exportLevel().progress.blooms.activeIndex)).toBe(first);
  await screenshot(page, "04-open-bloom-persists-after-reload");
});

test("hitting the already-open Bloom again is a silent no-op", async ({ page }) => {
  await openLevel(page);
  const pairs = await pairData(page);
  const first = pairs[0].indices[0];
  await saveConfiguredRun(page, { active: "first", hammerTarget: first });
  await reloadRun(page);
  await screenshot(page, "05-open-before-same-bloom-rehit");

  await hammer(page, first);
  await page.waitForTimeout(900);
  const state = await page.evaluate(() => ({
    activeIndex: window.cascadeResearch.exportLevel().progress.blooms.activeIndex,
    collectedPairs: window.cascadeResearch.exportLevel().progress.blooms.collectedPairs,
    events: window.cascadeResearch.exportLevel().progress.blooms.lastEvents,
  }));
  console.log("BLOOM_AUDIT same-bloom rehit", JSON.stringify(state));
  expect(state.activeIndex).toBe(first);
  expect(state.collectedPairs).toBe(0);
  expect(state.events).toEqual([]);
  await screenshot(page, "06-same-open-bloom-rehit-no-feedback");
});

test("wrong second Bloom briefly reveals both symbols then closes both", async ({ page }) => {
  await openLevel(page);
  const pairs = await pairData(page);
  const first = pairs[0].indices[0];
  const wrong = pairs[1].indices[0];
  await saveConfiguredRun(page, { active: "first", hammerTarget: wrong });
  await reloadRun(page);
  await screenshot(page, "07-before-mismatch");

  await hammer(page, wrong);
  await expect(page.locator(".cascade-bloom-peek")).toHaveCount(2, { timeout: 2500 });
  await screenshot(page, "08-mismatch-transient-two-symbols");
  await expect(page.locator(".cascade-bloom-peek")).toHaveCount(0, { timeout: 2500 });
  await expect.poll(async () => page.evaluate(() => window.cascadeResearch.exportLevel().progress.blooms.activeIndex)).toBe(-1);
  await screenshot(page, "09-after-mismatch-both-closed");

  console.log("BLOOM_AUDIT mismatch duration contract ms", 620);
});

test("a remembered Bloom can be reopened after a mismatch", async ({ page }) => {
  await openLevel(page);
  const pairs = await pairData(page);
  const first = pairs[0].indices[0];
  await saveConfiguredRun(page, { hammerTarget: first });
  await reloadRun(page);
  await hammer(page, first);
  await expect.poll(async () => page.evaluate(() => window.cascadeResearch.exportLevel().progress.blooms.activeIndex)).toBe(first);
  await screenshot(page, "10-reopen-after-mismatch-equivalent-state");
});

test("correct second Bloom gives transient success then removes the pair", async ({ page }) => {
  await openLevel(page);
  const pairs = await pairData(page);
  const [first, partner] = pairs[0].indices;
  await saveConfiguredRun(page, { active: "first", hammerTarget: partner });
  await reloadRun(page);
  await screenshot(page, "11-before-correct-pair");

  await hammer(page, partner);
  await expect(page.locator(".cascade-bloom-peek.is-success")).toHaveCount(2, { timeout: 2500 });
  await screenshot(page, "12-correct-pair-success-transient");
  await expect(page.locator(".cascade-bloom-peek")).toHaveCount(0, { timeout: 2500 });
  await expect.poll(async () => page.evaluate(() => window.cascadeResearch.exportLevel().progress.blooms.collectedPairs)).toBe(1);
  const after = await page.evaluate(() => window.cascadeResearch.exportLevel().progress.blooms);
  expect(after.symbols[first]).toBe(-1);
  expect(after.symbols[partner]).toBe(-1);
  await screenshot(page, "13-first-pair-removed-one-of-two");
});

test("second pair can be opened and completed; pair completion does not by itself satisfy the score target", async ({ page }) => {
  await openLevel(page);
  const pairs = await pairData(page);
  const [secondFirst, secondPartner] = pairs[1].indices;

  await saveConfiguredRun(page, { removeFirstPair: true, hammerTarget: secondFirst });
  await reloadRun(page);
  await hammer(page, secondFirst);
  await expect.poll(async () => page.evaluate(() => window.cascadeResearch.exportLevel().progress.blooms.activeIndex)).toBe(secondFirst);
  await screenshot(page, "14-second-pair-open-one-of-two-already-collected");

  // Re-seed only to restore one Hammer while preserving the exact Bloom state.
  await saveConfiguredRun(page, { removeFirstPair: true, active: "second", hammerTarget: secondPartner });
  await reloadRun(page);
  await hammer(page, secondPartner);
  await expect(page.locator(".cascade-bloom-peek.is-success")).toHaveCount(2, { timeout: 2500 });
  await screenshot(page, "15-second-pair-success-transient");
  await expect(page.locator(".cascade-bloom-peek")).toHaveCount(0, { timeout: 2500 });
  await expect.poll(async () => page.evaluate(() => window.cascadeResearch.exportLevel().progress.blooms.collectedPairs)).toBe(2);
  await expect(page.locator("#objective-label")).toContainText("blooms 2/2 pairs");
  await screenshot(page, "16-all-bloom-pairs-done-score-still-required");
});

test("finishing the final pair wins when the score target is already satisfied", async ({ page }) => {
  await openLevel(page);
  const pairs = await pairData(page);
  const partner = pairs[1].indices[1];
  await saveConfiguredRun(page, {
    removeFirstPair: true,
    active: "second",
    hammerTarget: partner,
    scoreComplete: true,
  });
  await reloadRun(page);
  await hammer(page, partner);
  await expect(page.locator("#result-dialog")).toBeVisible({ timeout: 5000 });
  await screenshot(page, "17-final-pair-with-score-complete-level-clear");
});

test("ambiguous clear can be swallowed by the already-open lower-index Bloom", async ({ page }) => {
  await openLevel(page);
  const pairs = await pairData(page);
  const blooms = pairs.flatMap((pair) => pair.indices).sort((a, b) => a - b);

  let ambiguity = null;
  for (let cell = 0; cell < 64 && !ambiguity; cell += 1) {
    const triggered = triggerSet(cell, blooms);
    if (triggered.length < 2) continue;
    const active = triggered[0];
    const other = triggered.find((index) => index !== active);
    if (!Number.isInteger(other)) continue;
    ambiguity = { cell, triggered, active, other };
  }

  console.log("BLOOM_AUDIT ambiguous trigger geometry", JSON.stringify(ambiguity));
  expect(ambiguity).not.toBeNull();

  const livePairs = pairs;
  await saveConfiguredRun(page, { activeIndex: ambiguity.active, hammerTarget: ambiguity.cell });
  await reloadRun(page);
  await screenshot(page, "18-ambiguous-clear-before");

  await hammer(page, ambiguity.cell);
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => ({
    activeIndex: window.cascadeResearch.exportLevel().progress.blooms.activeIndex,
    collectedPairs: window.cascadeResearch.exportLevel().progress.blooms.collectedPairs,
    events: window.cascadeResearch.exportLevel().progress.blooms.lastEvents,
  }));
  console.log("BLOOM_AUDIT ambiguous trigger result", JSON.stringify({ ambiguity, after, livePairs }));
  expect(after.activeIndex).toBe(ambiguity.active);
  expect(after.events).toEqual([]);
  await screenshot(page, "19-ambiguous-clear-after-swallowed-no-op");
});

test("engine audit reports whether one player move can advance multiple Bloom interactions through cascades", async ({ page }) => {
  await openLevel(page);
  const result = await page.evaluate(async () => {
    const engine = await import("/cascade-engine.js");
    const special = await import("/cascade-special-engine.js");
    const live = window.cascadeResearch.exportLevel();
    const base = live.progress.blooms;
    const blooms = base.symbols.flatMap((symbol, index) => symbol >= 0 ? [index] : []);
    const neighbors = (index) => {
      const row = Math.floor(index / 8);
      const col = index % 8;
      return [
        row > 0 ? index - 8 : -1,
        row < 7 ? index + 8 : -1,
        col > 0 ? index - 1 : -1,
        col < 7 ? index + 1 : -1,
      ].filter((value) => value >= 0);
    };
    const touched = (clear) => blooms.filter((index) => clear.includes(index) || neighbors(index).some((cell) => clear.includes(cell))).sort((a, b) => a - b);

    for (let seed = 1; seed <= 4000; seed += 1) {
      const makeRng = engine.createRng(seed);
      const board = engine.createBoard({ rng: makeRng });
      const rngState = makeRng.snapshot();
      for (const move of engine.listLegalMoves(board)) {
        const resolved = special.applySpecialSwap(
          board,
          Array(64).fill(null),
          move.from,
          move.to,
          engine.createRng(rngState),
          { ice: live.progress.ice, locks: live.progress.locks, rules: {} },
        );
        if (!resolved.legal || resolved.transitions.length < 2) continue;
        let progress = {
          totalPairs: base.totalPairs,
          collectedPairs: 0,
          activeIndex: -1,
          symbols: base.symbols.slice(),
          lastEvents: [],
        };
        const sequence = [];
        for (const transition of resolved.transitions) {
          const clear = transition.matchedForProgress || transition.matched || [];
          const beforeActive = progress.activeIndex;
          progress = engine.advanceBloomProgress(progress, clear);
          if (progress.lastEvents.length) {
            sequence.push({
              cascade: transition.cascade,
              clear,
              touched: touched(clear),
              beforeActive,
              events: progress.lastEvents,
              afterActive: progress.activeIndex,
              collectedPairs: progress.collectedPairs,
            });
          }
        }
        if (sequence.length >= 2) {
          return {
            found: true,
            seed,
            move,
            transitionCount: resolved.transitions.length,
            sequence,
            final: {
              activeIndex: progress.activeIndex,
              collectedPairs: progress.collectedPairs,
            },
          };
        }
      }
    }
    return { found: false };
  });

  console.log("BLOOM_AUDIT multi-interaction single-move search", JSON.stringify(result));
  // This is diagnostic rather than a desired-behavior assertion. If found,
  // one player move can advance the Bloom state more than once via cascades.
  expect(typeof result.found).toBe("boolean");
});


test("closed Blooms visibly leak hidden pair identity through computed glyph color", async ({ page }) => {
  await openLevel(page);
  const closed = await page.locator(".cascade-tile.has-memory-bloom .cascade-bloom-mark").evaluateAll((marks) =>
    marks.map((mark) => ({
      symbol: Number(mark.dataset.bloomSymbol),
      text: mark.textContent,
      color: getComputedStyle(mark).color,
    })),
  );
  console.log("BLOOM_AUDIT closed hidden-color leak", JSON.stringify(closed));
  expect(closed).toHaveLength(4);
  expect(closed.every((item) => item.text === "✿")).toBe(true);

  const bySymbol = new Map();
  for (const item of closed) {
    if (!bySymbol.has(item.symbol)) bySymbol.set(item.symbol, new Set());
    bySymbol.get(item.symbol).add(item.color);
  }
  expect(bySymbol.size).toBe(2);
  expect([...bySymbol.values()].every((colors) => colors.size === 1)).toBe(true);
  expect(new Set(closed.map((item) => item.color)).size).toBeGreaterThan(1);

  await screenshot(page, "20-closed-blooms-hidden-pairs-already-color-coded");

  const blooms = page.locator(".cascade-tile.has-memory-bloom");
  for (let index = 0; index < await blooms.count(); index += 1) {
    const tile = blooms.nth(index);
    const symbol = await tile.locator(".cascade-bloom-mark").getAttribute("data-bloom-symbol");
    await tile.screenshot({ path: `${output}/cascade-bloom-full-20a-closed-${index + 1}-hidden-symbol-${symbol}.png` });
  }
});

test("all six revealed Bloom symbols are visually audited at mobile tile size", async ({ page }) => {
  await openLevel(page);
  const pairs = await pairData(page);
  const index = pairs[0].indices[0];

  for (let symbol = 0; symbol < 6; symbol += 1) {
    await page.evaluate(({ activeRunKey, index, symbol }) => {
      const run = window.cascadeResearch.exportActiveRun();
      run.levelProgress.blooms.symbols[index] = symbol;
      run.levelProgress.blooms.activeIndex = index;
      localStorage.setItem(activeRunKey, JSON.stringify(run));
    }, { activeRunKey: ACTIVE_RUN_KEY, index, symbol });
    await reloadRun(page);

    const mark = page.locator(`#board .cascade-tile[data-index="${index}"] .cascade-bloom-mark.is-revealed`);
    await expect(mark).toBeVisible();
    const detail = await mark.evaluate((node) => ({
      text: node.textContent,
      color: getComputedStyle(node).color,
      fontSize: getComputedStyle(node).fontSize,
    }));
    console.log("BLOOM_AUDIT revealed symbol", symbol, JSON.stringify(detail));
    await page.locator(`#board .cascade-tile[data-index="${index}"]`).screenshot({
      path: `${output}/cascade-bloom-full-21-revealed-symbol-${symbol}.png`,
    });
  }
});
