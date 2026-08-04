import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const read = (path: string) => readFile(new URL(path, `file://${repositoryRoot}/`), "utf8");

test("MM-0001 remains separate, deterministic, and bounded", async () => {
  const rules = await read("src/games/monster-master/index.ts");
  const contract = await read("planning/monster-master-rules.md");

  assert.match(rules, /MONSTER_MASTER_GAME_ID = "monster-master-duel"/);
  assert.match(rules, /phase: "deployment"/);
  assert.match(rules, /type: "deploy-unit"/);
  assert.match(rules, /type: "use-ability"/);
  assert.match(rules, /abilityId: "mend"/);
  assert.match(rules, /commandByPlayer/);
  assert.match(rules, /completeIfOpponentEliminated/);
  assert.match(rules, /state\.board\.units\.some\(\(unit\) => unit\.ownerId === defeatedOwnerId\)/);
  assert.match(rules, /DeterministicMonsterMasterPlayer/);
  assert.doesNotMatch(rules, /Math\.random/);
  assert.doesNotMatch(rules, /canvas|viewport|animation|sprite/i);
  assert.doesNotMatch(rules, /dungeons?\s*&\s*dragons|d&d/i);

  assert.match(contract, /separate game definition/i);
  assert.match(contract, /deployment phase/i);
  assert.match(contract, /Command energy/i);
  assert.match(contract, /Mend ability/i);
  assert.match(contract, /wins only after every opposing unit has been defeated/i);
  assert.match(contract, /Warden Master does not end the duel/i);
  assert.match(contract, /D&D-style system should use its own rules definition/i);
  assert.match(contract, /Explicitly outside MM-0001/i);
});
