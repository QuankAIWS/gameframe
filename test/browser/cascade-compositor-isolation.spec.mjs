import { expect, test } from "@playwright/test";

const VIEWPORT = { width: 1920, height: 1080 };
const ROUNDS = 10;
const PHASE_MS = 180;
const MAX_VISIBLE_EFFECT_GROUPS = 28;
const MAX_GUARDED_LAYERS = 260;
test.setTimeout(90_000);

async function runScenario(browser, name, css = "") {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    reducedMotion: "no-preference",
  });
  await context.addInitScript(() => {
    localStorage.setItem("scribbles-gameframe.cascade-sound:v1", "off");
    localStorage.setItem("scribbles-gameframe.cascade-effects:v1", "full");
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, get: () => 2 });
  });
  const page = await context.newPage();
  await page.goto("/cascade.html?player=cascade-compositor-isolation");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  if (css) await page.addStyleTag({ content: css });

  await page.evaluate(() => {
    window.__cascadeProbeVisiblePeak = 0;
    window.__cascadeProbeVisibleRunning = true;
    const tick = () => {
      if (!window.__cascadeProbeVisibleRunning) return;
      const layer = document.querySelector(".cascade-juice-layer");
      let visible = 0;
      if (layer && getComputedStyle(layer).display !== "none") {
        for (const effect of layer.children) {
          if (getComputedStyle(effect).display !== "none") visible += 1;
        }
      }
      window.__cascadeProbeVisiblePeak = Math.max(window.__cascadeProbeVisiblePeak, visible);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const cdp = await context.newCDPSession(page);
  let maxLayerCount = 0;
  cdp.on("LayerTree.layerTreeDidChange", ({ layers = [] }) => {
    maxLayerCount = Math.max(maxLayerCount, layers.length);
  });
  await cdp.send("LayerTree.enable");

  await page.evaluate(async ({ rounds, phaseMs }) => {
    const matched = Array.from({ length: 64 }, (_, index) => index);
    const triggeredSpecials = [
      ...Array.from({ length: 8 }, (_, index) => ({ index, special: "color" })),
      ...Array.from({ length: 8 }, (_, offset) => ({ index: 8 + offset, special: "bomb" })),
      ...Array.from({ length: 16 }, (_, offset) => ({
        index: 16 + offset,
        special: offset % 2 ? "stripe-v" : "stripe-h",
      })),
    ];
    const transition = {
      combo: "color-bomb",
      cascade: 6,
      matched,
      triggeredSpecials,
      createdSpecials: [],
    };
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    for (let round = 0; round < rounds; round += 1) {
      window.cascadePresentationDirector.transitionStart(transition);
      window.cascadePresentationDirector.transitionClear(transition);
      await wait(phaseMs);
    }
    await wait(800);
  }, { rounds: ROUNDS, phaseMs: PHASE_MS });

  const stats = await page.evaluate(() => {
    window.__cascadeProbeVisibleRunning = false;
    const director = window.cascadePresentationDirector.getStats();
    return {
      peakDomNodes: director.peakDomNodes,
      peakParticles: director.peakParticles,
      contextLosses: director.contextLosses,
      peakVisibleEffectGroups: window.__cascadeProbeVisiblePeak || 0,
      canvasMode: director.canvasMode,
    };
  });

  await cdp.send("LayerTree.disable");
  await context.close();
  return { name, maxLayerCount, ...stats };
}

test("Cascade compositor guard prevents the overlapping nuclear layer explosion", async ({ browser }) => {
  test.skip(process.env.CASCADE_COMPOSITOR_AB !== "1", "Dedicated compositor diagnostic only");

  const guarded = await runScenario(browser, "production-guarded");
  const legacyUncapped = await runScenario(browser, "legacy-uncapped", `
    .cascade-juice-layer > :nth-last-child(n + 29) { display: block !important; }
  `);
  const noDomJuice = await runScenario(browser, "dom-juice-hidden", `
    .cascade-juice-layer,
    .cascade-hype-layer { display: none !important; }
    .cascade-board-wrap::after { display: none !important; }
    .cascade-board-wrap { animation: none !important; }
  `);

  const scenarios = [guarded, legacyUncapped, noDomJuice];
  console.log(`CASCADE_COMPOSITOR_AB ${JSON.stringify(scenarios)}`);

  expect(guarded.peakParticles).toBe(360);
  expect(guarded.peakVisibleEffectGroups).toBeLessThanOrEqual(MAX_VISIBLE_EFFECT_GROUPS);
  expect(guarded.maxLayerCount).toBeLessThanOrEqual(MAX_GUARDED_LAYERS);
  expect(guarded.contextLosses).toBe(0);

  // Re-enable the old behavior and prove the same stress creates the runaway
  // that motivated the guard. This keeps the regression tied to the actual
  // failure mechanism rather than an arbitrary absolute number.
  expect(legacyUncapped.peakParticles).toBe(360);
  expect(legacyUncapped.peakVisibleEffectGroups).toBeGreaterThan(MAX_VISIBLE_EFFECT_GROUPS);
  expect(legacyUncapped.maxLayerCount).toBeGreaterThan(400);
  expect(legacyUncapped.maxLayerCount - guarded.maxLayerCount).toBeGreaterThan(150);
  expect(legacyUncapped.contextLosses).toBe(0);

  expect(noDomJuice.maxLayerCount).toBeLessThan(100);
  expect(noDomJuice.contextLosses).toBe(0);
});
