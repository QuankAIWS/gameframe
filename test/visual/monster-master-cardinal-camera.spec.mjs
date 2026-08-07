import { test, expect } from "@playwright/test";

const reference = { x: 11.5, y: 11.5 };

async function screenPoint(page) {
  return page.evaluate(
    (coordinate) => window.gameFrameMonsterPixiBridge.worldToScreen(coordinate),
    reference,
  );
}

async function setQuarter(page, targetQuarter) {
  await page.locator("#monster-master-center-field").click();
  await page.evaluate((quarter) => {
    let current = window.gameFrameMonsterPixi.getCamera().quarter;
    while (current !== quarter) {
      window.gameFrameMonsterPixi.rotateRight();
      current = window.gameFrameMonsterPixi.getCamera().quarter;
    }
  }, targetQuarter);
  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterPixi.getCamera().quarter))
    .toBe(targetQuarter);
}

test("Monster Master WASD camera input stays screen-cardinal at every rotation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/monster-master.html?player=monster-cardinal-keyboard");
  await expect.poll(() => page.evaluate(() => Boolean(window.gameFrameMonsterController))).toBe(true);
  await page.locator("#monster-master-bot").click();
  await expect(page.locator("body.monster-master-pixi-ready")).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.gameFrameMonsterPixiBridge?.panScreen))).toBe(true);

  const expectations = {
    KeyA: (before, after) => {
      expect(after.x).toBeGreaterThan(before.x + 40);
      expect(Math.abs(after.y - before.y)).toBeLessThan(2);
    },
    KeyD: (before, after) => {
      expect(after.x).toBeLessThan(before.x - 40);
      expect(Math.abs(after.y - before.y)).toBeLessThan(2);
    },
    KeyW: (before, after) => {
      expect(after.y).toBeGreaterThan(before.y + 20);
      expect(Math.abs(after.x - before.x)).toBeLessThan(2);
    },
    KeyS: (before, after) => {
      expect(after.y).toBeLessThan(before.y - 20);
      expect(Math.abs(after.x - before.x)).toBeLessThan(2);
    },
  };

  for (let quarter = 0; quarter < 4; quarter += 1) {
    for (const [key, verify] of Object.entries(expectations)) {
      await setQuarter(page, quarter);
      const before = await screenPoint(page);
      await page.keyboard.press(key);
      const after = await screenPoint(page);
      verify(before, after);
      expect(await page.evaluate(() => window.gameFrameMonsterPixi.getCamera().quarter)).toBe(quarter);
    }
  }
});

test("Monster Master active-turn portrait uses a smooth non-rotating idle motion", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/monster-master.html?player=monster-turn-motion");
  await expect.poll(() => page.evaluate(() => Boolean(window.gameFrameMonsterController))).toBe(true);
  await page.locator("#monster-master-bot").click();
  await expect(page.locator("body.monster-master-pixi-ready")).toBeVisible();

  const turnCard = page.locator(".monster-master-turn-unit").first();
  await expect(turnCard).toBeVisible();
  await turnCard.evaluate((node) => node.classList.add("is-active"));
  const portrait = turnCard.locator(".monster-master-turn-portrait");
  const motion = await portrait.evaluate((node) => {
    const animation = node.getAnimations()[0];
    const keyframes = animation?.effect?.getKeyframes?.() ?? [];
    return {
      duration: Number(animation?.effect?.getTiming?.().duration ?? 0),
      transforms: keyframes.map((frame) => String(frame.transform ?? "")),
    };
  });
  expect(motion.duration).toBeGreaterThanOrEqual(2800);
  expect(motion.transforms.some((transform) => transform.includes("rotate"))).toBe(false);
  expect(motion.transforms.some((transform) => transform.includes("scale"))).toBe(true);
});
