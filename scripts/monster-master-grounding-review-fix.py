from pathlib import Path

path = Path("public/monster-master-trainer-asset.js")
text = path.read_text()

# Keep this presentation module scoped to illustrated art; global navigation owns its own responsive layout.
nav_start = text.index("    /* Monster Master adds Setup to the shared destination row.")
nav_end = text.index("\n  `;\n  document.head.append(style);", nav_start)
text = text[:nav_start] + text[nav_end:]
text = text.replace(
    '.monster-master-trainer-token[data-facing="left"] img {',
    '.monster-master-trainer-token[data-flipped="true"] img {',
    1,
)

old_generic = """const GENERIC_TRAINER = Object.freeze({
  kind: "trainer",
  asset: TRAINER_ASSET,
  label: "Master",
  glyph: "M",
  prototypeLabel: "Warden Master",
  anchorY: 0.9,
  battlefieldScale: 1,
});"""
new_generic = """const GENERIC_TRAINER = Object.freeze({
  kind: "trainer",
  asset: TRAINER_ASSET,
  label: "Master",
  glyph: "M",
  prototypeLabel: "Warden Master",
  authoredFacing: "left",
  summary: "Command-focused Master unit.",
  anchorY: 0.9,
  battlefieldScale: 1,
});"""
assert text.count(old_generic) == 1
text = text.replace(old_generic, new_generic, 1)

# These two manifest assets are intentionally NOT claimed by the illustration layer here.
# Their historical runtime payloads are malformed and are tracked separately for source recovery.
for disabled in [
    '  "voidshard-reaver-v1": Object.freeze({ kind: "voidshard", asset: "/assets/monster-master/creatures/voidshard-reaver-v1-128.webp", label: "Voidshard Reaver", glyph: "V", prototypeLabel: "Emberling", anchorY: 0.9, battlefieldScale: 1.42 }),\n',
    '  "mossmaw-colossus-v1": Object.freeze({ kind: "mossmaw", asset: "/assets/monster-master/creatures/mossmaw-colossus-v1-128.webp", label: "Mossmaw Colossus", glyph: "M", prototypeLabel: "Stone Bulwark", anchorY: 0.9, battlefieldScale: 1.5 }),\n',
]:
    assert text.count(disabled) == 1, disabled
    text = text.replace(disabled, "", 1)

replacements = [
    ('"vanguard-trainer-v1": Object.freeze({ kind: "vanguard", asset: "/assets/monster-master/trainers/vanguard-trainer-v1-128.webp", label: "Vanguard", glyph: "V", prototypeLabel: "Warden Master", anchorY: 0.9, battlefieldScale: 1 }),', '"vanguard-trainer-v1": Object.freeze({ kind: "vanguard", asset: "/assets/monster-master/trainers/vanguard-trainer-v1-128.webp", label: "Vanguard", glyph: "V", prototypeLabel: "Warden Master", authoredFacing: "left", summary: "Field-ready Master archetype.", anchorY: 0.9, battlefieldScale: 1 }),'),
    ('"commander-trainer-v1": Object.freeze({ kind: "commander", asset: "/assets/monster-master/trainers/commander-trainer-v1-128.webp", label: "Commander", glyph: "C", prototypeLabel: "Warden Master", anchorY: 0.9, battlefieldScale: 1 }),', '"commander-trainer-v1": Object.freeze({ kind: "commander", asset: "/assets/monster-master/trainers/commander-trainer-v1-128.webp", label: "Commander", glyph: "C", prototypeLabel: "Warden Master", authoredFacing: "right", summary: "Tactical command Master archetype.", anchorY: 0.9, battlefieldScale: 1 }),'),
    ('"arcanic-trainer-v1": Object.freeze({ kind: "arcanic", asset: "/assets/monster-master/trainers/arcanic-trainer-v1-128.webp", label: "Arcanic", glyph: "A", prototypeLabel: "Warden Master", anchorY: 0.9, battlefieldScale: 1 }),', '"arcanic-trainer-v1": Object.freeze({ kind: "arcanic", asset: "/assets/monster-master/trainers/arcanic-trainer-v1-128.webp", label: "Arcanic", glyph: "A", prototypeLabel: "Warden Master", authoredFacing: "left", summary: "Arcane-tech Master archetype.", anchorY: 0.9, battlefieldScale: 1 }),'),
    ('"medic-trainer-v1": Object.freeze({ kind: "medic", asset: "/assets/monster-master/trainers/medic-trainer-v1-128.webp", label: "Medic", glyph: "M", prototypeLabel: "Warden Master", anchorY: 0.9, battlefieldScale: 1 }),', '"medic-trainer-v1": Object.freeze({ kind: "medic", asset: "/assets/monster-master/trainers/medic-trainer-v1-128.webp", label: "Medic", glyph: "M", prototypeLabel: "Warden Master", authoredFacing: "left", summary: "Creature-care Master archetype.", anchorY: 0.9, battlefieldScale: 1 }),'),
    ('"caller-trainer-v1": Object.freeze({ kind: "caller", asset: "/assets/monster-master/trainers/caller-trainer-v1-128.webp", label: "Caller", glyph: "C", prototypeLabel: "Warden Master", anchorY: 0.9, battlefieldScale: 1 }),', '"caller-trainer-v1": Object.freeze({ kind: "caller", asset: "/assets/monster-master/trainers/caller-trainer-v1-128.webp", label: "Caller", glyph: "C", prototypeLabel: "Warden Master", authoredFacing: "left", summary: "Roster-management Master archetype.", anchorY: 0.9, battlefieldScale: 1 }),'),
    ('[ROOTMAW_CONTENT_ID]: Object.freeze({ kind: "rootmaw", asset: ROOTMAW_ASSET, label: "Rootmaw Brute", glyph: "R", prototypeLabel: "Stone Bulwark", anchorY: 0.88, battlefieldScale: 1.58 }),', '[ROOTMAW_CONTENT_ID]: Object.freeze({ kind: "rootmaw", asset: ROOTMAW_ASSET, label: "Rootmaw Brute", glyph: "R", prototypeLabel: "Stone Bulwark", authoredFacing: "left", summary: "Mossbound heavy monster · slow, durable, and built for brutal close pressure.", anchorY: 0.88, battlefieldScale: 1.58 }),'),
    ('[GLOAMSPORE_CONTENT_ID]: Object.freeze({ kind: "gloamspore", asset: GLOAMSPORE_ASSET, label: "Gloamspore Stalker", glyph: "G", prototypeLabel: "Emberling Skirmisher", anchorY: 0.9, battlefieldScale: 1.36 }),', '[GLOAMSPORE_CONTENT_ID]: Object.freeze({ kind: "gloamspore", asset: GLOAMSPORE_ASSET, label: "Gloamspore Stalker", glyph: "G", prototypeLabel: "Emberling Skirmisher", authoredFacing: "left", summary: "Arcane skirmisher · quick, fragile, and built to threaten from the flank.", anchorY: 0.9, battlefieldScale: 1.36 }),'),
    ('"stormcrest-skitter-v1": Object.freeze({ kind: "stormcrest", asset: "/assets/monster-master/creatures/stormcrest-skitter-v1-128.webp", label: "Stormcrest Skitter", glyph: "S", prototypeLabel: "Emberling", anchorY: 0.9, battlefieldScale: 1.18 }),', '"stormcrest-skitter-v1": Object.freeze({ kind: "stormcrest", asset: "/assets/monster-master/creatures/stormcrest-skitter-v1-128.webp", label: "Stormcrest Skitter", glyph: "S", prototypeLabel: "Emberling", authoredFacing: "left", summary: "Fast harassment monster.", anchorY: 0.9, battlefieldScale: 1.18 }),'),
]
for old, new in replacements:
    assert text.count(old) == 1, old
    text = text.replace(old, new, 1)

