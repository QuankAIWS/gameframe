import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { InMemoryMatchSnapshotStore } from "../../platform/match-store.ts";
import { MonsterMasterMatchService } from "../../server/monster-master-match-service.ts";
import {
  createMonsterMasterArenaState,
  GLOAMSPORE_STALKER_CONTENT_ID,
  isMonsterMasterArenaState,
  MONSTER_MASTER_ARENA_MONSTER_SLOTS,
  monsterMasterArenaDefinition,
  ROOTMAW_BRUTE_CONTENT_ID,
} from "./arena-definition.ts";
import {
  createMonsterMasterState,
  monsterMasterUnit,
  type MonsterMasterAction,
  type MonsterMasterState,
} from "./index.ts";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const file = (path: string) => new URL(path, `file://${repositoryRoot}/`);
const read = (path: string) => readFile(file(path), "utf8");
const readBytes = (path: string) => readFile(file(path));

function applyArenaAction(
  state: MonsterMasterState,
  playerId: string,
  action: MonsterMasterAction,
): MonsterMasterState {
  return monsterMasterArenaDefinition.applyAction(state, playerId, action).state;
}

function deployArena(): MonsterMasterState {
  let state = createMonsterMasterArenaState(["alpha", "beta"]);
  while (state.phase === "deployment") {
    const playerId = monsterMasterArenaDefinition.getActivePlayerId(state);
    assert.ok(playerId);
    const action = monsterMasterArenaDefinition.listLegalActions(state, playerId)
      .find((candidate) => candidate.type === "deploy-unit");
    assert.ok(action);
    state = applyArenaAction(state, playerId, action);
  }
  return state;
}

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

test("standalone Arena profile fields one embodied Master plus three distinct monsters per player", () => {
  const state = createMonsterMasterArenaState(["alpha", "beta"]);
  const prototypeState = createMonsterMasterState(["alpha", "beta"]);
  assert.equal(isMonsterMasterArenaState(state), true);
  assert.equal(state.undeployedUnitIds.length, 8);

  for (const playerId of state.playerIds) {
    const roster = state.rosters[playerId];
    const prototypeEmberling = prototypeState.rosters[playerId].find((unit) => unit.role === "emberling");
    assert.ok(prototypeEmberling);
    assert.equal(roster.filter((unit) => unit.role === "master").length, 1);
    assert.equal(roster.filter((unit) => unit.role !== "master").length, MONSTER_MASTER_ARENA_MONSTER_SLOTS);

    const gloamspore = roster.find((unit) => unit.contentId === GLOAMSPORE_STALKER_CONTENT_ID);
    assert.ok(gloamspore);
    assert.equal(gloamspore.role, "emberling");
    assert.equal(gloamspore.movement, prototypeEmberling.movement);
    assert.equal(gloamspore.initiative, prototypeEmberling.initiative);
    assert.equal(gloamspore.maxHealth, prototypeEmberling.maxHealth);
    assert.equal(gloamspore.attackRange, prototypeEmberling.attackRange);
    assert.equal(gloamspore.attackDamage, prototypeEmberling.attackDamage);
    assert.deepEqual(gloamspore.abilityIds, prototypeEmberling.abilityIds);
    assert.ok(gloamspore.tags?.includes("arena-monster-slot-2"));
    assert.equal(roster.some((unit) => unit.contentId === "emberling-skirmisher-v1"), false);

    const rootmaw = roster.find((unit) => unit.contentId === ROOTMAW_BRUTE_CONTENT_ID);
    assert.ok(rootmaw);
    assert.equal(rootmaw.role, "bulwark");
    assert.equal(rootmaw.movement, 3);
    assert.equal(rootmaw.initiative, 4);
    assert.equal(rootmaw.maxHealth, 16);
    assert.equal(rootmaw.attackRange, 1);
    assert.equal(rootmaw.attackDamage, 5);
  }
});

