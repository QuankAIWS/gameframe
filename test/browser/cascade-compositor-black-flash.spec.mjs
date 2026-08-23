import { expect, test } from "@playwright/test";
import sharp from "sharp";

// This test exercises the normal headed/full-motion compositor path. The
// repository-wide Playwright default requests reduced motion, so override it.
test.use({ reducedMotion: "no-preference" });
test.setTimeout(75_000);

const VIEWPORT = { width: 1920, height: 1080 };
const BLACK_CHANNEL_MAX = 24;
const FRAME_LIMIT = 260;
const MAX_VISIBLE_EFFECT_GROUPS = 28;
const MAX_COMPOSITOR_LAYERS = 260;

async function analyzeRegion(buffer, rect) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const scaleX = info.width / VIEWPORT.width;
  const scaleY = info.height / VIEWPORT.height;
  const left = Math.max(0, Math.floor(rect.x * scaleX));
  const top = Math.max(0, Math.floor(rect.y * scaleY));
  const right = Math.min(info.width, Math.ceil((rect.x + rect.width) * scaleX));
  const bottom = Math.min(info.height, Math.ceil((rect.y + rect.height) * scaleY));
  const channels = info.channels;
  let sampled = 0;
  let nearBlack = 0;
  let luminance = 0;

  for (let y = top; y < bottom; y += 4) {
    for (let x = left; x < right; x += 4) {
      const offset = (y * info.width + x) * channels;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      sampled += 1;
      if (red <= BLACK_CHANNEL_MAX && green <= BLACK_CHANNEL_MAX && blue <= BLACK_CHANNEL_MAX) nearBlack += 1;
      luminance += red * .2126 + green * .7152 + blue * .0722;
    }
  }

  return {
    width: info.width,
    height: info.height,
    blackRatio: sampled ? nearBlack / sampled : 0,
    meanLuminance: sampled ? luminance / sampled : 0,
  };
}

