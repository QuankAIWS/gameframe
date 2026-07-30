import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../../../${path}`, import.meta.url), "utf8");

test("MM-0001 repository checkpoint remains complete and evidence-aligned", async () => {
  const [
    readme,
    roadmap,
    agents,
    matrix,
    checkpoint,
    html,
    visual,
    navigation,
  ] = await Promise.all([
    read("README.md"),
    read("planning/ROADMAP.md"),
    read("AGENTS.md"),
    read("planning/browser-journey-matrix.md"),
    read("planning/validation/2026-07-30-monster-master-first-playable.md"),
    read("public/monster-master.html"),
    read("test/visual/monster-master-curated-visual.spec.mjs"),
    read("test/browser/monster-master-navigation.spec.mjs"),
  ]);

  assert.match(readme, /Monster Master MM-0001 candidate:/);
  assert.match(readme, /Forty-three Playwright interaction journeys/);
  assert.match(readme, /23 synthetic .* screenshots/);
  assert.match(readme, /\/monster-master\.html/);
  assert.match(readme, /src\/games\/monster-master/);

  assert.match(roadmap, /GF-0010 .* Repository candidate/);
  assert.match(roadmap, /MM-0001 .* Repository-complete candidate/);
  assert.match(roadmap, /2026-07-30-monster-master-first-playable\.md/);

  assert.match(agents, /review and freeze the repository-complete first playable Monster Master candidate/);
  assert.match(agents, /planning\/monster-master-rules\.md/);
  assert.match(agents, /planning\/browser-journey-matrix\.md/);
  assert.match(agents, /Use the separate `visual-review` label/);

  assert.match(matrix, /Capture numbers are globally unique/);
  assert.match(matrix, /23\. Monster Master — movement options/);
  assert.match(matrix, /Attack action .* Covered interaction; dedicated Monster Master attack capture deferred/);
  assert.match(matrix, /Stale revision .* Covered directly for Monster Master deployment/);

  assert.match(checkpoint, /Canonical Validation run #91 \(`30568023523`\)/);
  assert.match(checkpoint, /visual-review run #93 \(`30568548628`\)/);
  assert.match(checkpoint, /23 public-safe synthetic screenshots/);
  assert.match(checkpoint, /This checkpoint does not claim:/);

  assert.match(html, /Use the action controls and highlighted battlefield cells to resolve the duel\./);
  assert.doesNotMatch(html, /Deploy your roster into the highlighted starting zone\./);

  for (const capture of [
    "19-monster-master-lobby-desktop",
    "20-monster-master-lobby-mobile",
    "21-monster-master-deployment",
    "22-monster-master-combat-activation",
    "23-monster-master-move-options",
  ]) {
    assert.match(visual, new RegExp(capture));
  }
  assert.doesNotMatch(visual, /18-monster-master-lobby-desktop/);

  assert.match(navigation, /returns from Monster Master to the main game lobby/);
  assert.match(navigation, /opens and closes Monster Master diagnostics/);
});
