import { expect, test } from "@playwright/test";

const VIEWPORT = { width: 1920, height: 1080 };
const ROUNDS = 10;
const PHASE_MS = 180;
test.setTimeout(90_000);

async function runScenario(browser, name, { css = "", domBudget = 0 } = {}) {
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

  if (domBudget > 0) {
    await page.evaluate((cap) => {
      const cost = (effect) => 1 + effect.querySelectorAll("*").length;
      const enforce = () => {
        const layer = document.querySelector(".cascade-juice-layer");
        if (!layer) return;
        const children = [...layer.children];
        let total = children.reduce((sum, effect) => sum + cost(effect), 0);
        while (total > cap && children.length) {
          const oldest = children.shift();
          total -= cost(oldest);
          oldest.remove();
        }
        window.__cascadeProbeActualJuicePeak = Math.max(window.__cascadeProbeActualJuicePeak || 0, total);
      };
      new MutationObserver(enforce).observe(document.documentElement, { childList: true, subtree: true });
      window.__cascadeProbeActualJuicePeak = 0;
    }, domBudget);
  }

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
    const director = window.cascadePresentationDirector.getStats();
    const layer = document.querySelector(".cascade-juice-layer");
    const visibleTopLevelEffects = layer ? [...layer.children].filter((effect) => getComputedStyle(effect).display !== "none").length : 0;
    return {
      peakDomNodes: director.peakDomNodes,
      actualJuicePeak: window.__cascadeProbeActualJuicePeak || null,
      visibleTopLevelEffects,
      activeParticles: director.activeParticles,
      peakParticles: director.peakParticles,
      contextLosses: director.contextLosses,
      canvasMode: director.canvasMode,
      canvasStyle: (() => {
        const canvas = document.querySelector(".cascade-dopamine-canvas");
        if (!canvas) return null;
        const style = getComputedStyle(canvas);
        return { display: style.display, mixBlendMode: style.mixBlendMode };
      })(),
      juiceDisplay: layer ? getComputedStyle(layer).display : "missing",
    };
  });

  await cdp.send("LayerTree.disable");
  await context.close();
  return { name, maxLayerCount, ...stats };
}

test("Cascade compositor A/B isolates the source of nuclear layer pressure", async ({ browser }) => {
  test.skip(process.env.CASCADE_COMPOSITOR_AB !== "1", "Dedicated compositor diagnostic only");

  const scenarios = [];
  scenarios.push(await runScenario(browser, "combined"));
  scenarios.push(await runScenario(browser, "particle-hidden", {
    css: `.cascade-dopamine-canvas { display: none !important; }`,
  }));
  scenarios.push(await runScenario(browser, "dom-juice-hidden", {
    css: `
      .cascade-juice-layer,
      .cascade-hype-layer { display: none !important; }
      .cascade-board-wrap::after { display: none !important; }
      .cascade-board-wrap { animation: none !important; }
    `,
  }));
  scenarios.push(await runScenario(browser, "screen-blend-disabled", {
    css: `.cascade-dopamine-canvas { mix-blend-mode: normal !important; }`,
  }));
  scenarios.push(await runScenario(browser, "dom-budget-240", { domBudget: 240 }));
  scenarios.push(await runScenario(browser, "dom-budget-240-normal-blend", {
    domBudget: 240,
    css: `.cascade-dopamine-canvas { mix-blend-mode: normal !important; }`,
  }));
  scenarios.push(await runScenario(browser, "newest-28-effect-groups", {
    css: `.cascade-juice-layer > :nth-last-child(n + 29) { display: none !important; }`,
  }));

  console.log(`CASCADE_COMPOSITOR_AB ${JSON.stringify(scenarios)}`);

  const combined = scenarios.find((scenario) => scenario.name === "combined");
  const noParticles = scenarios.find((scenario) => scenario.name === "particle-hidden");
  const noDom = scenarios.find((scenario) => scenario.name === "dom-juice-hidden");
  const noBlend = scenarios.find((scenario) => scenario.name === "screen-blend-disabled");
  const budgeted = scenarios.find((scenario) => scenario.name === "dom-budget-240");
  const budgetedNormal = scenarios.find((scenario) => scenario.name === "dom-budget-240-normal-blend");
  const newest28 = scenarios.find((scenario) => scenario.name === "newest-28-effect-groups");

  expect(combined.maxLayerCount).toBeGreaterThan(100);
  expect(combined.peakDomNodes).toBeGreaterThan(170);
  expect(noParticles.contextLosses).toBe(0);
  expect(noDom.contextLosses).toBe(0);
  expect(noBlend.contextLosses).toBe(0);
  expect(budgeted.contextLosses).toBe(0);
  expect(budgetedNormal.contextLosses).toBe(0);
  expect(newest28.contextLosses).toBe(0);
});
