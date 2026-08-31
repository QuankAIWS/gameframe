import test from "node:test";
import assert from "node:assert/strict";
import { changedLevelRange, isCascadeBalanceSemanticFile } from "./cascade-ci-plan.mjs";

const level = (number, moves = 30) => ({ level: number, moves });

test("changed level planning adds a 30-level seam around an edited range", () => {
  const base = Array.from({ length: 100 }, (_, index) => level(index + 1));
  const head = structuredClone(base);
  head[49].moves = 31;
  head[59].moves = 32;

  assert.deepEqual(changedLevelRange(base, head), {
    changed: true,
    changedLevelCount: 2,
    profileFrom: 20,
    profileTo: 90,
  });
});

test("additive null objective fields do not mark old levels as semantically changed", () => {
  const base = [{ level: 1, objective: { collect: [] } }];
  const head = [{ level: 1, objective: { collect: [], producers: null, colorWards: undefined } }];
  assert.deepEqual(changedLevelRange(base, head), {
    changed: false,
    changedLevelCount: 0,
    profileFrom: 1,
    profileTo: 1,
  });
});

test("campaign growth profiles the new tail plus the historical seam", () => {
  const base = Array.from({ length: 900 }, (_, index) => level(index + 1));
  const head = Array.from({ length: 1000 }, (_, index) => level(index + 1));

  assert.deepEqual(changedLevelRange(base, head), {
    changed: true,
    changedLevelCount: 100,
    profileFrom: 871,
    profileTo: 1000,
  });
});

test("unchanged generated definitions do not request a deep profile", () => {
  const base = [level(1), level(2)];
  assert.deepEqual(changedLevelRange(base, structuredClone(base)), {
    changed: false,
    changedLevelCount: 0,
    profileFrom: 1,
    profileTo: 2,
  });
});

test("balance semantic classification excludes presentation and test-only edits", () => {
  assert.equal(isCascadeBalanceSemanticFile("public/cascade-engine.js"), true);
  assert.equal(isCascadeBalanceSemanticFile("public/cascade-special-engine.js"), true);
  assert.equal(isCascadeBalanceSemanticFile("src/games/cascade/cascade-simulator.js"), true);
  assert.equal(isCascadeBalanceSemanticFile("public/cascade-runtime-v2.js"), false);
  assert.equal(isCascadeBalanceSemanticFile("src/games/cascade/cascade-engine.test.mjs"), false);
});
