import { expect, test } from "@playwright/test";

test("Othello product surface exposes all themes and playable legal moves", async ({ page }) => {
  await page.goto("/othello.html?theme=obsidian&state=opening");
  await expect(page.getByRole("heading", { name: "Othello" })).toBeVisible();
  await expect(page.locator("#legal-count")).toHaveText("4");
  await expect(page.locator("canvas")).toBeVisible();

  await page.getByRole("button", { name: "Neon Circuit" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-theme", "neon");
  await expect(page.locator("#theme-title")).toHaveText("Neon Circuit");

  await page.getByRole("button", { name: "Play one move" }).click();
  await expect(page.locator("#move-number")).toHaveText("1 / 60");

  await page.getByRole("button", { name: "Living Garden" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-theme", "garden");
  await expect(page.locator("#theme-title")).toHaveText("Living Garden");
});

test("Othello desktop product surfaces preserve the Discord safe zone", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });

  for (const theme of ["obsidian", "neon", "garden"]) {
    await page.goto(`/othello.html?theme=${theme}&state=midgame`);
    const geometry = await page.evaluate(() => {
      const safe = document.querySelector("#discord-safe-zone").getBoundingClientRect();
      const occupied = [
        document.querySelector(".brand-lockup"),
        document.querySelector(".play-layout"),
        document.querySelector(".command-bar"),
      ].map((element) => element.getBoundingClientRect());
      const intersects = occupied.some((rect) => !(
        rect.right <= safe.left || rect.left >= safe.right || rect.bottom <= safe.top || rect.top >= safe.bottom
      ));
      return { safeWidth: safe.width, safeHeight: safe.height, intersects };
    });
    expect(geometry.safeWidth).toBeGreaterThanOrEqual(180);
    expect(geometry.safeHeight).toBeGreaterThanOrEqual(70);
    expect(geometry.intersects).toBe(false);
  }
});

test("Living Garden uses an asymmetric, subdued pond foreground", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/othello.html?theme=garden&state=midgame");

  const artwork = await page.evaluate(() => {
    const leftPad = document.querySelector(".garden-pad-a");
    const rightPad = document.querySelector(".garden-pad-b");
    const leftLotus = document.querySelector(".garden-lotus-a");
    const ripple = document.querySelector(".garden-ripple-a");
    const leftStyle = getComputedStyle(leftPad);
    const rightStyle = getComputedStyle(rightPad);
    const lotusStyle = getComputedStyle(leftLotus);
    const rippleStyle = getComputedStyle(ripple);
    const leftRect = leftPad.getBoundingClientRect();
    const rightRect = rightPad.getBoundingClientRect();
    const lotusRect = leftLotus.getBoundingClientRect();
    return {
      leftImage: leftStyle.backgroundImage,
      rightImage: rightStyle.backgroundImage,
      lotusImage: lotusStyle.backgroundImage,
      leftWidth: leftRect.width,
      rightWidth: rightRect.width,
      leftBottom: innerHeight - leftRect.bottom,
      rightBottom: innerHeight - rightRect.bottom,
      leftOpacity: Number.parseFloat(leftStyle.opacity),
      rightOpacity: Number.parseFloat(rightStyle.opacity),
      rippleOpacity: Number.parseFloat(rippleStyle.opacity),
      leftZ: Number.parseInt(leftStyle.zIndex, 10),
      rippleZ: Number.parseInt(rippleStyle.zIndex, 10),
      rippleBorder: rippleStyle.borderTopWidth,
      leftInsideViewport: leftRect.right > 0 && leftRect.left < innerWidth && leftRect.bottom > 0,
      rightInsideViewport: rightRect.right > 0 && rightRect.left < innerWidth && rightRect.bottom > 0,
      lotusInsideViewport: lotusRect.right > 0 && lotusRect.left < innerWidth && lotusRect.bottom > 0,
    };
  });

  expect(artwork.leftImage).toContain("othello-garden-lily-pad.svg");
  expect(artwork.rightImage).toContain("othello-garden-lily-pad.svg");
  expect(artwork.lotusImage).toContain("othello-garden-lotus.svg");
  expect(artwork.leftWidth).toBeGreaterThan(330);
  expect(artwork.rightWidth).toBeLessThan(250);
  expect(artwork.leftWidth).toBeGreaterThan(artwork.rightWidth * 1.4);
  expect(artwork.leftBottom).toBeLessThan(20);
  expect(artwork.rightBottom).toBeGreaterThan(40);
  expect(artwork.leftOpacity).toBeLessThan(0.55);
  expect(artwork.rightOpacity).toBeLessThan(0.4);
  expect(artwork.rippleOpacity).toBeLessThan(0.5);
  expect(artwork.leftZ).toBeGreaterThan(artwork.rippleZ);
  expect(artwork.rippleBorder).toBe("0px");
  expect(artwork.leftInsideViewport).toBe(true);
  expect(artwork.rightInsideViewport).toBe(true);
  expect(artwork.lotusInsideViewport).toBe(true);
});

