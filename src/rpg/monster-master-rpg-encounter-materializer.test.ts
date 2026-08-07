import assert from "node:assert/strict";
import test from "node:test";

import { GAMEFRAME_BOT_PLAYER_ID } from "../agents/gameframe-bot.ts";
import {
  materializeMonsterMasterRpgEncounter,
  MonsterMasterRpgEncounterConfigurationError,
} from "./monster-master-rpg-encounter-materializer.ts";

const playerSeatId = "rpg-team:encounter-one";

function configuredInput() {
  return {
    matchPlayerIds: [playerSeatId, GAMEFRAME_BOT_PLAYER_ID] as const,
    playerTeamId: "team:keepers",
    oppositionTeamId: "team:rivals",
    participants: [
      {
        participantId: "trainer:ada",
        controller: { kind: "player", playerId: "player:ada" },
        teamId: "team:keepers",
        rulesState: { creatureIds: ["creature:emberling:ada"] },
      },
      {
        participantId: "trainer:bryn",
        controller: { kind: "player", playerId: "player:bryn" },
        teamId: "team:keepers",
        rulesState: { creatureIds: ["creature:bulwark:bryn"] },
      },
      {
        participantId: "trainer:rival",
        controller: { kind: "runtime" },
        teamId: "team:rivals",
        rulesState: {
          creatureIds: ["creature:bulwark:rival", "creature:emberling:rival"],
        },
      },
    ],
    objectives: [
      {
        objectiveId: "objective:defeat-rival",
        kind: "defeat",
        rules: { targetTeamId: "team:rivals" },
      },
    ],
    difficulty: {
      id: "normal",
      encounterPressure: "standard",
      enemyTacticalIntensity: "competent",
      defeatConsequences: "consequential",
      characterDeathRisk: "real",
      recoverySupport: "standard",
    },
    battlefield: {
      theme: "monster-master-academy-gate",
      environmentTags: ["rain", "stone", "academy"],
      layoutHint: "compact-duel",
      assetIds: ["battlefield:academy-gate:v1"],
    },
  };
}

test("materializes exact participant creature identities into revision-zero tactical rosters", () => {
  const materialized = materializeMonsterMasterRpgEncounter(configuredInput());

  assert.deepEqual(materialized.teamUnitIds, {
    "team:keepers": ["creature:emberling:ada", "creature:bulwark:bryn"],
    "team:rivals": ["creature:bulwark:rival", "creature:emberling:rival"],
  });
  assert.deepEqual(materialized.participantUnitIds, {
    "trainer:ada": ["creature:emberling:ada"],
    "trainer:bryn": ["creature:bulwark:bryn"],
    "trainer:rival": ["creature:bulwark:rival", "creature:emberling:rival"],
  });

  const state = materialized.initialState;
  assert.deepEqual(state.playerIds, [playerSeatId, GAMEFRAME_BOT_PLAYER_ID]);
  assert.equal(state.phase, "deployment");
  assert.deepEqual(state.board.units, []);
  assert.deepEqual(state.undeployedUnitIds, [
    "creature:emberling:ada",
    "creature:bulwark:bryn",
    "creature:bulwark:rival",
    "creature:emberling:rival",
  ]);
  assert.deepEqual(
    state.rosters[playerSeatId].map((unit) => ({ id: unit.id, role: unit.role, contentId: unit.contentId })),
    [
      {
        id: "creature:emberling:ada",
        role: "emberling",
        contentId: "emberling-skirmisher-v1",
      },
      {
        id: "creature:bulwark:bryn",
        role: "bulwark",
        contentId: "stone-bulwark-v1",
      },
    ],
  );
  assert.deepEqual(
    state.rosters[GAMEFRAME_BOT_PLAYER_ID].map((unit) => ({
      id: unit.id,
      role: unit.role,
      contentId: unit.contentId,
    })),
    [
      {
        id: "creature:bulwark:rival",
        role: "bulwark",
        contentId: "stone-bulwark-v1",
      },
      {
        id: "creature:emberling:rival",
        role: "emberling",
        contentId: "emberling-skirmisher-v1",
      },
    ],
  );
  assert.equal(
    Object.values(state.rosters).flat().some((unit) => unit.role === "master"),
    false,
    "trainers must remain controllers rather than being materialized as creature units",
  );
});

test("fails closed on unsupported creature species and combat rules instead of substituting defaults", () => {
  const unknownCreature = configuredInput();
  unknownCreature.participants[0]!.rulesState = { creatureIds: ["creature:unknown:ada"] };
  assert.throws(
    () => materializeMonsterMasterRpgEncounter(unknownCreature),
    (error: unknown) => error instanceof MonsterMasterRpgEncounterConfigurationError
      && error.code === "unsupported-encounter-configuration"
      && /no implemented tactical species profile/.test(error.message),
  );

  const unsupportedRules = configuredInput();
  unsupportedRules.participants[0]!.rulesState = {
    creatureIds: ["creature:emberling:ada"],
    criticalHitChance: 0.5,
  } as never;
  assert.throws(
    () => materializeMonsterMasterRpgEncounter(unsupportedRules),
    /unsupported combat configuration: criticalHitChance/,
  );

  const unsupportedMap = configuredInput();
  unsupportedMap.battlefield = { mapId: "custom-map-that-is-not-implemented" } as never;
  assert.throws(
    () => materializeMonsterMasterRpgEncounter(unsupportedMap),
    /battlefield contains unsupported combat configuration: mapId/,
  );
});

test("rejects duplicate, oversized, and asymmetric tactical rosters", () => {
  const duplicate = configuredInput();
  duplicate.participants[1]!.rulesState = { creatureIds: ["creature:emberling:ada"] };
  assert.throws(
    () => materializeMonsterMasterRpgEncounter(duplicate),
    /assigned more than once/,
  );

  const oversized = configuredInput();
  oversized.participants[0]!.rulesState = {
    creatureIds: [
      "creature:emberling:ada-1",
      "creature:emberling:ada-2",
      "creature:bulwark:ada-3",
    ],
  };
  oversized.participants[1]!.rulesState = { creatureIds: ["creature:bulwark:bryn"] };
  assert.throws(
    () => materializeMonsterMasterRpgEncounter(oversized),
    /must materialize from 1 through 3 supported creatures/,
  );

  const asymmetric = configuredInput();
  asymmetric.participants[2]!.rulesState = { creatureIds: ["creature:bulwark:rival"] };
  assert.throws(
    () => materializeMonsterMasterRpgEncounter(asymmetric),
    /requires equal tactical creature counts/,
  );
});
