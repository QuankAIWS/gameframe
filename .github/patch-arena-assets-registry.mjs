import {readFile,writeFile} from"node:fs/promises";
const p="public/monster-master-trainer-asset.js";
let t=await readFile(p,"utf8");
function r(a,b){if(!t.includes(a))throw new Error("missing anchor");t=t.replace(a,b)}
r("const SPECIAL_CREATURES = Object.freeze({","const SPECIAL_CREATURES = {");
r("  }),\n});\n\nfunction specialCreature(unit) {","  }),\n};\n\nfunction specialCreature(unit) {");
r("function assetKind(unit) {\n  if (unit && unit.role === \"master\") return \"trainer\";\n  return specialCreature(unit)?.kind ?? null;\n}\n\nfunction assetPath(kind) {\n  if (kind === \"rootmaw\") return ROOTMAW_ASSET;\n  if (kind === \"gloamspore\") return GLOAMSPORE_ASSET;\n  return TRAINER_ASSET;\n}","function assetKind(unit) {\n  return specialCreature(unit)?.kind ?? (unit?.role === \"master\" ? \"trainer\" : null);\n}\n\nfunction assetPath(kind) {\n  return Object.values(SPECIAL_CREATURES).find((item) => item.kind === kind)?.asset ?? TRAINER_ASSET;\n}");
await writeFile(p,t);