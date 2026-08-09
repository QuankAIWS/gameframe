import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../../../${path}`, import.meta.url), "utf8");

test("MM-0001 repository checkpoint remains complete and evidence-aligned", async () => {
  const [
    readme,
    roadmap,
    agents,
    rules,
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
    read("planning/monster-master-rules.md"),
    read("planning/browser-journey-matrix.md"),
    read("planning/validation/2026-07-30-monster-master-first-playable.md"),
    read("public/monster-master.html"),
    read("test/visual/monster-master-curated-visual.spec.mjs"),
    read("test/browser/monster-master-navigation.spec.mjs"),
    read("test/browser/monster-master-invite-disclosure.spec.mjs"),
  ]);

  assert.match(readme, /### Monster Master Arena Battles/);
  assert.match(readme, /Separate `monster-master-duel` game definition/);
  assert.match(readme, /configured encounter restoration/);
  assert.match(readme, /Human-versus-Monster-Master-BattleBot/);
  assert.match(readme, /bounded draws/);
  assert.match(readme, /\/monster-master\.html/);
  assert.match(readme, /src\/games\//);

  assert.match(roadmap, /MM-0001 remains standalone\/regression substrate and the seed for Monster Master Arena Battles/);
  assert.match(roadmap, /Monster Master Arena Battles/);
  assert.match(roadmap, /## GF-RPG-06 — FIGHT foundation: Monster Master rules\/control authority/);
  assert.match(roadmap, /class-defined monster deployment\/control limits/);
  assert.match(roadmap, /## GF-RPG-07 — FIGHT: same-map Tactical Activation/);
  assert.match(roadmap, /current positions become tactical starting positions/);
  assert.match(roadmap, /No replacement campaign battlefield and no Return-to-Campaign navigation/);
  assert.match(roadmap, /## GF-RPG-12 — Dynamic Battle Simulator/);
  assert.match(roadmap, /ruleset equivalence with campaign Tactical Mode/);

  assert.match(agents, /GameFrameBot.*stable player ID `gameframe-bot`/s);
  assert.match(agents, /Monster Master BattleBot/);
  assert.match(agents, /planning\/monster-master-rules\.md/);
  assert.match(agents, /Use the separate visual-review lane/);
  assert.match(agents, /Node-local encounter adapter supports cooperative campaign players on one allied team/);
  assert.match(agents, /VM-first durable RPG path persists the encounter-to-match binding/);
  assert.match(agents, /`participantUnitIds` now records the exact campaign participant→tactical creature assignment/);
  assert.match(agents, /Emberling and Bulwark creature profiles/);
  assert.match(agents, /asymmetric tactical roster sizes fail closed/);
  assert.doesNotMatch(agents, /supports exactly one human campaign player/);

  assert.match(rules, /The implemented `monster-master-rpg` path is:/);
  assert.match(rules, /validated RPG encounter `rulesState\.creatureIds`/);
  assert.match(rules, /trainers remain RPG encounter participants\/controllers/);
  assert.match(rules, /both sides must currently contain the same number of creatures/);
  assert.match(rules, /`participantUnitIds` persists exact participant→creature assignment/);

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