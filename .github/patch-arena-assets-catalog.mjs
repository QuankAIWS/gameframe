import{readFile,writeFile}from"node:fs/promises";const p="public/monster-master-trainer-asset.js";let t=await readFile(p,"utf8");const a="function specialCreature(unit) {\n  return unit?.contentId ? SPECIAL_CREATURES[unit.contentId] ?? null : null;\n}";const b=`const ARENA_LIBRARY_ASSETS = Object.freeze({
  "vanguard-trainer-v1": { kind: "vanguard", asset: "/assets/monster-master/trainers/vanguard-trainer-v1-128.webp", label: "Vanguard", glyph: "V", summary: "Field-ready Master archetype.", prototypeLabel: "Warden Master" },
  "commander-trainer-v1": { kind: "commander", asset: "/assets/monster-master/trainers/commander-trainer-v1-128.webp", label: "Commander", glyph: "C", summary: "Tactical command Master archetype.", prototypeLabel: "Warden Master" },
  "arcanic-trainer-v1": { kind: "arcanic", asset: "/assets/monster-master/trainers/arcanic-trainer-v1-128.webp", label: "Arcanic", glyph: "A", summary: "Arcane-tech Master archetype.", prototypeLabel: "Warden Master" },
  "medic-trainer-v1": { kind: "medic", asset: "/assets/monster-master/trainers/medic-trainer-v1-128.webp", label: "Medic", glyph: "M", summary: "Creature-care Master archetype.", prototypeLabel: "Warden Master" },
  "caller-trainer-v1": { kind: "caller", asset: "/assets/monster-master/trainers/caller-trainer-v1-128.webp", label: "Caller", glyph: "C", summary: "Roster-management Master archetype.", prototypeLabel: "Warden Master" },
  "voidshard-reaver-v1": { kind: "voidshard", asset: "/assets/monster-master/creatures/voidshard-reaver-v1-128.webp", label: "Voidshard Reaver", glyph: "V", summary: "Mobile melee striker.", prototypeLabel: "Emberling" },
  "stormcrest-skitter-v1": { kind: "stormcrest", asset: "/assets/monster-master/creatures/stormcrest-skitter-v1-128.webp", label: "Stormcrest Skitter", glyph: "S", summary: "Fast harassment monster.", prototypeLabel: "Emberling" },
  "mossmaw-colossus-v1": { kind: "mossmaw", asset: "/assets/monster-master/creatures/mossmaw-colossus-v1-128.webp", label: "Mossmaw Colossus", glyph: "M", summary: "Slow durable anchor.", prototypeLabel: "Stone Bulwark" },
});

function specialCreature(unit) {
  if (!unit?.contentId) return null;
  return SPECIAL_CREATURES[unit.contentId] ?? ARENA_LIBRARY_ASSETS[unit.contentId] ?? null;
}`;if(!t.includes(a))throw new Error("catalog anchor missing");t=t.replace(a,b);t=t.replace("Object.values(SPECIAL_CREATURES).find((item) => item.kind === kind)","Object.values({ ...SPECIAL_CREATURES, ...ARENA_LIBRARY_ASSETS }).find((item) => item.kind === kind)");t=t.replace("for (const path of [TRAINER_ASSET, ROOTMAW_ASSET, GLOAMSPORE_ASSET]) {","for (const path of [TRAINER_ASSET, ROOTMAW_ASSET, GLOAMSPORE_ASSET, ...Object.values(ARENA_LIBRARY_ASSETS).map((item) => item.asset)]) {");await writeFile(p,t);