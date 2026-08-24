import { expect, test } from "@playwright/test";
import sharp from "sharp";

test.use({
  reducedMotion: "no-preference",
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
});
test.setTimeout(45_000);

const BASE_VIEWPORT = { width: 390, height: 844 };
const FRAME_LIMIT = 160;
const BLACK_CHANNEL_MAX = 24;

async function analyzeFrame(buffer, rect) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const scaleX = info.width / BASE_VIEWPORT.width;
  const scaleY = info.height / BASE_VIEWPORT.height;
  const left = Math.max(0, Math.floor(rect.x * scaleX));
  const top = Math.max(0, Math.floor(rect.y * scaleY));
  const right = Math.min(info.width, Math.ceil((rect.x + rect.width) * scaleX));
  const bottom = Math.min(info.height, Math.ceil((rect.y + rect.height) * scaleY));
  let sampled = 0;
  let nearBlack = 0;
  let luminance = 0;
  for (let y = top; y < bottom; y += 3) {
    for (let x = left; x < right; x += 3) {
      const offset = (y * info.width + x) * info.channels;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      sampled += 1;
      if (red <= BLACK_CHANNEL_MAX && green <= BLACK_CHANNEL_MAX && blue <= BLACK_CHANNEL_MAX) nearBlack += 1;
      luminance += red * .2126 + green * .7152 + blue * .0722;
    }
  }
  return {
    blackRatio: sampled ? nearBlack / sampled : 0,
    meanLuminance: sampled ? luminance / sampled : 0,
  };
}

async function runChainedStripes(page) {
  let peakVisiblePopSparks = 0;
  let peakVisibleEffectGroups = 0;
  for (let round = 0; round < 10; round += 1) {
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
    await page.waitForTimeout(45);
    const visible = await page.evaluate(() => {
      const shown = (selector) => [...document.querySelectorAll(selector)]
        .filter((node) => getComputedStyle(node).display !== "none").length;
      return {
        popSparks: shown(".cascade-pop-spark"),
        effectGroups: shown(".cascade-juice-layer > *"),
      };
    });
    peakVisiblePopSparks = Math.max(peakVisiblePopSparks, visible.popSparks);
    peakVisibleEffectGroups = Math.max(peakVisibleEffectGroups, visible.effectGroups);
    await page.waitForTimeout(25);
    await page.setViewportSize({ width: 390, height: round % 2 ? 782 : 744 });
    await page.waitForTimeout(60);
    await page.setViewportSize(BASE_VIEWPORT);
    await page.waitForTimeout(70);
  }
  await page.waitForTimeout(750);
  return { peakVisiblePopSparks, peakVisibleEffectGroups };
}

test("Cascade mobile chained stripes keep full particle spectacle without compositor runaway or black flash", async ({ context, page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem("scribbles-gameframe.cascade-sound:v1", "off");
    localStorage.setItem("scribbles-gameframe.cascade-effects:v1", "full");
  });
  await page.goto("/cascade.html?player=cascade-mobile-compositor-probe");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  const initialTimeOrigin = await page.evaluate(() => performance.timeOrigin);
  const boardRect = await page.locator("#board").boundingBox();
  expect(boardRect).toBeTruthy();
  let pageCrashed = false;
  let unexpectedNavigations = 0;
  page.on("crash", () => { pageCrashed = true; });
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) unexpectedNavigations += 1;
  });

  const cdp = await context.newCDPSession(page);
  const frames = [];
  let maxLayerCount = 0;
  cdp.on("LayerTree.layerTreeDidChange", ({ layers = [] }) => {
    maxLayerCount = Math.max(maxLayerCount, layers.length);
  });
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    if (frames.length < FRAME_LIMIT) frames.push({ data, timestamp: metadata?.timestamp ?? null });
    void cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("LayerTree.enable");
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 82,
    maxWidth: BASE_VIEWPORT.width,
    maxHeight: BASE_VIEWPORT.height,
    everyNthFrame: 1,
  });
  await expect.poll(() => frames.length, { timeout: 4_000 }).toBeGreaterThan(0);
  const baselineBuffer = Buffer.from(frames[0].data, "base64");
  const baseline = await analyzeFrame(baselineBuffer, boardRect);
  frames.length = 0;

  const pressure = await runChainedStripes(page);

  expect(pageCrashed).toBe(false);
  expect(unexpectedNavigations).toBe(0);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(initialTimeOrigin);
  await cdp.send("Page.stopScreencast");
  await cdp.send("LayerTree.disable");

  let blackFrames = 0;
  let worst = null;
  const blackRatioThreshold = Math.max(.36, baseline.blackRatio + .28);
  const luminanceThreshold = baseline.meanLuminance * .42;
  for (let index = 0; index < frames.length; index += 1) {
    const buffer = Buffer.from(frames[index].data, "base64");
    const stats = await analyzeFrame(buffer, boardRect);
    const score = stats.blackRatio * 2 + Math.max(0, (baseline.meanLuminance - stats.meanLuminance) / Math.max(1, baseline.meanLuminance));
    if (!worst || score > worst.score) worst = { index, score, stats, buffer };
    if (stats.blackRatio >= blackRatioThreshold && stats.meanLuminance <= luminanceThreshold) blackFrames += 1;
  }
  if (worst) await sharp(worst.buffer).png().toFile(testInfo.outputPath("cascade-mobile-stripe-worst.png"));

  const result = await page.evaluate(() => {
    const stats = window.cascadePresentationDirector.getStats();
    const lifecycle = window.cascadeLifecycleDiagnostics.snapshot();
    return {
      peakParticles: stats.peakParticles,
      contextLosses: stats.contextLosses,
      canvasDpr: stats.canvasDpr,
      canvasBackingPixels: stats.canvasBackingPixels,
      viewportResizeCount: lifecycle.viewportResizeCount,
      visualViewportResizeCount: lifecycle.visualViewportResizeCount,
    };
  });

  console.log(`CASCADE_MOBILE_COMPOSITOR_PROBE ${JSON.stringify({
    capturedFrames: frames.length,
    blackFrames,
    maxLayerCount,
    ...pressure,
    ...result,
    worst: worst ? worst.stats : null,
  })}`);

  expect(frames.length).toBeGreaterThan(15);
  expect(result.peakParticles).toBe(360);
  expect(result.contextLosses).toBe(0);
  expect(result.viewportResizeCount).toBeGreaterThan(15);
  expect(pressure.peakVisibleEffectGroups).toBeLessThanOrEqual(28);
  expect(pressure.peakVisiblePopSparks).toBeLessThanOrEqual(pressure.peakVisibleEffectGroups * 3);
  expect(maxLayerCount).toBeLessThanOrEqual(150);
  expect(blackFrames).toBe(0);
});
