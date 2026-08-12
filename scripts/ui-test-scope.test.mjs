import test from "node:test";
import assert from "node:assert/strict";
import { classifyUiTestScope } from "./ui-test-scope.mjs";

const none = {
  shell: false,
  casual: false,
  cascadeUi: false,
  cascadeProfile: false,
  cascadeTelemetry: false,
  monsterMaster: false,
  playerPlatform: false,
};

test("Casual Games changes stay in the Casual Games lane", () => {
  assert.deepEqual(classifyUiTestScope([
    "public/casual-games.html",
    "public/casual-games.js",
    "test/visual/casual-games-destination.spec.mjs",
  ]), { ...none, casual: true });
});

test("Cascade browser input and presentation changes do not run the 300-level profile", () => {
  assert.deepEqual(classifyUiTestScope([
    "public/cascade-runtime-v2.js",
    "public/cascade-input.js",
    "public/cascade-bonus-modes.js",
    "public/cascade-polish.css",
    "test/browser/cascade-mobile-scroll.spec.mjs",
  ]), { ...none, cascadeUi: true });
});

test("Cascade simulator and game mechanics changes add the profile gate", () => {
  assert.deepEqual(classifyUiTestScope([
    "src/games/cascade/cascade-engine.test.mjs",
  ]), { ...none, cascadeUi: true, cascadeProfile: true });
});

test("Cascade telemetry stays separate from the 300-level profile", () => {
  assert.deepEqual(classifyUiTestScope([
    "public/cascade.html",
    "public/cascade-telemetry-sync.js",
    "src/cloudflare/cascade-telemetry-object-runtime.test.ts",
  ]), { ...none, cascadeUi: true, cascadeTelemetry: true });
});

test("Cascade progression sync stays in the player-platform lane", () => {
  assert.deepEqual(classifyUiTestScope(["public/cascade-progression-sync.js"]), {
    ...none,
    playerPlatform: true,
  });
});

test("Monster Master changes stay in the Monster Master lane", () => {
  assert.deepEqual(classifyUiTestScope([
    "public/monster-master-rpg-world.js",
    "src/browser/monster-master-pixi-entry.js",
    "test/browser/monster-master-rpg-world.spec.mjs",
  ]), { ...none, monsterMaster: true });
});

test("player progression changes activate only player-platform coverage", () => {
  assert.deepEqual(classifyUiTestScope([
    "src/cloudflare/player-progression.ts",
    "public/leaderboard-app.js",
  ]), { ...none, playerPlatform: true });
});

test("shared shell changes activate the shell lane without game profiles", () => {
  assert.deepEqual(classifyUiTestScope([
    "public/game-hub.js",
    "public/styles.css",
  ]), { ...none, shell: true });
});

test("Playwright configuration fans out only to browser UI lanes", () => {
  assert.deepEqual(classifyUiTestScope(["playwright.config.mjs"]), {
    ...none,
    shell: true,
    casual: true,
    cascadeUi: true,
    monsterMaster: true,
    playerPlatform: true,
  });
});

test("package and CI-router edits do not masquerade as product changes", () => {
  assert.deepEqual(classifyUiTestScope([
    "package.json",
    "package-lock.json",
    ".github/workflows/player-ui-review.yml",
    "scripts/ui-test-scope.mjs",
    "scripts/ui-test-scope.test.mjs",
  ]), none);
});