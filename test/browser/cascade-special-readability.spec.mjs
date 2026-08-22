import { expect, test } from "@playwright/test";

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

test("Cascade desktop burst specials stay compact and preserve the candy underneath", async ({ page }) => {
  await prepareSpecialRow(page);

  const specials = await page.locator('.cascade-tile[data-special="bomb"]').evaluateAll((tiles) => tiles.slice(0, 6).map((tile) => {
    const tileRect = tile.getBoundingClientRect();
    const faceStyle = getComputedStyle(tile, "::before");
    const mark = tile.querySelector(".cascade-special-mark");
    const markRect = mark.getBoundingClientRect();
    const fuseStyle = getComputedStyle(mark, "::before");
    const sparkStyle = getComputedStyle(mark, "::after");
    return {
      kind: tile.dataset.kind,
      tileWidth: tileRect.width,
      faceWidth: Number.parseFloat(faceStyle.width),
      mask: faceStyle.maskImage || faceStyle.webkitMaskImage || "",
      markWidth: markRect.width,
      markHeight: markRect.height,
      markBackground: getComputedStyle(mark).backgroundImage,
      fuseTop: fuseStyle.borderTopWidth,
      fuseRight: fuseStyle.borderRightWidth,
      sparkClip: sparkStyle.clipPath,
      sparkBackground: sparkStyle.backgroundImage,
    };
  }));

  expect(specials).toHaveLength(6);
  for (const special of specials) {
    expect(special.mask).toContain("data:image/svg+xml");
    expect(special.faceWidth).toBeGreaterThan(special.tileWidth * 0.8);
    expect(special.markWidth).toBeLessThan(special.tileWidth * 0.5);
    expect(special.markHeight).toBeLessThan(special.tileWidth * 0.5);
    expect(special.markBackground).toContain("radial-gradient");
    expect(Number.parseFloat(special.fuseTop)).toBeGreaterThanOrEqual(3);
    expect(Number.parseFloat(special.fuseRight)).toBeGreaterThanOrEqual(3);
    expect(special.sparkClip).not.toBe("none");
    expect(special.sparkBackground).toContain("conic-gradient");
  }

  expect(new Set(specials.map((special) => special.mask)).size).toBe(6);
});

test("Cascade mobile burst specials stay subordinate to the older-eye candy silhouette", async ({ page }) => {
  await prepareSpecialRow(page, { width: 390, height: 844 });

  const geometry = await page.locator('.cascade-tile[data-special="bomb"]').first().evaluate((tile) => {
    const tileRect = tile.getBoundingClientRect();
    const markRect = tile.querySelector(".cascade-special-mark").getBoundingClientRect();
    const faceStyle = getComputedStyle(tile, "::before");
    return {
      tileWidth: tileRect.width,
      faceWidth: Number.parseFloat(faceStyle.width),
      markWidth: markRect.width,
    };
  });

  expect(geometry.faceWidth).toBeGreaterThan(geometry.tileWidth * 0.82);
  expect(geometry.markWidth).toBeLessThan(geometry.tileWidth * 0.55);
});