test("Rootmaw Brute master art is registered and delivered as an Arena runtime asset", async () => {
  const manifest = JSON.parse(await read("public/assets/monster-master/manifest.json"));
  const runtime = await read("public/monster-master-trainer-asset.js");
  const asset = await readBytes("public/assets/monster-master/creatures/rootmaw-brute-v1-128.webp");

  assert.ok(manifest.sources.includes("approved-rootmaw-brute-isometric-master-v1"));
  assert.equal(manifest.creatures[ROOTMAW_BRUTE_CONTENT_ID].label, "Rootmaw Brute");
  assert.equal(
    manifest.creatures[ROOTMAW_BRUTE_CONTENT_ID].path,
    "/assets/monster-master/creatures/rootmaw-brute-v1-128.webp",
  );
  assert.equal(manifest.creatures[ROOTMAW_BRUTE_CONTENT_ID].usage, "standalone-arena");
  assert.match(runtime, /ROOTMAW_ASSET = "\/assets\/monster-master\/creatures\/rootmaw-brute-v1-128\.webp"/);
  assert.match(runtime, /ROOTMAW_CONTENT_ID = "rootmaw-brute-v1"/);
  assert.match(runtime, /Rootmaw Brute/);
  assert.equal(asset.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(asset.subarray(8, 12).toString("ascii"), "WEBP");
});

test("Gloamspore Stalker master art is registered and delivered as an Arena runtime asset", async () => {
  const manifest = JSON.parse(await read("public/assets/monster-master/manifest.json"));
  const runtime = await read("public/monster-master-trainer-asset.js");
  const asset = await read("public/assets/monster-master/creatures/gloamspore-stalker-v1-128.svg");

  assert.ok(manifest.sources.includes("approved-gloamspore-stalker-isometric-master-v1"));
  assert.equal(manifest.creatures[GLOAMSPORE_STALKER_CONTENT_ID].label, "Gloamspore Stalker");
  assert.equal(
    manifest.creatures[GLOAMSPORE_STALKER_CONTENT_ID].path,
    "/assets/monster-master/creatures/gloamspore-stalker-v1-128.svg",
  );
  assert.equal(manifest.creatures[GLOAMSPORE_STALKER_CONTENT_ID].usage, "standalone-arena");
  assert.match(runtime, /GLOAMSPORE_ASSET = "\/assets\/monster-master\/creatures\/gloamspore-stalker-v1-128\.svg"/);
  assert.match(runtime, /GLOAMSPORE_CONTENT_ID = "gloamspore-stalker-v1"/);
  assert.match(runtime, /Gloamspore Stalker/);
  assert.match(asset, /^<svg/);
  assert.match(asset, /width="128" height="192"/);
  assert.match(asset, /data:image\/webp;base64,/);
});

test("Stormcrest Skitter is a Class One unassigned asset-library creature", async () => {
  const manifest = JSON.parse(await read("public/assets/monster-master/manifest.json"));
  const asset = await readBytes("public/assets/monster-master/creatures/stormcrest-skitter-v1-128.webp");
  const stormcrest = manifest.creatures["stormcrest-skitter-v1"];

  assert.ok(manifest.sources.includes("approved-stormcrest-skitter-class-one-isometric-master-v1"));
  assert.equal(stormcrest.label, "Stormcrest Skitter");
  assert.equal(stormcrest.class, 1);
  assert.equal(stormcrest.classLabel, "Class One");
  assert.equal(stormcrest.path, "/assets/monster-master/creatures/stormcrest-skitter-v1-128.webp");
  assert.equal(stormcrest.width, 128);
  assert.equal(stormcrest.height, 192);
  assert.equal(stormcrest.alpha, true);
  assert.equal(stormcrest.usage, "asset-library");
  assert.equal(stormcrest.assignment, "unassigned");
  assert.equal(stormcrest.facing, "left");
  assert.equal(stormcrest.perspective, "three-quarter-down-isometric");
  assert.equal(Object.hasOwn(stormcrest, "role"), false);
  assert.equal(asset.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(asset.subarray(8, 12).toString("ascii"), "WEBP");
});

test("standalone Arena enters combat after all eight combatants deploy", () => {
  const state = deployArena();
  assert.equal(state.phase, "combat");
  assert.equal(state.board.units.length, 8);
  assert.equal(state.undeployedUnitIds.length, 0);
  assert.equal(state.activationOrder.length, 8);
});

test("standalone Arena ends when the opposing Master falls even while monsters survive", () => {
  let state = deployArena();
  const alphaMaster = monsterMasterUnit(state, "alpha-master");
  const betaMaster = monsterMasterUnit(state, "beta-master");
  alphaMaster.position = { x: 8, y: 8 };
  betaMaster.position = { x: 11, y: 8 };
  betaMaster.health = alphaMaster.attackDamage;
  state.activationOrder = ["alpha-master", ...state.activationOrder.filter((unitId) => unitId !== "alpha-master")];
  state.activeActivationIndex = 0;
  state.movementUsed = false;
  state.primaryActionUsed = false;
  state.lastEffects = [];

  assert.equal(state.board.units.filter((unit) => unit.ownerId === "beta" && unit.role !== "master").length, 3);
  const attack = monsterMasterArenaDefinition.listLegalActions(state, "alpha")
    .find((candidate) => candidate.type === "attack" && candidate.targetUnitId === "beta-master");
  assert.ok(attack);
  state = applyArenaAction(state, "alpha", attack);

  assert.equal(state.winnerPlayerId, "alpha");
  assert.equal(monsterMasterArenaDefinition.getStatus(state).lifecycle, "completed");
  assert.equal(state.board.units.some((unit) => unit.id === "beta-master"), false);
  assert.equal(state.board.units.filter((unit) => unit.ownerId === "beta").length, 3);
  assert.deepEqual(state.lastEffects.map((effect) => effect.type), [
    "unit-damaged",
    "unit-defeated",
    "duel-completed",
  ]);
});

test("configured Monster Master states keep the base roster and do not opt into Arena rules", async () => {
  const service = new MonsterMasterMatchService({
    store: new InMemoryMatchSnapshotStore<MonsterMasterState, MonsterMasterAction>(),
    idGenerator: () => "required-contract-id",
  });
  const configured = createMonsterMasterState(["alpha", "beta"]);
  const created = await service.createMatch(["alpha", "beta"], "configured-contract", configured);

  assert.equal(created.observation.undeployedUnitIds.length, 6);
  assert.equal(isMonsterMasterArenaState(configured), false);
  assert.deepEqual(created.observation.rosters.alpha.map((unit) => unit.role), ["master", "bulwark", "emberling"]);

  const reloaded = await service.view(created.matchId, "alpha");
  assert.equal(reloaded.observation.undeployedUnitIds.length, 6);
});
