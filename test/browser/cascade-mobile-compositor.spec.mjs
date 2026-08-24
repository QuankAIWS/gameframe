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
const REGION_SELECTORS = {
  board: "#board",
  nav: "#gameframe-destination-bar",
  status: ".cascade-status",
  objective: ".cascade-objective",
  controls: ".cascade-side",
  menu: "#cascade-mobile-menu-toggle",
};

async function decodeFrame(buffer) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, info };
}

function analyzeDecodedFrame(decoded, rect) {
  const { data, info } = decoded;
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

async function regionRects(page) {
  return page.evaluate((selectors) => Object.fromEntries(Object.entries(selectors).map(([name, selector]) => {
    const node = document.querySelector(selector);
    if (!node) return [name, null];
    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height) return [name, null];
    return [name, { x: rect.x, y: rect.y, width: rect.width, height: rect.height }];
  })), REGION_SELECTORS);
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

test("Cascade mobile chained stripes keep the board and UI chrome stable without compositor runaway or black flash", async ({ context, page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem("scribbles-gameframe.cascade-sound:v1", "off");
    localStorage.setItem("scribbles-gameframe.cascade-effects:v1", "full");
  });
  await page.goto("/cascade.html?player=cascade-mobile-compositor-probe");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  await expect(page.locator("#gameframe-destination-bar")).toBeVisible();
  await expect(page.locator("#cascade-mobile-menu-toggle")).toBeVisible();

  const initialTimeOrigin = await page.evaluate(() => performance.timeOrigin);
  const rects = await regionRects(page);
  for (const [name, rect] of Object.entries(rects)) expect(rect, `${name} compositor region should be visible`).toBeTruthy();
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
  const baselineDecoded = await decodeFrame(Buffer.from(frames[0].data, "base64"));
  const baselineByRegion = Object.fromEntries(Object.entries(rects).map(([name, rect]) => [name, analyzeDecodedFrame(baselineDecoded, rect)]));
  frames.length = 0;

  const pressure = await runChainedStripes(page);

  expect(pageCrashed).toBe(false);
  expect(unexpectedNavigations).toBe(0);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(initialTimeOrigin);
  await cdp.send("Page.stopScreencast");
  await cdp.send("LayerTree.disable");

  const blackFramesByRegion = Object.fromEntries(Object.keys(rects).map((name) => [name, 0]));
  let worst = null;
  for (let index = 0; index < frames.length; index += 1) {
    const buffer = Buffer.from(frames[index].data, "base64");
    const decoded = await decodeFrame(buffer);
    for (const [name, rect] of Object.entries(rects)) {
      const baseline = baselineByRegion[name];
      const stats = analyzeDecodedFrame(decoded, rect);
      const blackRatioThreshold = Math.max(.36, baseline.blackRatio + .28);
      const luminanceThreshold = baseline.meanLuminance * .42;
      const score = stats.blackRatio * 2 + Math.max(0, (baseline.meanLuminance - stats.meanLuminance) / Math.max(1, baseline.meanLuminance));
      if (!worst || score > worst.score) worst = { index, name, score, stats, buffer };
      if (stats.blackRatio >= blackRatioThreshold && stats.meanLuminance <= luminanceThreshold) blackFramesByRegion[name] += 1;
    }
  }
  if (worst) await sharp(worst.buffer).png().toFile(testInfo.outputPath(`cascade-mobile-${worst.name}-worst.png`));

  const result = await page.evaluate(() => {
    const stats = window.cascadePresentationDirector.getStats();
    const lifecycle = window.cascadeLifecycleDiagnostics.snapshot();
    const nav = document.querySelector("#gameframe-destination-bar");
    const mark = document.querySelector("#gameframe-destination-bar .gameframe-destination-mark");
    return {
      peakParticles: stats.peakParticles,
      contextLosses: stats.contextLosses,
      canvasDpr: stats.canvasDpr,
      canvasBackingPixels: stats.canvasBackingPixels,
      viewportResizeCount: lifecycle.viewportResizeCount,
      visualViewportResizeCount: lifecycle.visualViewportResizeCount,
      navBackdropFilter: nav ? getComputedStyle(nav).backdropFilter : null,
      navMarkFilter: mark ? getComputedStyle(mark).filter : null,
      navMarkTransform: mark ? getComputedStyle(mark).transform : null,
    };
  });

  console.log(`CASCADE_MOBILE_COMPOSITOR_PROBE ${JSON.stringify({
    capturedFrames: frames.length,
    blackFramesByRegion,
    maxLayerCount,
    ...pressure,
    ...result,
    worst: worst ? { region: worst.name, ...worst.stats } : null,
  })}`);

  expect(frames.length).toBeGreaterThan(15);
  expect(result.peakParticles).toBe(360);
  expect(result.contextLosses).toBe(0);
  expect(result.viewportResizeCount).toBeGreaterThan(15);
  expect(pressure.peakVisibleEffectGroups).toBeLessThanOrEqual(28);
  expect(pressure.peakVisiblePopSparks).toBeLessThanOrEqual(pressure.peakVisibleEffectGroups * 3);
  expect(result.navBackdropFilter).toBe("none");
  expect(result.navMarkFilter).toBe("none");
  expect(result.navMarkTransform).toBe("none");
  expect(maxLayerCount).toBeLessThanOrEqual(150);
  for (const [name, blackFrames] of Object.entries(blackFramesByRegion)) {
    expect(blackFrames, `${name} should not emit a near-black compositor frame`).toBe(0);
  }
});