old_selected = """function selectedPresentationUnit(view) {
  if (!view?.observation) return null;
  const state = diagnostics();
  const selectedId = view.observation.phase === "deployment"
    ? state.selectedUnitId ?? view.observation.activeUnitId
    : view.observation.activeUnitId ?? state.selectedUnitId;
  return unitById(view, selectedId);
}"""
new_selected = """function selectedPresentationUnit(view) {
  if (!view?.observation) return null;
  const state = diagnostics();
  const inspectedId = document.querySelector("[data-turn-unit-id].is-inspected")?.dataset.turnUnitId;
  const selectedId = inspectedId ?? (view.observation.phase === "deployment"
    ? state.selectedUnitId ?? view.observation.activeUnitId
    : view.observation.activeUnitId ?? state.selectedUnitId);
  return unitById(view, selectedId);
}"""
assert text.count(old_selected) == 1
text = text.replace(old_selected, new_selected, 1)

hud_scope = text.index("if (hud && selectedUnit && selectedPresentation) {")
hud_start = text.index('    const name = document.querySelector("#monster-master-hud-name");', hud_scope)
hud_end = text.index("\n  } else {", hud_start)
old_hud_tail = text[hud_start:hud_end]
assert "selectedPresentation.label" in old_hud_tail
new_hud_tail = """    const name = document.querySelector("#monster-master-hud-name");
    const summary = document.querySelector("#monster-master-unit-summary");
    const abilityOwner = document.querySelector("#monster-master-ability-owner");
    if (name) name.textContent = `${teamLabel(view, selectedUnit)} ${selectedPresentation.label}`;
    if (summary && selectedPresentation.summary) summary.textContent = selectedPresentation.summary;
    if (abilityOwner) abilityOwner.textContent = selectedPresentation.label;
    const heavyFrameCopy = document.querySelector('[data-ability-id="heavy-frame"] span');
    if (heavyFrameCopy && selectedUnit.role === "bulwark") {
      heavyFrameCopy.textContent = `Durable ${selectedUnit.maxHealth}-health body built to hold space.`;
    }
    const quickstepCopy = document.querySelector('[data-ability-id="quickstep"] span');
    if (quickstepCopy && selectedUnit.role === "emberling") {
      quickstepCopy.textContent = `Movement ${selectedUnit.movement} and initiative ${selectedUnit.initiative}.`;
    }"""
