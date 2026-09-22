import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";
const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const ACTIVE_RUN_KEY = "scribbles-gameframe.cascade-active-run:v1";
const TUTORIAL_KEY = "scribbles-gameframe.cascade-tutorial:v1";
const RULES = Object.freeze({ stripe: true, bomb: true, color: true, fish: true });
let configSerial = 0;

const ALL_TUTORIALS_SEEN = Object.freeze({
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
  "memory-bloom": true,
});

async function openLevel753(page) {
  await mkdir(output, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(({ stateKey, tutorialKey, seen }) => {
    localStorage.removeItem("scribbles-gameframe.cascade-active-run:v1");
    localStorage.setItem("scribbles-gameframe.cascade-sound:v1", "off");
    localStorage.setItem("scribbles-gameframe.cascade-effects:v1", "full");
    localStorage.setItem(tutorialKey, JSON.stringify({ enabled: true, seen }));
    localStorage.setItem(stateKey, JSON.stringify({
      level: 753,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 0,
      hammers: 2,
    }));
  }, { stateKey: STATE_KEY, tutorialKey: TUTORIAL_KEY, seen: ALL_TUTORIALS_SEEN });
  await page.goto("/cascade.html?player=bloom-flow-review");
  await expect(page.locator("#level-number")).toHaveText("753");
  await expect(page.locator(".cascade-tile.has-memory-bloom")).toHaveCount(4);
}

async function bloomPairs(page) {
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

async function reloadWithConfiguredRun(page, run, state) {
  const marker = `bloom-flow-config-${configSerial += 1}`;
  await page.addInitScript(({ activeRunKey, stateKey, runValue, stateValue, markerKey }) => {
    if (sessionStorage.getItem(markerKey) === "applied") return;
    sessionStorage.setItem(markerKey, "applied");
    localStorage.setItem(activeRunKey, JSON.stringify(runValue));
    localStorage.setItem(stateKey, JSON.stringify(stateValue));
  }, {
    activeRunKey: ACTIVE_RUN_KEY,
    stateKey: STATE_KEY,
    runValue: run,
    stateValue: state,
    markerKey: marker,
  });
  await page.reload();
  await expect(page.locator("#level-number")).toHaveText("753");
}

async function configureHammerState(page, {
  activeIndex = -1,
  collectedPairs = 0,
  removedIndices = [],
  score = null,
  hammerTarget,
}) {
  const configured = await page.evaluate(async ({ activeRunKey, stateKey, activeIndex, collectedPairs, removedIndices, score, hammerTarget, rules }) => {
    const engine = await import("/cascade-engine.js");
    const special = await import("/cascade-special-engine.js");
    const run = window.cascadeResearch.exportActiveRun();
    for (const index of removedIndices) run.levelProgress.blooms.symbols[index] = -1;
    run.levelProgress.blooms.activeIndex = activeIndex;
    run.levelProgress.blooms.collectedPairs = collectedPairs;
    run.levelProgress.blooms.lastEvents = [];
    if (Number.isFinite(score)) run.score = score;

    let stable = null;
    for (let seed = 1; seed <= 6000 && !stable; seed += 1) {
      const makeRng = engine.createRng(seed);
      const board = engine.createBoard({ rng: makeRng, rules });
      const rngState = makeRng.snapshot();
      const resolved = special.applySpecialHammer(
        board,
        Array(64).fill(null),
        hammerTarget,
        engine.createRng(rngState),
        {
          ice: run.levelProgress.ice,
          locks: run.levelProgress.locks,
          rules,
          targetKinds: [],
          targetIndices: [],
        },
      );
      if (resolved.transitions.length === 1) stable = { board, rngState };
    }
    if (!stable) throw new Error(`No stable Hammer board found for ${hammerTarget}`);

    run.board = stable.board;
    run.specials = Array(64).fill(null);
    run.rngState = stable.rngState;

    const state = JSON.parse(localStorage.getItem(stateKey) || "{}");
    state.hammers = 2;
    return { run, state };
  }, { activeRunKey: ACTIVE_RUN_KEY, stateKey: STATE_KEY, activeIndex, collectedPairs, removedIndices, score, hammerTarget, rules: RULES });
  await reloadWithConfiguredRun(page, configured.run, configured.state);
}

async function hammer(page, index) {
  await page.locator("#booster-hammer").click();
  await page.locator("#board .cascade-tile").nth(index).click();
}

async function shot(page, name) {
  await page.screenshot({ path: `${output}/cascade-bloom-flow-${name}.png`, fullPage: false });
}

test("Bloom flow 01 closed board keeps the rule visible without leaking pairs", async ({ page }) => {
  await openLevel753(page);
  await expect(page.locator("#objective-label")).toContainText("clear on/beside ✿");
  await expect(page.locator(".cascade-bloom-mark[data-bloom-symbol]")).toHaveCount(0);
  await shot(page, "01-closed");
});

test("Bloom flow 02 reveal and repeat-hit communicate a stable open flower", async ({ page }) => {
  await openLevel753(page);
  const pairs = await bloomPairs(page);
  const first = pairs[0].indices[0];

  await configureHammerState(page, { hammerTarget: first });
  await hammer(page, first);
  await expect.poll(async () => page.evaluate(() => window.cascadeResearch.exportLevel().progress.blooms.activeIndex)).toBe(first);
  await expect(page.locator(".cascade-bloom-mark.is-revealed")).toHaveCount(1);
  await shot(page, "02-revealed");

  await configureHammerState(page, { activeIndex: first, hammerTarget: first });
  await hammer(page, first);
  await expect(page.locator("#combo-label")).toContainText("THIS BLOOM IS OPEN");
  await expect.poll(async () => page.evaluate(() => window.cascadeResearch.exportLevel().progress.blooms.activeIndex)).toBe(first);
  await shot(page, "03-repeat-hit");
});

test("Bloom flow 03 wrong pair shows both long enough, then closes both", async ({ page }) => {
  await openLevel753(page);
  const pairs = await bloomPairs(page);
  const first = pairs[0].indices[0];
  const wrong = pairs[1].indices[0];

  await configureHammerState(page, { activeIndex: first, hammerTarget: wrong });
  await hammer(page, wrong);
  await expect(page.locator(".cascade-bloom-peek")).toHaveCount(2, { timeout: 2500 });
  await expect(page.locator("#combo-label")).toContainText("NOT A MATCH");
  await shot(page, "04-mismatch-two-symbols");

  await expect(page.locator(".cascade-bloom-peek")).toHaveCount(0, { timeout: 3500 });
  await expect.poll(async () => page.evaluate(() => window.cascadeResearch.exportLevel().progress.blooms.activeIndex)).toBe(-1);
  await shot(page, "05-mismatch-closed-again");
});

test("Bloom flow 04 direct hit beats the adjacent lower-index open Bloom", async ({ page }) => {
  await openLevel753(page);
  const pairs = await bloomPairs(page);
  const blooms = pairs.flatMap((pair) => pair.indices);
  const active = 29;
  const target = 37;
  expect(blooms).toContain(active);
  expect(blooms).toContain(target);

  await configureHammerState(page, { activeIndex: active, hammerTarget: target });
  await hammer(page, target);
  await expect(page.locator(".cascade-bloom-peek")).toHaveCount(2, { timeout: 2500 });
  await expect(page.locator("#combo-label")).toContainText("NOT A MATCH");
  await shot(page, "06-direct-hit-beats-adjacent-open-bloom");
});

test("Bloom flow 05 matching symbols collect exactly one pair", async ({ page }) => {
  await openLevel753(page);
  const pairs = await bloomPairs(page);
  const [first, partner] = pairs[0].indices;

  await configureHammerState(page, { activeIndex: first, hammerTarget: partner });
  await hammer(page, partner);
  await expect(page.locator(".cascade-bloom-peek.is-success")).toHaveCount(2, { timeout: 2500 });
  await expect(page.locator("#combo-label")).toContainText("BLOOM PAIR");
  await shot(page, "07-correct-pair-success");

  await expect(page.locator(".cascade-bloom-peek")).toHaveCount(0, { timeout: 3000 });
  await expect.poll(async () => page.evaluate(() => window.cascadeResearch.exportLevel().progress.blooms.collectedPairs)).toBe(1);
  await expect(page.locator("#objective-label")).toContainText("blooms 1/2 pairs");
  await shot(page, "08-first-pair-removed");
});

test("Bloom flow 06 one cascading move can advance Blooms only once", async ({ page }) => {
  await openLevel753(page);
  const configured = await page.evaluate(async ({ activeRunKey, stateKey, rules }) => {
    const engine = await import("/cascade-engine.js");
    const special = await import("/cascade-special-engine.js");
    const run = window.cascadeResearch.exportActiveRun();
    const initialBlooms = run.levelProgress.blooms;

    for (let seed = 1; seed <= 5000; seed += 1) {
      const makeRng = engine.createRng(seed);
      const board = engine.createBoard({ rng: makeRng, rules });
      const rngState = makeRng.snapshot();
      for (const move of engine.listLegalMoves(board, run.levelProgress.locks?.layers || [])) {
        const resolved = special.applySpecialSwap(
          board,
          Array(64).fill(null),
          move.from,
          move.to,
          engine.createRng(rngState),
          {
            ice: run.levelProgress.ice,
            locks: run.levelProgress.locks,
            rules,
            targetKinds: [],
            targetIndices: [],
          },
        );
        if (!resolved.legal || resolved.transitions.length < 2) continue;

        let theoretical = {
          totalPairs: initialBlooms.totalPairs,
          collectedPairs: 0,
          activeIndex: -1,
          symbols: initialBlooms.symbols.slice(),
          lastEvents: [],
        };
        const events = [];
        for (const transition of resolved.transitions) {
          const clear = transition.matchedForProgress || transition.matched || [];
          theoretical = engine.advanceBloomProgress(theoretical, clear);
          if (theoretical.lastEvents.length) {
            events.push({
              cascade: transition.cascade,
              event: theoretical.lastEvents[0],
              activeIndex: theoretical.activeIndex,
              collectedPairs: theoretical.collectedPairs,
            });
          }
        }
        if (events.length < 2) continue;

        run.board = board;
        run.specials = Array(64).fill(null);
        run.rngState = rngState;
        run.levelProgress.blooms.activeIndex = -1;
        run.levelProgress.blooms.collectedPairs = 0;
        run.levelProgress.blooms.lastEvents = [];
        const state = JSON.parse(localStorage.getItem(stateKey) || "{}");
        state.hammers = 2;
        return { run, state, setup: { seed, move, transitionCount: resolved.transitions.length, events } };
      }
    }
    throw new Error("No deterministic multi-Bloom cascade candidate found");
  }, { activeRunKey: ACTIVE_RUN_KEY, stateKey: STATE_KEY, rules: RULES });

  await reloadWithConfiguredRun(page, configured.run, configured.state);
  const setup = configured.setup;
  await page.locator("#board .cascade-tile").nth(setup.move.from).click();
  await page.locator("#board .cascade-tile").nth(setup.move.to).click();

  const expected = setup.events[0];
  await expect.poll(async () => page.evaluate(() => {
    const bloom = window.cascadeResearch.exportLevel().progress.blooms;
    return { activeIndex: bloom.activeIndex, collectedPairs: bloom.collectedPairs };
  })).toEqual({ activeIndex: expected.activeIndex, collectedPairs: expected.collectedPairs });

  const actual = await page.evaluate(() => window.cascadeResearch.exportLevel().progress.blooms);
  expect(actual.lastEvents).toHaveLength(1);
  expect(actual.lastEvents[0].type).toBe(expected.event.type);
  expect(actual.lastEvents[0].index).toBe(expected.event.index);
  await shot(page, "09-multi-cascade-stops-after-first-bloom");
});

test("Bloom flow 07 all pairs can finish while score remains a separate requirement", async ({ page }) => {
  await openLevel753(page);
  const pairs = await bloomPairs(page);
  const removed = pairs[0].indices;
  const [second, partner] = pairs[1].indices;

  await configureHammerState(page, { activeIndex: second, collectedPairs: 1, removedIndices: removed, hammerTarget: partner });
  await hammer(page, partner);
  await expect(page.locator(".cascade-bloom-peek.is-success")).toHaveCount(2, { timeout: 2500 });
  await shot(page, "10-final-pair-success");
  await expect(page.locator(".cascade-bloom-peek")).toHaveCount(0, { timeout: 3000 });
  await expect(page.locator("#objective-label")).toContainText("blooms 2/2 pairs");
  await expect(page.locator("#result-dialog")).toBeHidden();
  await shot(page, "11-all-pairs-done-score-still-required");
});

test("Bloom flow 08 final pair clears the level when score is already satisfied", async ({ page }) => {
  await openLevel753(page);
  const exported = await page.evaluate(() => window.cascadeResearch.exportLevel());
  const pairs = await bloomPairs(page);
  const removed = pairs[0].indices;
  const [second, partner] = pairs[1].indices;

  await configureHammerState(page, {
    activeIndex: second,
    collectedPairs: 1,
    removedIndices: removed,
    score: exported.level.target,
    hammerTarget: partner,
  });
  await hammer(page, partner);
  const rewardStage = page.locator(".cascade-reward-stage");
  await expect(rewardStage).toHaveClass(/is-active/, { timeout: 5000 });
  await shot(page, "12-level-clear-reward");
  await expect(page.locator("#result-dialog")).toBeVisible({ timeout: 12000 });
  await expect(page.locator("#result-title")).toContainText("Level 753 cleared");
  await shot(page, "13-level-clear-actions");
});