async function installRafTelemetry(page) {
  await page.evaluate(() => {
    const samples = [];
    let frame = 0;
    const probe = { running: true, samples };
    window.__cascadeCompositorProbe = probe;

    function tick() {
      if (!probe.running) return;
      frame += 1;
      const director = window.cascadePresentationDirector;
      const stats = director?.getStats?.() || {};
      const canvas = document.querySelector(".cascade-dopamine-canvas");
      const board = document.querySelector("#board");
      const wrap = document.querySelector(".cascade-board-wrap");
      const juice = document.querySelector(".cascade-juice-layer");
      let opaqueBlackCanvasSamples = 0;
      let opaqueCanvasSamples = 0;
      let visibleEffectGroups = 0;

      if (juice) {
        for (const effect of juice.children) {
          if (getComputedStyle(effect).display !== "none") visibleEffectGroups += 1;
        }
      }

      // Sample source pixels from the 2D canvas. If compositor output ever goes
      // black while these stay transparent/colored, the failure is downstream
      // of particle drawing rather than the canvas painting black itself.
      if (frame % 2 === 0 && canvas && board) {
        const context = canvas.getContext("2d", { alpha: true });
        const rect = board.getBoundingClientRect();
        const dpr = Number(stats.canvasDpr) || 1;
        const points = [[.2, .2], [.8, .2], [.5, .5], [.2, .8], [.8, .8]];
        if (context) {
          for (const [xRatio, yRatio] of points) {
            const x = Math.max(0, Math.min(canvas.width - 1, Math.round((rect.left + rect.width * xRatio) * dpr)));
            const y = Math.max(0, Math.min(canvas.height - 1, Math.round((rect.top + rect.height * yRatio) * dpr)));
            const pixel = context.getImageData(x, y, 1, 1).data;
            if (pixel[3] >= 240) {
              opaqueCanvasSamples += 1;
              if (pixel[0] <= 8 && pixel[1] <= 8 && pixel[2] <= 8) opaqueBlackCanvasSamples += 1;
            }
          }
        }
      }

      samples.push({
        t: performance.now(),
        activeParticles: Number(stats.activeParticles) || 0,
        peakParticles: Number(stats.peakParticles) || 0,
        activeDomNodes: Number(stats.activeDomNodes) || 0,
        peakDomNodes: Number(stats.peakDomNodes) || 0,
        contextLosses: Number(stats.contextLosses) || 0,
        opaqueCanvasSamples,
        opaqueBlackCanvasSamples,
        visibleEffectGroups,
        boardOpacity: board ? getComputedStyle(board).opacity : "missing",
        boardVisibility: board ? getComputedStyle(board).visibility : "missing",
        wrapOpacity: wrap ? getComputedStyle(wrap).opacity : "missing",
        wrapVisibility: wrap ? getComputedStyle(wrap).visibility : "missing",
      });
      if (samples.length > 1000) samples.shift();
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  });
}

async function runStackedNuclearStress(page) {
  await page.evaluate(async () => {
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

    // Real cascade phases overlap. Repeat long enough to exercise several
    // generations of effects and give a one-frame renderer failure a chance to
    // surface without inventing a zero-delay synthetic flood.
    for (let round = 0; round < 30; round += 1) {
      window.cascadePresentationDirector.transitionStart(transition);
      window.cascadePresentationDirector.transitionClear(transition);
      await wait(180);
    }
    await wait(900);
  });
}

test("Cascade headed compositor survives stacked nuclear clears without black frame, crash, reload, or layer runaway", async ({ context, page }, testInfo) => {
  await page.setViewportSize(VIEWPORT);
  await page.addInitScript(() => {
    localStorage.setItem("scribbles-gameframe.cascade-sound:v1", "off");
    localStorage.setItem("scribbles-gameframe.cascade-effects:v1", "full");
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, get: () => 2 });
  });
  await page.goto("/cascade.html?player=cascade-black-flash-probe");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(false);

  const initialTimeOrigin = await page.evaluate(() => performance.timeOrigin);
  let pageCrashed = false;
  let unexpectedNavigations = 0;
  page.on("crash", () => {
    pageCrashed = true;
  });
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) unexpectedNavigations += 1;
  });

  const boardRect = await page.locator("#board").boundingBox();
  expect(boardRect).toBeTruthy();
  await installRafTelemetry(page);

  const cdp = await context.newCDPSession(page);
  const screencastFrames = [];
  let maxLayerCount = 0;
  let captureOpen = true;
  cdp.on("LayerTree.layerTreeDidChange", ({ layers = [] }) => {
    maxLayerCount = Math.max(maxLayerCount, layers.length);
  });
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    if (captureOpen && screencastFrames.length < FRAME_LIMIT) {
      screencastFrames.push({ data, timestamp: metadata?.timestamp ?? null });
    }
    void cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("LayerTree.enable");
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 82,
    maxWidth: VIEWPORT.width,
    maxHeight: VIEWPORT.height,
    everyNthFrame: 1,
  });

  await expect.poll(() => screencastFrames.length, { timeout: 4_000 }).toBeGreaterThan(0);
  const baselineBuffer = Buffer.from(screencastFrames[0].data, "base64");
  const baseline = await analyzeRegion(baselineBuffer, boardRect);
  await sharp(baselineBuffer).png().toFile(testInfo.outputPath("cascade-compositor-baseline.png"));
  screencastFrames.length = 0;

  let stressError = null;
  try {
    await runStackedNuclearStress(page);
  } catch (error) {
    stressError = error instanceof Error ? error.message : String(error);
  }

  // A renderer crash or unexpected document navigation can abort page.evaluate.
  // Classify those before attempting any more in-page inspection.
  expect(pageCrashed, `Chrome renderer crashed during Cascade stress${stressError ? `: ${stressError}` : ""}`).toBe(false);
  expect(unexpectedNavigations, `Cascade unexpectedly navigated/reloaded during VFX stress${stressError ? `: ${stressError}` : ""}`).toBe(0);
  expect(stressError, "Cascade stress evaluation aborted without a recorded crash/navigation").toBeNull();
  const currentTimeOrigin = await page.evaluate(() => performance.timeOrigin);
  expect(currentTimeOrigin, "Cascade document was replaced during VFX stress").toBe(initialTimeOrigin);

  captureOpen = false;
  await cdp.send("Page.stopScreencast");
  await cdp.send("LayerTree.disable");
  await page.evaluate(() => {
    if (window.__cascadeCompositorProbe) window.__cascadeCompositorProbe.running = false;
  });

  expect(screencastFrames.length).toBeGreaterThan(20);

  let worst = null;
  let blackFrames = 0;
  const blackRatioThreshold = Math.max(.35, baseline.blackRatio + .28);
  const luminanceThreshold = baseline.meanLuminance * .42;
  for (let index = 0; index < screencastFrames.length; index += 1) {
    const frame = screencastFrames[index];
    const buffer = Buffer.from(frame.data, "base64");
    const stats = await analyzeRegion(buffer, boardRect);
    const score = stats.blackRatio * 2 + Math.max(0, (baseline.meanLuminance - stats.meanLuminance) / Math.max(1, baseline.meanLuminance));
    if (!worst || score > worst.score) worst = { index, score, stats, buffer, timestamp: frame.timestamp };
    if (stats.blackRatio >= blackRatioThreshold && stats.meanLuminance <= luminanceThreshold) blackFrames += 1;
  }

  if (worst) await sharp(worst.buffer).png().toFile(testInfo.outputPath("cascade-compositor-worst.png"));

  const telemetry = await page.evaluate(() => window.__cascadeCompositorProbe?.samples || []);
  const peakDomNodes = telemetry.reduce((max, sample) => Math.max(max, sample.activeDomNodes || 0, sample.peakDomNodes || 0), 0);
  const peakParticles = telemetry.reduce((max, sample) => Math.max(max, sample.activeParticles || 0, sample.peakParticles || 0), 0);
  const peakVisibleEffectGroups = telemetry.reduce((max, sample) => Math.max(max, sample.visibleEffectGroups || 0), 0);
  const maxCanvasBlackSamples = telemetry.reduce((max, sample) => Math.max(max, sample.opaqueBlackCanvasSamples || 0), 0);
  const maxContextLosses = telemetry.reduce((max, sample) => Math.max(max, sample.contextLosses || 0), 0);
  const hiddenBoardSamples = telemetry.filter((sample) => sample.boardOpacity === "0" || sample.boardVisibility !== "visible" || sample.wrapOpacity === "0" || sample.wrapVisibility !== "visible").length;

  const summary = {
    capturedFrames: screencastFrames.length,
    blackFrames,
    baseline,
    worst: worst ? { index: worst.index, timestamp: worst.timestamp, ...worst.stats } : null,
    peakDomNodes,
    peakParticles,
    peakVisibleEffectGroups,
    maxLayerCount,
    maxCanvasBlackSamples,
    maxContextLosses,
    hiddenBoardSamples,
    pageCrashed,
    unexpectedNavigations,
  };
  console.log(`CASCADE_COMPOSITOR_PROBE ${JSON.stringify(summary)}`);

  expect(peakParticles, `Full particle spectacle was not exercised: ${JSON.stringify(summary)}`).toBe(360);
  expect(peakVisibleEffectGroups, `Cascade exceeded its concurrent visible DOM effect-group budget: ${JSON.stringify(summary)}`).toBeLessThanOrEqual(MAX_VISIBLE_EFFECT_GROUPS);
  expect(maxLayerCount, `Cascade compositor layer count ran away: ${JSON.stringify(summary)}`).toBeLessThanOrEqual(MAX_COMPOSITOR_LAYERS);
  expect(maxContextLosses, `Cascade particle canvas lost its context: ${JSON.stringify(summary)}`).toBe(0);
  expect(hiddenBoardSamples, `Cascade board became hidden during stress: ${JSON.stringify(summary)}`).toBe(0);
  expect(blackFrames, `Transient black compositor frames detected: ${JSON.stringify(summary)}`).toBe(0);
});
