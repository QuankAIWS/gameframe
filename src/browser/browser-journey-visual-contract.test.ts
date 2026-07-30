import assert from "node:assert/strict";
import test from "node:test";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (path: string) => readFile(join(root, path), "utf8");

test("browser journey and visual review tooling remains deliberate and durable", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  const workflow = await read(".github/workflows/ci.yml");
  const gitignore = await read(".gitignore");
  const matrix = await read("planning/browser-journey-matrix.md");
  const controlJourneys = await read("test/browser/control-journeys.spec.mjs");
  const curatedVisuals = await read("test/visual/curated-visual-review.spec.mjs");
  const baselineTests = await read("test/visual-baseline/visual-baselines.spec.mjs");
  const visualConfig = await read("playwright.visual.config.mjs");
  const baselineConfig = await read("playwright.visual-baseline.config.mjs");

  assert.equal(packageJson.scripts["test:visual"], "playwright test --config playwright.visual.config.mjs");
  assert.equal(
    packageJson.scripts["test:visual-baseline"],
    "playwright test --config playwright.visual-baseline.config.mjs",
  );
  assert.match(packageJson.scripts.validate, /npm run test:visual-baseline/);

  assert.match(workflow, /github\.event\.label\.name == 'visual-review'/);
  assert.match(workflow, /run: npm run test:visual/);
  assert.match(workflow, /retention-days: 7/);
  assert.match(workflow, /if-no-files-found: error/);
  assert.doesNotMatch(workflow, /visual-baseline-bootstrap/);
  assert.doesNotMatch(workflow, /contents: write/);
  assert.doesNotMatch(workflow, /^\s{2}(?:push|schedule):/m);

  assert.match(gitignore, /^visual-results\/$/m);
  assert.match(visualConfig, /outputDir: "visual-results"/);
  assert.match(visualConfig, /reducedMotion: "reduce"/);
  assert.match(visualConfig, /workers: 1/);
  assert.match(baselineConfig, /snapshotPathTemplate/);
  assert.match(baselineConfig, /maxDiffPixelRatio: 0\.001/);

  for (const heading of [
    "Cross-surface shell and navigation",
    "Authentication and session journeys",
    "Secure invitation journeys",
    "Tic-Tac-Toe journeys",
    "American Checkers journeys",
    "Tactical Movement journeys",
    "Tactical Combat journeys",
    "Connectivity, stale state, and failure journeys",
    "Curated visual-review set",
    "Narrow visual-baseline candidates",
  ]) {
    assert.match(matrix, new RegExp(heading));
  }

  for (const journey of [
    "navigates game surfaces, diagnostics, and setup reset controls",
    "exercises tactical camera controls and navigation",
    "exercises combat camera, diagnostics, and setup controls",
    "logs out a Discord-authenticated browser",
    "copies and cancels a secure invitation",
    "shows safe invitation errors",
  ]) {
    assert.match(controlJourneys, new RegExp(journey));
  }

  for (let index = 1; index <= 18; index += 1) {
    assert.match(curatedVisuals, new RegExp(`"${String(index).padStart(2, "0")}-`));
  }

  for (const baseline of [
    "main-lobby-desktop.png",
    "main-lobby-mobile.png",
    "hosted-authentication-gate.png",
    "invitation-claim-error.png",
  ]) {
    assert.match(baselineTests, new RegExp(baseline.replaceAll(".", "\\.")));
    const path = join(root, "test/visual-baseline/__snapshots__", baseline);
    const metadata = await stat(path);
    assert.ok(metadata.size > 10_000, `${baseline} must be a substantive committed PNG baseline.`);
    const signature = (await readFile(path)).subarray(0, 8);
    assert.deepEqual([...signature], [137, 80, 78, 71, 13, 10, 26, 10]);
  }
});
