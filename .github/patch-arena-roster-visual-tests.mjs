import { readFile, writeFile } from "node:fs/promises";

async function patch(path, from, to) {
  const text = await readFile(path, "utf8");
  if (!text.includes(from)) throw new Error(`Missing visual test anchor in ${path}`);
  await writeFile(path, text.replace(from, to));
}

await patch(
  "test/visual/player-ui-regressions.spec.mjs",
  `  await deployNextMonsterMasterUnit(page);\n  await deployNextMonsterMasterUnit(page);\n  await deployNextMonsterMasterUnit(page);\n  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterController?.getView()?.observation.phase), {`,
  `  await deployNextMonsterMasterUnit(page);\n  await deployNextMonsterMasterUnit(page);\n  await deployNextMonsterMasterUnit(page);\n  await deployNextMonsterMasterUnit(page);\n  await expect.poll(() => page.evaluate(() => window.gameFrameMonsterController?.getView()?.observation.phase), {`,
);
await patch(
  "test/visual/player-ui-regressions.spec.mjs",
  `  await expect(page.locator("#monster-master-unit-hud")).toHaveAttribute("data-role", "emberling");\n  await expect(page.locator("#monster-master-unit-hud .section-label")).toHaveText("ACTIVE UNIT");\n  await expect(page.locator("#monster-master-hud-health")).toHaveText("8/8");\n  await expect(page.locator("#monster-master-hud-initiative")).toHaveText("Initiative 9");`,
  `  await expect(page.locator("#monster-master-unit-hud")).toHaveAttribute("data-role", "emberling");\n  await expect(page.locator("#monster-master-unit-hud")).toHaveAttribute("data-content-id", "stormcrest-skitter-v1");\n  await expect(page.locator("#monster-master-unit-hud .section-label")).toHaveText("ACTIVE UNIT");\n  await expect(page.locator("#monster-master-hud-name")).toHaveText("Stormcrest Skitter");\n  await expect(page.locator("#monster-master-hud-health")).toHaveText("9/9");\n  await expect(page.locator("#monster-master-hud-initiative")).toHaveText("Initiative 10");`,
);
await patch(
  "test/visual/player-ui-review.spec.mjs",
  `  await expect(page.locator(".monster-master-turn-unit")).toHaveCount(6);`,
  `  await expect(page.locator(".monster-master-turn-unit")).toHaveCount(8);`,
);
