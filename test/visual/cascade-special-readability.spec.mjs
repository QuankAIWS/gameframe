import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";

async function prepareBombRow(page, viewport = { width: 1440, height: 960 }) {
  await mkdir(output, { recursive: true });
  await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    localStorage.setItem("scribbles-gameframe.cascade-sound:v1", "off");
    localStorage.setItem("scribbles-gameframe.cascade-effects:v1", "full");
    localStorage.setItem("scribbles-gameframe.cascade-state:v1", JSON.stringify({
      level: 18,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 4,
      hammers: 2,
    }));
  });
  await page.goto("/cascade.html");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  await page.locator(".cascade-tile").evaluateAll((tiles) => {
    for (let kind = 0; kind < 6; kind += 1) {
      const tile = tiles[kind];
      tile.dataset.kind = String(kind);
      tile.dataset.special = "bomb";
      tile.classList.add("has-special");
      tile.querySelector(".cascade-special-mark")?.remove();
      const mark = document.createElement("span");
      mark.className = "cascade-special-mark";
      mark.setAttribute("aria-hidden", "true");
      tile.append(mark);
    }
  });
}

async function prepareButterflyRow(page, viewport = { width: 1440, height: 960 }) {
  await mkdir(output, { recursive: true });
  await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    localStorage.setItem("scribbles-gameframe.cascade-sound:v1", "off");
    localStorage.setItem("scribbles-gameframe.cascade-effects:v1", "full");
    localStorage.setItem("scribbles-gameframe.cascade-state:v1", JSON.stringify({
      level: 18,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 4,
      hammers: 2,
    }));
  });
  await page.goto("/cascade.html");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  await page.locator(".cascade-tile").evaluateAll((tiles) => {
    for (let kind = 0; kind < 6; kind += 1) {
      const tile = tiles[kind];
      tile.dataset.kind = String(kind);
      tile.dataset.special = "fish";
      tile.classList.add("has-special");
      tile.querySelector(".cascade-special-mark")?.remove();
      const mark = document.createElement("span");
      mark.className = "cascade-special-mark";
      mark.setAttribute("aria-hidden", "true");
      tile.append(mark);
    }
  });
}

async function prepareBombOnIce(page, viewport = { width: 390, height: 844 }) {
  await mkdir(output, { recursive: true });
  await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    localStorage.setItem("scribbles-gameframe.cascade-sound:v1", "off");
    localStorage.setItem("scribbles-gameframe.cascade-effects:v1", "full");
    localStorage.setItem("scribbles-gameframe.cascade-state:v1", JSON.stringify({
      level: 181,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 4,
      hammers: 2,
    }));
  });
  await page.goto("/cascade.html");
  const tile = page.locator('.cascade-tile[data-ice="2"]').first();
  await expect(tile).toBeVisible();
  await tile.evaluate((node) => {
    node.dataset.special = "bomb";
    node.classList.add("has-special");
    node.querySelector(".cascade-special-mark")?.remove();
    const mark = document.createElement("span");
    mark.className = "cascade-special-mark";
    mark.setAttribute("aria-hidden", "true");
    node.append(mark);
  });
  return tile;
}

async function bombGeometry(locator) {
  return locator.evaluate((tile) => {
    const tileRect = tile.getBoundingClientRect();
    const mark = tile.querySelector(".cascade-special-mark");
    const markRect = mark.getBoundingClientRect();
    const faceStyle = getComputedStyle(tile, "::before");
    return {
      tileWidth: tileRect.width,
      faceWidth: Number.parseFloat(faceStyle.width),
      markWidth: markRect.width,
      markLeftRatio: (markRect.left - tileRect.left) / tileRect.width,
      markTopRatio: (markRect.top - tileRect.top) / tileRect.height,
      mask: faceStyle.maskImage || faceStyle.webkitMaskImage || "",
    };
  });
}

test("Cascade Butterfly keeps all six color families readable on desktop", async ({ page }) => {
  await prepareButterflyRow(page);
  const geometry = await page.locator('.cascade-tile[data-special="fish"]').evaluateAll((tiles) => tiles.slice(0, 6).map((tile) => {
    const tileRect = tile.getBoundingClientRect();
    const markRect = tile.querySelector(".cascade-special-mark").getBoundingClientRect();
    const face = getComputedStyle(tile, "::before");
    return {
      tileWidth: tileRect.width,
      faceWidth: Number.parseFloat(face.width),
      faceTransform: face.transform,
      markWidth: markRect.width,
      kind: tile.dataset.kind,
    };
  }));
  expect(geometry).toHaveLength(6);
  expect(new Set(geometry.map((item) => item.kind)).size).toBe(6);
  for (const item of geometry) {
    expect(item.faceWidth).toBeGreaterThan(item.tileWidth * .75);
    expect(item.markWidth).toBeLessThan(item.tileWidth * .2);
    expect(item.faceTransform).not.toBe("none");
  }
  await page.screenshot({ path: `${output}/cascade-butterfly-special-desktop.png`, fullPage: true });
});

