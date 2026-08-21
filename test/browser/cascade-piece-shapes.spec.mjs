import { expect, test } from "@playwright/test";

async function prepare(page, viewport) {
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
  await expect(page.locator('link[href="/cascade-piece-shapes.css"]')).toHaveCount(1);
}

async function forceFamilyRow(page) {
  await page.locator(".cascade-tile").evaluateAll((tiles) => {
    for (let kind = 0; kind < 6; kind += 1) {
      const tile = tiles[kind];
      tile.dataset.kind = String(kind);
      tile.removeAttribute("data-special");
      tile.classList.remove("has-special");
      tile.querySelector(".cascade-special-mark")?.remove();
    }
  });
}

async function readFamilyGeometry(page) {
  return page.locator(".cascade-tile").evaluateAll((tiles) => tiles.slice(0, 6).map((tile) => {
    const tileStyle = getComputedStyle(tile);
    const faceStyle = getComputedStyle(tile, "::before");
    const tileRect = tile.getBoundingClientRect();
    return {
      kind: tile.dataset.kind,
      mask: faceStyle.maskImage || faceStyle.webkitMaskImage || "",
      faceWidth: Number.parseFloat(faceStyle.width),
      faceHeight: Number.parseFloat(faceStyle.height),
      tileWidth: tileRect.width,
      tileHeight: tileRect.height,
      cellBackground: tileStyle.backgroundImage,
    };
  }));
}

test("Cascade uses six distinct silhouette families instead of one rounded candy shape", async ({ page }) => {
  await prepare(page, { width: 1440, height: 960 });
  await forceFamilyRow(page);

  const families = await readFamilyGeometry(page);
  expect(families.map((entry) => entry.kind)).toEqual(["0", "1", "2", "3", "4", "5"]);
  expect(new Set(families.map((entry) => entry.mask)).size).toBe(6);
  for (const family of families) {
    expect(family.mask).toContain("data:image/svg+xml");
    expect(family.faceWidth).toBeGreaterThan(family.tileWidth * 0.7);
    expect(family.faceHeight).toBeGreaterThan(family.tileHeight * 0.7);
    expect(family.cellBackground).toBe("none");
  }
});

test("Cascade keeps the same six family identities on the older-eye mobile board", async ({ page }) => {
  await prepare(page, { width: 390, height: 844 });
  await forceFamilyRow(page);

  const families = await readFamilyGeometry(page);
  expect(new Set(families.map((entry) => entry.mask)).size).toBe(6);
  for (const family of families) {
    expect(family.faceWidth).toBeGreaterThan(family.tileWidth * 0.82);
    expect(family.faceHeight).toBeGreaterThan(family.tileHeight * 0.72);
  }

  const board = await page.locator("#board").boundingBox();
  expect(board).toBeTruthy();
  expect(board.width).toBeGreaterThanOrEqual(380);
  expect(board.bottom).toBeLessThan(844);
});

test("striped and bomb specials retain their base family silhouette while color stays unique", async ({ page }) => {
  await prepare(page, { width: 1440, height: 960 });
  await forceFamilyRow(page);

  await page.locator(".cascade-tile").evaluateAll((tiles) => {
    for (const [index, special] of [[0, "stripe-h"], [1, "stripe-v"], [2, "bomb"], [3, "color"]]) {
      const tile = tiles[index];
      tile.dataset.special = special;
      tile.classList.add("has-special");
      const mark = document.createElement("span");
      mark.className = "cascade-special-mark";
      mark.setAttribute("aria-hidden", "true");
      tile.append(mark);
    }
  });

  const result = await page.locator(".cascade-tile").evaluateAll((tiles) => {
    const readMask = (style) => style.maskImage || style.webkitMaskImage || "";
    return {
      stripeHFace: readMask(getComputedStyle(tiles[0], "::before")),
      stripeHMark: readMask(getComputedStyle(tiles[0].querySelector(".cascade-special-mark"))),
      stripeVFace: readMask(getComputedStyle(tiles[1], "::before")),
      stripeVMark: readMask(getComputedStyle(tiles[1].querySelector(".cascade-special-mark"))),
      bombFace: readMask(getComputedStyle(tiles[2], "::before")),
      colorFace: readMask(getComputedStyle(tiles[3], "::before")),
    };
  });

  expect(result.stripeHMark).toBe(result.stripeHFace);
  expect(result.stripeVMark).toBe(result.stripeVFace);
  expect(result.bombFace).toContain("data:image/svg+xml");
  expect(result.colorFace).not.toBe(result.bombFace);
});
