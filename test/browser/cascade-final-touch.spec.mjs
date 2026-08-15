import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const output = "visual-results/player-ui-review";
const stateKey = "scribbles-gameframe.cascade-state:v1";

async function openCascade(page, viewport = { width: 960, height: 540 }) {
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
  await page.goto("/cascade.html?player=cascade-final-touch-test");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  await expect(page.locator("#cascade-feedback-card")).toBeVisible();
  await expect(page.locator("[data-weekly-start]")).toBeVisible();
}

test("Cascade final touch enlarges utility labels, centers icons, and removes candy glare", async ({ page }) => {
  await openCascade(page);

  const hammer = page.locator("#booster-hammer");
  const blitz = page.locator("[data-weekly-start]");
  const settings = page.locator(".cascade-feedback-controls button");

  const hammerFont = await hammer.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
  const blitzFont = await blitz.evaluate((node) => Number.parseFloat(getComputedStyle(node, "::before").fontSize));
  expect(hammerFont).toBeGreaterThanOrEqual(15.5);
  expect(blitzFont).toBeGreaterThanOrEqual(15.5);

  await expect(settings).toHaveCount(3);
  for (const button of await settings.all()) {
    const box = await button.boundingBox();
    expect(box).toBeTruthy();
    expect(box.width).toBeGreaterThanOrEqual(45.5);
    expect(box.height).toBeGreaterThanOrEqual(45.5);
    const icon = await button.evaluate((node) => {
      const style = getComputedStyle(node, "::before");
      return {
        position: style.position,
        width: Number.parseFloat(style.width),
        height: Number.parseFloat(style.height),
        transform: style.transform,
        mask: style.webkitMaskImage || style.maskImage,
      };
    });
    expect(icon.position).toBe("absolute");
    expect(icon.width).toBeGreaterThanOrEqual(22.5);
    expect(icon.height).toBeGreaterThanOrEqual(22.5);
    expect(icon.transform).not.toBe("none");
    expect(icon.mask).not.toBe("none");
  }

  const candyBackground = await page.locator(".cascade-tile").first().evaluate((node) => getComputedStyle(node).backgroundImage);
  expect(candyBackground).toContain("linear-gradient");
  expect(candyBackground).not.toContain("radial-gradient");

  mkdirSync(output, { recursive: true });
  await page.screenshot({ path: `${output}/cascade-final-touch-controls.png`, fullPage: true });
});

test("Cascade settings circles stay inside a narrow tall utility rail", async ({ page }) => {
  await openCascade(page, { width: 960, height: 640 });

  const rail = await page.locator(".cascade-side").boundingBox();
  expect(rail).toBeTruthy();
  const buttons = page.locator(".cascade-feedback-controls button");
  await expect(buttons).toHaveCount(3);

  for (const button of await buttons.all()) {
    const box = await button.boundingBox();
    expect(box).toBeTruthy();
    expect(box.left).toBeGreaterThanOrEqual(rail.left - 0.5);
    expect(box.left + box.width).toBeLessThanOrEqual(rail.left + rail.width + 0.5);
    expect(box.width).toBeGreaterThanOrEqual(40);
    expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1);
  }
});

test("Cascade result-dialog polish leaves tutorial dialog surfaces intact", async ({ page }) => {
  await openCascade(page);

  const tutorialSurface = await page.evaluate(() => {
    const dialog = document.createElement("dialog");
    dialog.className = "cascade-dialog cascade-tutorial-dialog";
    dialog.innerHTML = `
      <section class="cascade-tutorial-card">
        <small>TIP</small>
        <h2>Tutorial surface</h2>
        <p>This should keep the tutorial dialog's own opaque surface.</p>
      </section>
    `;
    document.body.append(dialog);
    const style = getComputedStyle(dialog);
    return {
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
    };
  });

  expect(tutorialSurface.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(tutorialSurface.backgroundColor).not.toBe("transparent");
});

test("Cascade completion handoff keeps the reward panel visual language", async ({ page }) => {
  await openCascade(page);

  await page.evaluate(() => {
    window.__cascadeFinalTouchReward = window.cascadePresentationDirector.demoWin({
      moves: 4,
      scoreBeforeBonus: 1200,
      scoreAfterBonus: 1600,
      stars: 3,
      reward: { claimed: 1 },
    });
  });

  const rewardStage = page.locator(".cascade-reward-stage");
  await expect(rewardStage).toHaveClass(/is-active/);
  const rewardPanel = rewardStage.locator(".cascade-reward-panel");
  const rewardSurface = await rewardPanel.evaluate((node) => ({
    backgroundImage: getComputedStyle(node).backgroundImage,
    radius: Number.parseFloat(getComputedStyle(node).borderRadius),
  }));

  await page.evaluate(() => window.__cascadeFinalTouchReward);
  await expect(rewardStage).not.toHaveClass(/is-active/);

  await page.evaluate(() => {
    const dialog = document.querySelector("#result-dialog");
    document.querySelector("#result-kicker").textContent = "LEVEL COMPLETE";
    document.querySelector("#result-title").textContent = "Level 36 cleared.";
    document.querySelector("#result-copy").textContent = "★★★ this run · 400 bonus points · streak 4.";
    const actions = document.querySelector("#result-actions");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "primary";
    button.textContent = "Continue";
    actions.replaceChildren(button);
    if (!dialog.open) dialog.showModal();
  });

  const dialog = page.locator("#result-dialog");
  await expect(dialog).toBeVisible();
  const dialogForm = dialog.locator("form");
  await dialogForm.evaluate(async (node) => {
    await Promise.all(node.getAnimations().map((animation) => animation.finished.catch(() => {})));
  });
  const dialogSurface = await dialogForm.evaluate((node) => ({
    backgroundImage: getComputedStyle(node).backgroundImage,
    radius: Number.parseFloat(getComputedStyle(node).borderRadius),
  }));
  expect(dialogSurface.backgroundImage).toContain("linear-gradient");
  expect(dialogSurface.backgroundImage).toContain("radial-gradient");
  expect(Math.abs(dialogSurface.radius - rewardSurface.radius)).toBeLessThanOrEqual(14);

  const primary = page.locator("#result-actions button.primary");
  const primaryStyle = await primary.evaluate((node) => ({
    height: node.getBoundingClientRect().height,
    backgroundImage: getComputedStyle(node).backgroundImage,
    radius: Number.parseFloat(getComputedStyle(node).borderRadius),
  }));
  expect(primaryStyle.height).toBeGreaterThanOrEqual(51.5);
  expect(primaryStyle.backgroundImage).toContain("linear-gradient");
  expect(primaryStyle.radius).toBeGreaterThan(20);

  mkdirSync(output, { recursive: true });
  await page.screenshot({ path: `${output}/cascade-final-touch-result.png`, fullPage: true });
});