test("Cascade Butterfly remains color-readable on a phone-sized board", async ({ page }) => {
  await prepareButterflyRow(page, { width: 390, height: 844 });
  await expect(page.locator('.cascade-tile[data-special="fish"]')).toHaveCount(6);
  await page.screenshot({ path: `${output}/cascade-butterfly-special-mobile.png`, fullPage: true });
});

test("Cascade Butterfly admin trigger exposes the flutter flight", async ({ page }) => {
  await mkdir(output, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/session", async (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ playerId: "visual-butterfly-admin", displayName: "Cascade Admin", source: "discord", admin: true }),
  }));
  await page.addInitScript(() => {
    localStorage.setItem("scribbles-gameframe.cascade-sound:v1", "off");
    localStorage.setItem("scribbles-gameframe.cascade-effects:v1", "full");
    localStorage.setItem("scribbles-gameframe.cascade-state:v1", JSON.stringify({
      level: 18, lives: 5, lastLifeAt: Date.now(), streak: 0, hammers: 2,
    }));
  });
  await page.goto("/cascade.html");
  await page.locator("#cascade-admin-open").click();
  await page.locator('[data-admin-special="butterfly"]').click();
  await expect(page.locator('.cascade-tile[data-special="fish"]')).toHaveCount(1);
  await page.locator("#cascade-admin-open").click();
  await page.locator("[data-admin-trigger-special]").click();
  await expect(page.locator(".cascade-butterfly-flight")).toBeVisible({ timeout: 1500 });
  await page.screenshot({ path: `${output}/cascade-butterfly-flight-mobile.png`, fullPage: true });
});

test("Cascade lower-left bomb leaves every desktop candy family visible", async ({ page }) => {
  await prepareBombRow(page);

  const geometry = await page.locator('.cascade-tile[data-special="bomb"]').evaluateAll((tiles) => tiles.slice(0, 6).map((tile) => {
    const tileRect = tile.getBoundingClientRect();
    const mark = tile.querySelector(".cascade-special-mark");
    const markRect = mark.getBoundingClientRect();
    const faceStyle = getComputedStyle(tile, "::before");
    return {
      tileWidth: tileRect.width,
      faceWidth: Number.parseFloat(faceStyle.width),
      markWidth: markRect.width,
      markLeftRatio: (markRect.left - tileRect.left) / tileRect.width,
      markTopRatio: (markRect.top - tileRect.top) / tileRect.height,
      mask: faceStyle.maskImage || faceStyle.webkitMaskImage || "",
    };
  }));

  for (const item of geometry) {
    expect(item.faceWidth).toBeGreaterThan(item.tileWidth * 0.8);
    expect(item.markWidth).toBeLessThan(item.tileWidth * 0.4);
    expect(item.markLeftRatio).toBeLessThan(0.2);
    expect(item.markTopRatio).toBeGreaterThan(0.45);
    expect(item.mask).toContain("data:image/svg+xml");
  }
  expect(new Set(geometry.map((item) => item.mask)).size).toBe(6);

  await page.screenshot({ path: `${output}/cascade-cartoon-burst-special-desktop.png`, fullPage: true });
});

test("Cascade lower-left bomb stays readable on a phone-sized board", async ({ page }) => {
  await prepareBombRow(page, { width: 390, height: 844 });

  const firstBomb = page.locator('.cascade-tile[data-special="bomb"]').first();
  const geometry = await bombGeometry(firstBomb);
  expect(geometry.faceWidth).toBeGreaterThan(geometry.tileWidth * 0.82);
  expect(geometry.markWidth).toBeLessThan(geometry.tileWidth * 0.42);
  expect(geometry.markLeftRatio).toBeLessThan(0.16);
  expect(geometry.markTopRatio).toBeGreaterThan(0.45);

  await page.screenshot({ path: `${output}/cascade-cartoon-burst-special-mobile.png`, fullPage: true });
});

test("Cascade bomb and layered ice remain visually separate on mobile", async ({ page }) => {
  const tile = await prepareBombOnIce(page);
  const index = await tile.getAttribute("data-index");
  expect(index).not.toBeNull();

  const markers = page.locator(`.cascade-cell-coating-layer:not(.cascade-cell-coating-effects) .cascade-cell-coating[data-index="${index}"] .cascade-ice-markers`);
  await expect(markers).toBeVisible();

  const layout = await page.evaluate((tileIndex) => {
    const tileNode = document.querySelector(`.cascade-tile[data-index="${tileIndex}"]`);
    const mark = tileNode?.querySelector(".cascade-special-mark");
    const markerGroup = document.querySelector(`.cascade-cell-coating-layer:not(.cascade-cell-coating-effects) .cascade-cell-coating[data-index="${tileIndex}"] .cascade-ice-markers`);
    if (!tileNode || !mark || !markerGroup) return null;
    const markRect = mark.getBoundingClientRect();
    const markerRect = markerGroup.getBoundingClientRect();
    return {
      overlaps: !(
        markRect.right <= markerRect.left
        || markRect.left >= markerRect.right
        || markRect.bottom <= markerRect.top
        || markRect.top >= markerRect.bottom
      ),
    };
  }, index);
  expect(layout).not.toBeNull();
  expect(layout.overlaps).toBe(false);

  await page.screenshot({ path: `${output}/cascade-bomb-ice-mobile.png`, fullPage: true });
});
