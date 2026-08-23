import { expect, test } from "@playwright/test";
import sharp from "sharp";

// This test is specifically about full-effects rendering. The repository-wide
// Playwright default requests reduced motion, so override it explicitly here.
test.use({ reducedMotion: "no-preference" });
test.setTimeout(60_000);

const VIEWPORT = { width: 1920, height: 1080 };
const BLACK_CHANNEL_MAX = 24;
const FRAME_LIMIT = 220;

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

  // Subsample the board heavily enough to keep the stress probe cheap while
  // still detecting a large transient black backing/compositor frame.
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
      let opaqueBlackCanvasSamples = 0;
      let opaqueCanvasSamples = 0;

      // Read only five backing-store pixels every other rAF. If the 2D canvas
      // itself turns into an opaque-black source, this catches it. If the CDP
      // screencast goes black while these remain transparent/colored, the fault
      // is downstream in browser composition rather than particle drawing.
      if (frame % 2 === 0 && canvas && board) {
        const context = canvas.getContext("2d", { alpha: true });
        const rect = board.getBoundingClientRect();
        const dpr = Number(stats.canvasDpr) || 1;
        const points = [
          [.2, .2], [.8, .2], [.5, .5], [.2, .8], [.8, .8],
        ];
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
        activeDomNodes: Number(stats.activeDomNodes) || 0,
        peakDomNodes: Number(stats.peakDomNodes) || 0,
        contextLosses: Number(stats.contextLosses) || 0,
        opaqueCanvasSamples,
        opaqueBlackCanvasSamples,
        boardOpacity: board ? getComputedStyle(board).opacity : "missing",
        boardVisibility: board ? getComputedStyle(board).visibility : "missing",
        wrapOpacity: wrap ? getComputedStyle(wrap).opacity : "missing",
        wrapVisibility: wrap ? getComputedStyle(wrap).visibility : "missing",
      });
      if (samples.length > 720) samples.shift();
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

    // Real cascade phases can arrive while the previous 560-760 ms DOM effects
    // are still alive. Five 180 ms phases exercise that overlap without inventing
    // a zero-delay synthetic flood.
    for (let round = 0; round < 5; round += 1) {
      window.cascadePresentationDirector.transitionStart(transition);
      window.cascadePresentationDirector.transitionClear(transition);
      await wait(180);
    }
    await wait(900);
  });
}

test("Cascade compositor probe catches transient black frames during stacked nuclear clears", async ({ context, page }, testInfo) => {
  await page.setViewportSize(VIEWPORT);
  await page.addInitScript(() => {
    localStorage.setItem("scribbles-gameframe.cascade-sound:v1", "off");
    localStorage.setItem("scribbles-gameframe.cascade-effects:v1", "full");
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, get: () => 2 });
  });
  await page.goto("/cascade.html?player=cascade-black-flash-probe");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(false);

  const boardRect = await page.locator("#board").boundingBox();
  expect(boardRect).toBeTruthy();
  const baselineBuffer = await page.screenshot({ fullPage: false });
  const baseline = await analyzeRegion(baselineBuffer, boardRect);
  await sharp(baselineBuffer).png().toFile(testInfo.outputPath("cascade-compositor-baseline.png"));

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

  await runStackedNuclearStress(page);

  captureOpen = false;
  await cdp.send("Page.stopScreencast");
  await cdp.send("LayerTree.disable");
  await page.evaluate(() => {
    if (window.__cascadeCompositorProbe) window.__cascadeCompositorProbe.running = false;
  });

  expect(screencastFrames.length).toBeGreaterThan(10);

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
  const maxCanvasBlackSamples = telemetry.reduce((max, sample) => Math.max(max, sample.opaqueBlackCanvasSamples || 0), 0);
  const maxContextLosses = telemetry.reduce((max, sample) => Math.max(max, sample.contextLosses || 0), 0);
  const hiddenBoardSamples = telemetry.filter((sample) => sample.boardOpacity === "0" || sample.boardVisibility !== "visible" || sample.wrapOpacity === "0" || sample.wrapVisibility !== "visible").length;

  const summary = {
    capturedFrames: screencastFrames.length,
    blackFrames,
    baseline,
    worst: worst ? { index: worst.index, timestamp: worst.timestamp, ...worst.stats } : null,
    peakDomNodes,
    maxLayerCount,
    maxCanvasBlackSamples,
    maxContextLosses,
    hiddenBoardSamples,
  };
  console.log(`CASCADE_COMPOSITOR_PROBE ${JSON.stringify(summary)}`);

  // This is the actual visual failure detector: it judges compositor output,
  // not DOM visibility. Keep the pressure diagnostics in the assertion message
  // so a caught black frame also tells us whether source canvas/DOM state failed.
  expect(blackFrames, `Transient black compositor frames detected: ${JSON.stringify(summary)}`).toBe(0);
});
