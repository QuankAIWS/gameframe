import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";

async function prepare(page) {
  await mkdir(output, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 960 });
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

test("Cascade cartoon burst special leaves every desktop candy family visible", async ({ page }) => {
  await prepare(page);

  const geometry = await page.locator('.cascade-tile[data-special="bomb"]').evaluateAll((tiles) => tiles.slice(0, 6).map((tile) => {
    const tileRect = tile.getBoundingClientRect();
    const mark = tile.querySelector(".cascade-special-mark");
    const markRect = mark.getBoundingClientRect();
    const faceStyle = getComputedStyle(tile, "::before");
    return {
      tileWidth: tileRect.width,
      faceWidth: Number.parseFloat(faceStyle.width),
      markWidth: markRect.width,
      mask: faceStyle.maskImage || faceStyle.webkitMaskImage || "",
    };
  }));

  for (const item of geometry) {
    expect(item.faceWidth).toBeGreaterThan(item.tileWidth * 0.8);
    expect(item.markWidth).toBeLessThan(item.tileWidth * 0.5);
    expect(item.mask).toContain("data:image/svg+xml");
  }
  expect(new Set(geometry.map((item) => item.mask)).size).toBe(6);

  await page.screenshot({ path: `${output}/cascade-cartoon-burst-special-desktop.png`, fullPage: true });
});