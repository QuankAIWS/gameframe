import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const read = (path: string) => readFile(join(repositoryRoot, path), "utf8");

test("TC-0002 combat remains deterministic, bounded, and projection-independent", async () => {
  const requiredFiles = [
    "src/games/tactical-combat/index.ts",
    "src/games/tactical-combat/index.test.ts",
    "planning/tactical-combat-contract.md",
    "planning/tactical-core-contract.md",
    "planning/tactical-canvas-canary.md",
  ];
  for (const path of requiredFiles) {
    const content = await read(path);
    assert.ok(content.trim().length > 40, `${path} must contain durable TC-0002 content.`);
  }

  const combat = await read("src/games/tactical-combat/index.ts");
  assert.match(combat, /TACTICAL_COMBAT_GAME_ID = "tactical-combat-canary"/);
  assert.match(combat, /initiative: number/);
  assert.match(combat, /movementUsed: boolean/);
  assert.match(combat, /primaryActionUsed: boolean/);
  assert.match(combat, /tacticalCombatLineOfSight/);
  assert.match(combat, /listTacticalAttackActions/);
  assert.match(combat, /unit-damaged/);
  assert.match(combat, /unit-defeated/);
  assert.match(combat, /combat-completed/);
  assert.match(combat, /DeterministicTacticalCombatPlayer/);
  assert.doesNotMatch(combat, /Math\.random|camera|viewport|canvas/i);

  const contract = await read("planning/tactical-combat-contract.md");
  assert.match(contract, /one movement opportunity/i);
  assert.match(contract, /one primary-action opportunity/i);
  assert.match(contract, /shared row, shared column, or exact 45-degree diagonal/i);
  assert.match(contract, /Every legal attack hits/);
  assert.match(contract, /Explicitly deferred/);
  assert.match(contract, /Reactions, opportunity attacks, and overwatch/);
});
