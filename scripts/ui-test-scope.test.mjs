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

test("Cascade browser input and presentation changes do not run the solver/persona profile", () => {
  assert.deepEqual(classifyUiTestScope([
    "public/cascade-runtime-v2.js",
    "public/cascade-input.js",
    "public/cascade-bonus-modes.js",
    "public/cascade-polish.css",
    "test/browser/cascade-mobile-scroll.spec.mjs",
  ]), { ...none, cascadeUi: true });
});

test("Cascade analysis tools and methodology changes add the profile gate", () => {
  assert.deepEqual(classifyUiTestScope([
    "scripts/cascade-profile-compare.mjs",
    "scripts/cascade-persona-calibrate.mjs",
    "scripts/cascade-fragility.mjs",
    "scripts/cascade-playtest-analyze.mjs",
    "planning/cascade-testing-methodology.md",
  ]), { ...none, cascadeProfile: true });
});

test("Cascade simulator and game mechanics changes add the profile gate", () => {
  assert.deepEqual(classifyUiTestScope([
    "src/games/cascade/cascade-engine.test.mjs",
  ]), { ...none, cascadeUi: true, cascadeProfile: true });
});

test("Cascade telemetry stays separate from the solver/persona profile", () => {
  assert.deepEqual(classifyUiTestScope([
    "public/cascade.html",
    "public/cascade-telemetry-sync.js",
    "src/cloudflare/cascade-telemetry-object-runtime.test.ts",
  ]), { ...none, cascadeUi: true, cascadeTelemetry: true });
});

test("Cascade diagnostics use telemetry contracts while lifecycle UI still gets browser coverage", () => {
  assert.deepEqual(classifyUiTestScope([
    "public/cascade-diagnostics-sync.js",
    "public/cascade-lifecycle-diagnostics.js",
    "src/cloudflare/cascade-diagnostics-object-runtime.ts",
    "src/cloudflare/cascade-diagnostics-edge.test.ts",
    "test/browser/cascade-render-lifecycle.spec.mjs",
  ]), { ...none, cascadeUi: true, cascadeTelemetry: true });
});

test("Cascade progression sync stays in the player-platform lane", () => {
  assert.deepEqual(classifyUiTestScope(["public/cascade-progression-sync.js"]), {
    ...none,
    playerPlatform: true,
  });
});

test("Othello and its shared-nav integration route through the shell lane", () => {
  assert.deepEqual(classifyUiTestScope([
    "public/othello-fidelity-app-4.js",
    "public/othello-bake4-neon.css",
    "public/gameframe-nav-integrations.css",
    "test/browser/othello.spec.mjs",
  ]), { ...none, shell: true });
});

test("family authentication UI and edge changes route through the shell lane", () => {
  assert.deepEqual(classifyUiTestScope([
    "public/family-admin.js",
    "public/family-sign-in.js",
    "src/cloudflare/family-auth-edge.ts",
    "test/browser/family-admin.spec.mjs",
  ]), { ...none, shell: true });
});

test("Monster Master changes stay in the Monster Master lane", () => {
  assert.deepEqual(classifyUiTestScope([
    "src/browser/monster-master-pixi-entry.js",
    "public/monster-master.js",
  ]), { ...none, monsterMaster: true });
});

test("RPG browser and provider changes do not run the Monster Master Arena lane", () => {
  assert.deepEqual(classifyUiTestScope([
    "public/monster-master-rpg-shell-guards.js",
    "public/monster-master-rpg-world.js",
    "test/browser/monster-master-rpg-world.spec.mjs",
    "test/rpg-integration/monster-master-rpg-pell-inspection.provider.mjs",
    "playwright.rpg-provider-integration.config.mjs",
  ]), none);
});

test("Monster Master assets run the Monster Master verification lane", () => {
  assert.deepEqual(classifyUiTestScope([
    "public/assets/monster-master/manifest.json",
    "public/assets/monster-master/trainers/master-trainer-v1-128.webp",
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