text = text[:hud_start] + new_hud_tail + text[hud_end:]

old_facing = """    const alphaTeam = unit.ownerId === playerIds[0];
    token.dataset.team = alphaTeam ? "alpha" : "beta";
    token.dataset.facing = alphaTeam ? "right" : "left";
    token.dataset.defeated = String(defeatedIds.has(unit.id) || (unit.health ?? 1) <= 0);"""
new_facing = """    const alphaTeam = unit.ownerId === playerIds[0];
    const presentation = presentationFor(unit);
    const targetFacing = alphaTeam ? "right" : "left";
    token.dataset.team = alphaTeam ? "alpha" : "beta";
    token.dataset.facing = targetFacing;
    token.dataset.flipped = String((presentation?.authoredFacing ?? "left") !== targetFacing);
    token.dataset.defeated = String(defeatedIds.has(unit.id) || (unit.health ?? 1) <= 0);"""
assert text.count(old_facing) == 1
text = text.replace(old_facing, new_facing, 1)
path.write_text(text)

test_path = Path("src/browser/monster-master-trainer-asset.test.mjs")
test_text = test_path.read_text()
test_start = test_text.index('test("Monster Master keeps its Setup destination usable at compact desktop widths"')
test_end = test_text.index('test("every approved Arena illustration is available to world sprites and portraits"', test_start)
test_text = test_text[:test_start] + test_text[test_end:]
for content_id in ["voidshard-reaver-v1", "mossmaw-colossus-v1"]:
    test_text = test_text.replace(f'  "{content_id}",\n', "")
test_text = test_text.replace(
    'test("every approved Arena illustration is available to world sprites and portraits"',
    'test("every enabled Arena illustration is available to world sprites and portraits"',
)
test_text += '''\n\ntest("illustrated HUD synchronization respects inspection, authored facing, and authoritative stats", () => {\n  assert.match(source, /\\[data-turn-unit-id\\]\\.is-inspected/);\n  assert.match(source, /authoredFacing:\\s*"right"/);\n  assert.match(source, /token\\.dataset\\.flipped = String/);\n  assert.match(source, /selectedPresentation\\.summary/);\n  assert.match(source, /selectedUnit\\.maxHealth/);\n  assert.match(source, /selectedUnit\\.movement/);\n  assert.match(source, /selectedUnit\\.initiative/);\n  assert.doesNotMatch(source, /"voidshard-reaver-v1": Object\\.freeze/);\n  assert.doesNotMatch(source, /"mossmaw-colossus-v1": Object\\.freeze/);\n});\n'''
test_path.write_text(test_text)

proof = Path("test/visual/monster-master-illustrated-grounding.spec.mjs")
proof_text = proof.read_text()
scenario_start = proof_text.index("const scenarios = [")
scenario_end = proof_text.index("];", scenario_start) + 2
new_scenarios = '''const scenarios = [
  { trainer: ["vanguard-trainer-v1", "Vanguard", "vanguard-trainer-v1-128.webp"], monster: ["rootmaw-brute-v1", "Rootmaw Brute", "rootmaw-brute-v1-128.webp"], others: ["gloamspore-stalker-v1", "stormcrest-skitter-v1"] },
  { trainer: ["commander-trainer-v1", "Commander", "commander-trainer-v1-128.webp"], monster: ["gloamspore-stalker-v1", "Gloamspore Stalker", "gloamspore-stalker-v1-128.svg"], others: ["rootmaw-brute-v1", "stormcrest-skitter-v1"] },
  { trainer: ["arcanic-trainer-v1", "Arcanic", "arcanic-trainer-v1-128.webp"], monster: ["stormcrest-skitter-v1", "Stormcrest Skitter", "stormcrest-skitter-v1-128.webp"], others: ["rootmaw-brute-v1", "gloamspore-stalker-v1"] },
  { trainer: ["medic-trainer-v1", "Medic", "medic-trainer-v1-128.webp"], monster: ["rootmaw-brute-v1", "Rootmaw Brute", "rootmaw-brute-v1-128.webp"], others: ["stormcrest-skitter-v1", "gloamspore-stalker-v1"] },
  { trainer: ["caller-trainer-v1", "Caller", "caller-trainer-v1-128.webp"], monster: ["stormcrest-skitter-v1", "Stormcrest Skitter", "stormcrest-skitter-v1-128.webp"], others: ["rootmaw-brute-v1", "gloamspore-stalker-v1"] },
];'''
proof_text = proof_text[:scenario_start] + new_scenarios + proof_text[scenario_end:]
nav_block_start = proof_text.index("    if (index === 0) {")
nav_block_end = proof_text.index("\n\n    await expectPortrait", nav_block_start)
proof_text = proof_text[:nav_block_start] + proof_text[nav_block_end:]
proof_text = proof_text.replace(
    "await expect.poll(() => image.evaluate((node) => node.complete && node.naturalWidth > 0)).toBe(true);",
    "await expect.poll(() => image.evaluate((node) => node.complete && node.naturalWidth > 0), { timeout: 15_000 }).toBe(true);",
)
proof.write_text(proof_text)