test("Living Garden removes the low-fidelity card and board ornaments", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/othello.html?theme=garden&state=midgame");

  const ornaments = await page.evaluate(() => ({
    leftBoard: getComputedStyle(document.querySelector(".garden-board-ornament-left")).display,
    rightBoard: getComputedStyle(document.querySelector(".garden-board-ornament-right")).display,
    darkCardDecoration: getComputedStyle(document.querySelector(".score-rail-dark"), "::after").display,
    lightCardDecoration: getComputedStyle(document.querySelector(".score-rail-light"), "::after").display,
    darkCardContent: getComputedStyle(document.querySelector(".score-rail-dark"), "::after").content,
    lightCardContent: getComputedStyle(document.querySelector(".score-rail-light"), "::after").content,
  }));

  expect(ornaments.leftBoard).toBe("none");
  expect(ornaments.rightBoard).toBe("none");
  expect(ornaments.darkCardDecoration).toBe("none");
  expect(ornaments.lightCardDecoration).toBe("none");
  expect(["none", "normal", ""]).toContain(ornaments.darkCardContent.replaceAll('"', ""));
  expect(["none", "normal", ""]).toContain(ornaments.lightCardContent.replaceAll('"', ""));
});

test("Othello mobile surface remains horizontally bounded", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/othello.html?theme=garden&state=midgame");
  await expect(page.locator("canvas")).toBeVisible();
  const bounds = await page.evaluate(() => ({
    scrollWidth: document.scrollingElement.scrollWidth,
    viewportWidth: window.innerWidth,
    canvasWidth: document.querySelector("#othello-board").getBoundingClientRect().width,
    darkRailHeight: document.querySelector(".score-rail-dark").getBoundingClientRect().height,
  }));
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.viewportWidth + 2);
  expect(bounds.canvasWidth).toBeLessThanOrEqual(bounds.viewportWidth - 16);
  expect(bounds.darkRailHeight).toBeLessThanOrEqual(80);
});

test("Othello idle rendering does not keep a permanent animation-frame loop", async ({ page }) => {
  await page.addInitScript(() => {
    const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    window.__gameframeRafRequests = 0;
    window.requestAnimationFrame = (callback) => {
      window.__gameframeRafRequests += 1;
      return nativeRequestAnimationFrame(callback);
    };
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/othello.html?theme=neon&state=midgame");
  await expect(page.locator("#gameframe-destination-bar")).toBeVisible();
  await page.waitForTimeout(600);

  const idleStart = await page.evaluate(() => window.__gameframeRafRequests);
  await page.waitForTimeout(450);
  const idleEnd = await page.evaluate(() => window.__gameframeRafRequests);
  expect(idleEnd - idleStart).toBeLessThanOrEqual(3);

  await page.getByRole("button", { name: "Play one move" }).click();
  await page.waitForTimeout(180);
  const animated = await page.evaluate(() => window.__gameframeRafRequests);
  expect(animated - idleEnd).toBeGreaterThan(3);

  await page.waitForTimeout(650);
  const settledStart = await page.evaluate(() => window.__gameframeRafRequests);
  await page.waitForTimeout(450);
  const settledEnd = await page.evaluate(() => window.__gameframeRafRequests);
  expect(settledEnd - settledStart).toBeLessThanOrEqual(3);
});

test("Othello board remains clear of the shared GameFrame bar at desktop heights", async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/othello.html?theme=neon&state=midgame");
    await expect(page.locator("#gameframe-destination-bar")).toBeVisible();
    await expect(page.locator("body")).toHaveClass(/gameframe-othello-route/);

    const geometry = await page.evaluate(() => {
      const bar = document.querySelector("#gameframe-destination-bar").getBoundingClientRect();
      const board = document.querySelector(".board-frame").getBoundingClientRect();
      const command = document.querySelector(".command-bar").getBoundingClientRect();
      return {
        barBottom: bar.bottom,
        boardTop: board.top,
        boardBottom: board.bottom,
        commandBottom: command.bottom,
        viewportHeight: window.innerHeight,
      };
    });

    expect(geometry.boardTop).toBeGreaterThanOrEqual(geometry.barBottom + 10);
    expect(geometry.boardBottom).toBeLessThan(geometry.viewportHeight);
    expect(geometry.commandBottom).toBeLessThanOrEqual(geometry.viewportHeight + 2);
  }
});
