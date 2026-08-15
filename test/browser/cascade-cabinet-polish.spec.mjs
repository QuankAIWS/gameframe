import { expect, test } from "@playwright/test";

const stateKey = "scribbles-gameframe.cascade-state:v1";

async function openCabinet(page, viewport) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({
      level: 36,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 4,
      hammers: 2,
    }));
  }, stateKey);
  await page.setViewportSize(viewport);
  await page.goto("/cascade.html?player=cascade-cabinet-polish-test");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  await expect(page.locator("#cascade-feedback-card")).toBeVisible();
  await expect(page.locator("[data-weekly-start]")).toBeVisible();
}

function centerY(box) {
  return box.y + (box.height / 2);
}

test("Cascade keeps readable rails and mechanically centered controls at TV zoom", async ({ page }) => {
  await openCabinet(page, { width: 960, height: 540 });

  const header = page.locator(".cascade-header");
  const status = page.locator(".cascade-status");
  const board = page.locator(".cascade-board");
  const lives = page.locator("#lives");
  const lifeSlots = page.locator("#lives > .cascade-life-heart");
  const settings = page.locator(".cascade-feedback-controls button");
  const hammer = page.locator("#booster-hammer");
  const hammerCount = page.locator("#hammer-count");
  const blitz = page.locator("[data-weekly-start]");
  const blitzClock = blitz.locator("b");

  const [headerBox, statusBox, boardBox, livesBox] = await Promise.all([
    header.boundingBox(),
    status.boundingBox(),
    board.boundingBox(),
    lives.boundingBox(),
  ]);
  for (const box of [headerBox, statusBox, boardBox, livesBox]) expect(box).toBeTruthy();

  expect(headerBox.width).toBeGreaterThanOrEqual(155);
  expect(statusBox.width).toBeGreaterThanOrEqual(225);
  expect(boardBox.width).toBeGreaterThan(350);

  await expect(lifeSlots).toHaveCount(5);
  for (const slot of await lifeSlots.all()) {
    const box = await slot.boundingBox();
    expect(box).toBeTruthy();
    expect(box.width).toBeGreaterThanOrEqual(19.5);
    expect(box.height).toBeGreaterThanOrEqual(19.5);
    expect(box.x).toBeGreaterThanOrEqual(livesBox.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(livesBox.x + livesBox.width + 1);
  }

  await expect(settings).toHaveCount(3);
  for (const button of await settings.all()) {
    const box = await button.boundingBox();
    expect(box).toBeTruthy();
    expect(box.width).toBeGreaterThanOrEqual(39.5);
    expect(box.height).toBeGreaterThanOrEqual(39.5);
    expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1);
    const icon = await button.evaluate((node) => {
      const style = getComputedStyle(node, "::before");
      return {
        width: Number.parseFloat(style.width),
        height: Number.parseFloat(style.height),
        mask: style.webkitMaskImage || style.maskImage,
      };
    });
    expect(icon.width).toBeGreaterThanOrEqual(19.5);
    expect(icon.height).toBeGreaterThanOrEqual(19.5);
    expect(icon.mask).not.toBe("none");
  }

  const [hammerBox, hammerCountBox, blitzBox, blitzClockBox] = await Promise.all([
    hammer.boundingBox(),
    hammerCount.boundingBox(),
    blitz.boundingBox(),
    blitzClock.boundingBox(),
  ]);
  for (const box of [hammerBox, hammerCountBox, blitzBox, blitzClockBox]) expect(box).toBeTruthy();
  expect(Math.abs(centerY(hammerBox) - centerY(hammerCountBox))).toBeLessThanOrEqual(2);
  expect(Math.abs(centerY(blitzBox) - centerY(blitzClockBox))).toBeLessThanOrEqual(2);

  const hammerTextCenterDelta = await hammer.evaluate((button) => {
    const textNode = [...button.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    if (!textNode) return Number.POSITIVE_INFINITY;
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const textRect = range.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    return Math.abs((textRect.top + textRect.height / 2) - (buttonRect.top + buttonRect.height / 2));
  });
  expect(hammerTextCenterDelta).toBeLessThanOrEqual(3);
});

test("Cascade spends roomy 16:9 width on the cabinet without shrinking the board", async ({ page }) => {
  await openCabinet(page, { width: 2560, height: 1440 });

  const header = page.locator(".cascade-header");
  const title = page.locator(".cascade-header h1");
  const status = page.locator(".cascade-status");
  const utility = page.locator(".cascade-side");
  const board = page.locator(".cascade-board");
  const feedback = page.locator("#cascade-feedback-card");
  const weekly = page.locator(".cascade-weekly-card");

  const [headerBox, titleBox, statusBox, utilityBox, boardBox, feedbackBox, weeklyBox] = await Promise.all([
    header.boundingBox(),
    title.boundingBox(),
    status.boundingBox(),
    utility.boundingBox(),
    board.boundingBox(),
    feedback.boundingBox(),
    weekly.boundingBox(),
  ]);
  for (const box of [headerBox, titleBox, statusBox, utilityBox, boardBox, feedbackBox, weeklyBox]) expect(box).toBeTruthy();

  expect(headerBox.width).toBeGreaterThanOrEqual(188);
  expect(headerBox.width).toBeLessThanOrEqual(192);
  expect(statusBox.width).toBeGreaterThanOrEqual(278);
  expect(statusBox.width).toBeLessThanOrEqual(282);
  expect(Math.abs(statusBox.width - utilityBox.width)).toBeLessThanOrEqual(1);
  expect(boardBox.width).toBeGreaterThanOrEqual(758);

  // The title must remain clear of the illuminated edge treatment.
  expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(headerBox.x + headerBox.width - 24);

  // Settings live in the flexible middle region while Blitz deliberately
  // anchors the bottom of the utility rail instead of leaving dead space below.
  expect(feedbackBox.y + feedbackBox.height).toBeLessThan(weeklyBox.y);
  expect(Math.abs((weeklyBox.y + weeklyBox.height) - (utilityBox.y + utilityBox.height))).toBeLessThanOrEqual(16);
});

test("Cascade short landscape keeps the utility dock usable and effects state visible", async ({ page }) => {
  await openCabinet(page, { width: 800, height: 450 });

  const utility = page.locator(".cascade-side");
  const weekly = page.locator(".cascade-weekly-card");
  const blitz = page.locator("[data-weekly-start]");
  const settings = page.locator(".cascade-feedback-controls button");
  const effects = page.locator("#cascade-effects-toggle");

  const [utilityBox, weeklyBox, blitzBox] = await Promise.all([
    utility.boundingBox(),
    weekly.boundingBox(),
    blitz.boundingBox(),
  ]);
  for (const box of [utilityBox, weeklyBox, blitzBox]) expect(box).toBeTruthy();

  expect(weeklyBox.y + weeklyBox.height).toBeLessThanOrEqual(utilityBox.y + utilityBox.height + 1);
  expect(blitzBox.y + blitzBox.height).toBeLessThanOrEqual(450);

  await expect(settings).toHaveCount(3);
  for (const button of await settings.all()) {
    const box = await button.boundingBox();
    expect(box).toBeTruthy();
    expect(box.width).toBeGreaterThanOrEqual(39.5);
    expect(box.height).toBeGreaterThanOrEqual(39.5);
    expect(box.y).toBeGreaterThanOrEqual(utilityBox.y - 1);
    expect(box.y + box.height).toBeLessThanOrEqual(utilityBox.y + utilityBox.height + 1);
  }

  const initialPressed = await effects.getAttribute("aria-pressed");
  expect(["true", "false"]).toContain(initialPressed);
  const initialMask = await effects.evaluate((node) => {
    const style = getComputedStyle(node, "::before");
    return style.webkitMaskImage || style.maskImage;
  });

  await effects.click();
  const nextPressed = initialPressed === "true" ? "false" : "true";
  await expect(effects).toHaveAttribute("aria-pressed", nextPressed);
  const nextMask = await effects.evaluate((node) => {
    const style = getComputedStyle(node, "::before");
    return style.webkitMaskImage || style.maskImage;
  });
  expect(nextMask).not.toBe(initialMask);
});
