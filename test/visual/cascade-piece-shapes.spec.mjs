import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "visual-results/player-ui-review";

async function prepare(page, viewport) {
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
}

async function stageFamiliesAndSpecials(page) {
  await page.locator(".cascade-tile").evaluateAll((tiles) => {
    for (let kind = 0; kind < 6; kind += 1) {
      const tile = tiles[kind];
      tile.dataset.kind = String(kind);
      tile.removeAttribute("data-special");
      tile.classList.remove("has-special");
      tile.querySelector(".cascade-special-mark")?.remove();
    }

    for (const [index, kind, special] of [
      [8, 0, "stripe-h"],
      [9, 1, "stripe-v"],
      [10, 2, "bomb"],
      [11, 3, "color"],
      [12, 4, "stripe-h"],
      [13, 5, "bomb"],
    ]) {
      const tile = tiles[index];
      tile.dataset.kind = String(kind);
      tile.dataset.special = special;
      tile.classList.add("has-special");
      tile.querySelector(".cascade-special-mark")?.remove();
      const mark = document.createElement("span");
      mark.className = "cascade-special-mark";
      mark.setAttribute("aria-hidden", "true");
      tile.append(mark);
    }
  });
}

test("Cascade distinct family silhouettes are readable on the desktop cabinet", async ({ page }) => {
  await prepare(page, { width: 1440, height: 960 });
  await stageFamiliesAndSpecials(page);
  await expect(page.locator('link[href="/cascade-piece-shapes.css"]')).toHaveCount(1);
  await page.screenshot({ path: `${output}/cascade-crush-distinct-piece-shapes-desktop.png`, fullPage: true });
});

test("Cascade distinct family silhouettes remain bold on older-eye mobile", async ({ page }) => {
  await prepare(page, { width: 390, height: 844 });
  await stageFamiliesAndSpecials(page);
  await expect(page.locator("#booster-hammer")).toBeVisible();
  await page.screenshot({ path: `${output}/cascade-crush-distinct-piece-shapes-mobile.png`, fullPage: false });
});
