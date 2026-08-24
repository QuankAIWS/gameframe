import { expect, test } from "@playwright/test";

function installBomb(tile) {
  tile.dataset.special = "bomb";
  tile.classList.add("has-special");
  tile.querySelector(".cascade-special-mark")?.remove();
  const mark = document.createElement("span");
  mark.className = "cascade-special-mark";
  mark.setAttribute("aria-hidden", "true");
  tile.append(mark);
}

async function prepareSpecialRow(page, viewport = { width: 1440, height: 960 }) {
  await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    localStorage.setItem("scribbles-gameframe.cascade-sound:v1", "off");
    localStorage.setItem("scribbles-gameframe.cascade-effects:v1", "reduced");
    localStorage.setItem("scribbles-gameframe.cascade-state:v1", JSON.stringify({
      level: 5,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 2,
      hammers: 2,
    }));
  });
  await page.goto("/cascade.html");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);
  await expect(page.locator('link[href="/cascade-bomb-special.css"]')).toHaveCount(1);

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

async function prepareBombOnIce(page, viewport = { width: 390, height: 844 }) {
  await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    localStorage.setItem("scribbles-gameframe.cascade-sound:v1", "off");
    localStorage.setItem("scribbles-gameframe.cascade-effects:v1", "reduced");
    localStorage.setItem("scribbles-gameframe.cascade-state:v1", JSON.stringify({
      level: 181,
      lives: 5,
      lastLifeAt: Date.now(),
      streak: 2,
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

test("Cascade desktop burst specials read as lower-left bombs without replacing candy identity", async ({ page }) => {
  await prepareSpecialRow(page);

  const specials = await page.locator('.cascade-tile[data-special="bomb"]').evaluateAll((tiles) => tiles.slice(0, 6).map((tile) => {
    const tileRect = tile.getBoundingClientRect();
    const faceStyle = getComputedStyle(tile, "::before");
    const mark = tile.querySelector(".cascade-special-mark");
    const markRect = mark.getBoundingClientRect();
    const markStyle = getComputedStyle(mark);
    const fuseStyle = getComputedStyle(mark, "::before");
    const sparkStyle = getComputedStyle(mark, "::after");
    return {
      kind: tile.dataset.kind,
      tileWidth: tileRect.width,
      faceWidth: Number.parseFloat(faceStyle.width),
      mask: faceStyle.maskImage || faceStyle.webkitMaskImage || "",
      markWidth: markRect.width,
      markHeight: markRect.height,
      markLeftRatio: (markRect.left - tileRect.left) / tileRect.width,
      markTopRatio: (markRect.top - tileRect.top) / tileRect.height,
      markBorderTop: markStyle.borderTopWidth,
      markBackground: markStyle.backgroundImage,
      fuseTop: fuseStyle.borderTopWidth,
      fuseRight: fuseStyle.borderRightWidth,
      fuseBackground: fuseStyle.backgroundImage,
      sparkClip: sparkStyle.clipPath,
      sparkBackground: sparkStyle.backgroundImage,
    };
  }));

  expect(specials).toHaveLength(6);
  for (const special of specials) {
    expect(special.mask).toContain("data:image/svg+xml");
    expect(special.faceWidth).toBeGreaterThan(special.tileWidth * 0.8);
    expect(special.markWidth).toBeLessThan(special.tileWidth * 0.4);
    expect(special.markHeight).toBeLessThan(special.tileWidth * 0.4);
    expect(special.markLeftRatio).toBeLessThan(0.2);
    expect(special.markTopRatio).toBeGreaterThan(0.45);
    expect(special.markBorderTop).toBe("0px");
    expect(special.markBackground).toContain("radial-gradient");
    expect(Number.parseFloat(special.fuseTop)).toBeGreaterThanOrEqual(4);
    expect(Number.parseFloat(special.fuseRight)).toBeGreaterThanOrEqual(4);
    expect(special.fuseBackground).toContain("radial-gradient");
    expect(special.sparkClip).not.toBe("none");
    expect(special.sparkBackground).toContain("conic-gradient");
  }

  expect(new Set(specials.map((special) => special.mask)).size).toBe(6);
});

test("Cascade mobile bombs stay subordinate to the older-eye candy silhouette", async ({ page }) => {
  await prepareSpecialRow(page, { width: 390, height: 844 });

  const geometry = await page.locator('.cascade-tile[data-special="bomb"]').first().evaluate((tile) => {
    const tileRect = tile.getBoundingClientRect();
    const markRect = tile.querySelector(".cascade-special-mark").getBoundingClientRect();
    const faceStyle = getComputedStyle(tile, "::before");
    return {
      tileWidth: tileRect.width,
      faceWidth: Number.parseFloat(faceStyle.width),
      markWidth: markRect.width,
      markLeftRatio: (markRect.left - tileRect.left) / tileRect.width,
      markTopRatio: (markRect.top - tileRect.top) / tileRect.height,
    };
  });

  expect(geometry.faceWidth).toBeGreaterThan(geometry.tileWidth * 0.82);
  expect(geometry.markWidth).toBeLessThan(geometry.tileWidth * 0.42);
  expect(geometry.markLeftRatio).toBeLessThan(0.16);
  expect(geometry.markTopRatio).toBeGreaterThan(0.45);
});

test("Cascade bomb body stays clear of the top-right ice durability markers", async ({ page }) => {
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
    const tileRect = tileNode.getBoundingClientRect();
    const markRect = mark.getBoundingClientRect();
    const markerRect = markerGroup.getBoundingClientRect();
    const overlaps = !(
      markRect.right <= markerRect.left
      || markRect.left >= markerRect.right
      || markRect.bottom <= markerRect.top
      || markRect.top >= markerRect.bottom
    );
    return {
      overlaps,
      markTopRatio: (markRect.top - tileRect.top) / tileRect.height,
      markerBottomRatio: (markerRect.bottom - tileRect.top) / tileRect.height,
      markLeftRatio: (markRect.left - tileRect.left) / tileRect.width,
      markerLeftRatio: (markerRect.left - tileRect.left) / tileRect.width,
    };
  }, index);

  expect(layout).not.toBeNull();
  expect(layout.overlaps).toBe(false);
  expect(layout.markTopRatio).toBeGreaterThan(0.45);
  expect(layout.markerBottomRatio).toBeLessThan(0.3);
  expect(layout.markLeftRatio).toBeLessThan(0.2);
  expect(layout.markerLeftRatio).toBeGreaterThan(0.55);
});
