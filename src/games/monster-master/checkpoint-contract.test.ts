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
    inviteDisclosure,
  ] = await Promise.all([
    read("README.md"),
    read("planning/ROADMAP.md"),
    read("AGENTS.md"),
    read("planning/browser-journey-matrix.md"),
    read("planning/validation/2026-07-30-monster-master-first-playable.md"),
    read("public/monster-master.html"),
    read("test/visual/monster-master-curated-visual.spec.mjs"),
    read("test/browser/monster-master-navigation.spec.mjs"),
    read("test/browser/monster-master-invite-disclosure.spec.mjs"),
  ]);

  assert.match(readme, /Monster Master MM-0001 candidate:/);
  assert.match(readme, /Forty-four Playwright interaction journeys/);
  assert.match(readme, /30 synthetic .* screenshots/);
  assert.match(readme, /configured final round/);
  assert.match(readme, /Collapsed local second-seat invitation disclosure/);
  assert.match(readme, /\/monster-master\.html/);
  assert.match(readme, /src\/games\/monster-master/);

  assert.match(roadmap, /GF-0010 .* Repository candidate/);
  assert.match(roadmap, /`MM-0001` — Repository-complete candidate/);
  assert.match(roadmap, /2026-07-30-monster-master-first-playable\.md/);

  assert.match(agents, /review and freeze the repository-complete first playable Monster Master candidate/);
  assert.match(agents, /planning\/monster-master-rules\.md/);
  assert.match(agents, /planning\/browser-journey-matrix\.md/);
  assert.match(agents, /Use the separate `visual-review` label/);

  assert.match(matrix, /Capture numbers are globally unique/);
  assert.match(matrix, /30\. Monster Master — bounded draw at round 24/);
  assert.match(matrix, /Attack action .* Covered and visually reviewed before and after submission/);
  assert.match(matrix, /Defeat .* ordinary defeated monster .* Covered and visually reviewed/);
  assert.match(matrix, /Round cap .* round 24/);
  assert.match(matrix, /Stale revision .* Covered directly for Monster Master deployment/);

  assert.match(checkpoint, /Canonical Validation run #98 \(`30570248841`\)/);
  assert.match(checkpoint, /visual-review run #102 \(`30585215731`\)/);
  assert.match(checkpoint, /30 public-safe synthetic screenshots/);
  assert.match(checkpoint, /draw completion now occurs at the end of round 24/i);
  assert.match(checkpoint, /This checkpoint does not claim:/);

  assert.match(html, /Battlefield actions, targets, and resolved outcomes appear here\./);
  assert.match(html, /<details id="monster-master-invite-panel"/);
  assert.doesNotMatch(html, /Deploy your roster into the highlighted starting zone\./);

  for (const capture of [
    "19-monster-master-lobby-desktop",
    "20-monster-master-lobby-mobile",
    "21-monster-master-deployment",
    "22-monster-master-combat-activation",
    "23-monster-master-move-options",
    "24-monster-master-attack-targeting",
    "25-monster-master-attack-result",
    "26-monster-master-mend-targeting",
    "27-monster-master-mend-result",
    "28-monster-master-defeat",
    "29-monster-master-victory",
    "30-monster-master-draw",
  ]) {
    assert.match(visual, new RegExp(capture));
  }
  assert.match(visual, /avoidMasterAttacks: true/);
  assert.match(visual, /prepared\.observation\.round\)\.toBe\(24\)/);
  assert.doesNotMatch(visual, /18-monster-master-lobby-desktop/);

  assert.match(navigation, /returns from Monster Master through the universal destination bar/);
  assert.match(navigation, /opens and closes Monster Master diagnostics/);
  assert.match(inviteDisclosure, /keeps the local Monster Master invite available without expanding it over gameplay/);
  assert.match(inviteDisclosure, /not\.toHaveAttribute\("open"/);
});
