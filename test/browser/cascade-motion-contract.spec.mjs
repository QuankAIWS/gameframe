import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "no-preference" });

test("functional Cascade checks exercise normal motion while reduced motion stays testable", async ({ page }) => {
  await page.goto("/cascade.html?player=cascade-motion-contract-test");
  await expect(page.locator(".cascade-tile")).toHaveCount(64);

  const reduced = () => page.evaluate(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  expect(await reduced()).toBe(false);

  // Explicit accessibility coverage must remain possible without changing
  // the suite-wide functional animation profile.
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await reduced()).toBe(true);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  expect(await reduced()).toBe(false);
});
