import { expect, test } from "@playwright/test";

test.use({
  reducedMotion: "no-preference",
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
});
test.setTimeout(70_000);

const BASE_VIEWPORT = { width: 390, height: 844 };

async function emitStripePhase(page, round) {
  await page.evaluate((roundIndex) => {
    const transition = {
      combo: null,
      cascade: 2 + (roundIndex % 3),
      matched: [8, 9, 10, 16, 17, 18, 24, 25, 26],
      triggeredSpecials: [
        { index: 9, special: "stripe-h" },
        { index: 17, special: "stripe-v" },
        { index: 25, special: "stripe-h" },
      ],
      createdSpecials: [],
    };
    window.cascadePresentationDirector.transitionStart(transition);
    window.cascadePresentationDirector.transitionClear(transition);
  }, round);
}

async function runStress(page, { pulseViewport }) {
  for (let round = 0; round < 8; round += 1) {
    await emitStripePhase(page, round);
    await page.waitForTimeout(70);
    if (pulseViewport) {
      await page.setViewportSize({ width: 390, height: round % 2 ? 782 : 744 });
      await page.waitForTimeout(60);
      await page.setViewportSize(BASE_VIEWPORT);
      await page.waitForTimeout(70);
    } else {
      await page.waitForTimeout(130);
    }
  }
  await page.waitForTimeout(650);
}

async function loadCase(page, mode) {
  await page.setViewportSize(BASE_VIEWPORT);
  await page.goto(`/cascade.html?player=cascade-mobile-isolation-${mode}`);
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  const styles = {
    "dom-hidden": ".cascade-juice-layer { display: none !important; }",
    "canvas-hidden": ".cascade-dopamine-canvas { display: none !important; }",
    "pop-sparks-hidden": ".cascade-pop-spark { display: none !important; }",
    "pop-bursts-hidden": ".cascade-pop-burst { display: none !important; }",
    "stripe-beams-hidden": ".cascade-stripe-beam { display: none !important; }",
  };
  if (styles[mode]) await page.addStyleTag({ content: styles[mode] });
}

test("Cascade mobile compositor isolation identifies the expensive DOM effect class", async ({ context, page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("scribbles-gameframe.cascade-sound:v1", "off");
    localStorage.setItem("scribbles-gameframe.cascade-effects:v1", "full");
  });

  const cdp = await context.newCDPSession(page);
  let activeCase = null;
  const maxLayers = new Map();
  cdp.on("LayerTree.layerTreeDidChange", ({ layers = [] }) => {
    if (!activeCase) return;
    maxLayers.set(activeCase, Math.max(maxLayers.get(activeCase) || 0, layers.length));
  });
  await cdp.send("LayerTree.enable");

  const cases = [
    { name: "fixed-viewport", mode: "full", pulseViewport: false },
    { name: "changing-viewport", mode: "full", pulseViewport: true },
    { name: "changing-viewport-dom-hidden", mode: "dom-hidden", pulseViewport: true },
    { name: "changing-viewport-canvas-hidden", mode: "canvas-hidden", pulseViewport: true },
    { name: "changing-viewport-pop-sparks-hidden", mode: "pop-sparks-hidden", pulseViewport: true },
    { name: "changing-viewport-pop-bursts-hidden", mode: "pop-bursts-hidden", pulseViewport: true },
    { name: "changing-viewport-stripe-beams-hidden", mode: "stripe-beams-hidden", pulseViewport: true },
  ];
  const results = [];
  for (const candidate of cases) {
    await loadCase(page, candidate.mode);
    activeCase = candidate.name;
    maxLayers.set(activeCase, 0);
    await runStress(page, { pulseViewport: candidate.pulseViewport });
    activeCase = null;
    const stats = await page.evaluate(() => {
      const vfx = window.cascadePresentationDirector.getStats();
      const lifecycle = window.cascadeLifecycleDiagnostics.snapshot();
      return {
        peakParticles: vfx.peakParticles,
        contextLosses: vfx.contextLosses,
        viewportResizeCount: lifecycle.viewportResizeCount,
        visualViewportResizeCount: lifecycle.visualViewportResizeCount,
      };
    });
    results.push({ name: candidate.name, maxLayerCount: maxLayers.get(candidate.name) || 0, ...stats });
  }
  await cdp.send("LayerTree.disable");

  console.log(`CASCADE_MOBILE_COMPOSITOR_AB ${JSON.stringify(results)}`);
  const byName = Object.fromEntries(results.map((result) => [result.name, result]));
  expect(results.every((result) => result.contextLosses === 0)).toBe(true);
  expect(results.every((result) => result.peakParticles === 360)).toBe(true);
  expect(byName["changing-viewport"].viewportResizeCount).toBeGreaterThan(10);
  expect(byName["fixed-viewport"].viewportResizeCount).toBeLessThan(byName["changing-viewport"].viewportResizeCount);
  expect(byName["changing-viewport-dom-hidden"].maxLayerCount).toBeLessThan(byName["changing-viewport"].maxLayerCount);
  expect(byName["changing-viewport-pop-bursts-hidden"].maxLayerCount).toBeLessThan(byName["changing-viewport"].maxLayerCount);
});
