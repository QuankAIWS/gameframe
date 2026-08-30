import test from "node:test";
import assert from "node:assert/strict";
import {
  SPECIAL,
  applySpecialHammer,
  applySpecialSwap,
  createRng,
  emptySpecials,
  findSpecialMatchGroups,
  resolveSpecialCascades,
} from "../../../public/cascade-special-engine.js";

function stableBoard() {
  return Array.from({ length: 64 }, (_, index) => {
    const row = Math.floor(index / 8);
    const col = index % 8;
    return (row + col * 2) % 6;
  });
}

test("match four creates a persistent striped piece instead of detonating immediately", () => {
  const board = stableBoard();
  board.splice(0, 8, 0, 0, 0, 0, 1, 2, 3, 4);
  const result = resolveSpecialCascades(board, emptySpecials(), createRng(11), {
    from: 0,
    to: 1,
    rules: { stripe: true, bomb: true, color: true },
  });

  assert.equal(result.transitions[0].createdSpecials.length, 1);
  assert.equal(result.transitions[0].createdSpecials[0].special, SPECIAL.STRIPE_H);
  assert.ok(result.specials.includes(SPECIAL.STRIPE_H));
});

test("the tile transformed into a special still counts for collection and chips its ice", () => {
  const board = stableBoard();
  board.splice(0, 8, 0, 0, 0, 0, 1, 2, 3, 4);
  const ice = Array(64).fill(0);
  ice[1] = 1;
  const result = resolveSpecialCascades(board, emptySpecials(), createRng(111), {
    from: 0,
    to: 1,
    ice,
    rules: { stripe: true, bomb: true, color: true },
  });

  assert.equal(result.transitions[0].createdSpecials[0].index, 1);
  assert.equal(result.transitions[0].iceAfter[1], 0);
  assert.equal(result.transitions[0].clearedKindCounts[0], 4);
});

test("T or L intersections create a persistent bomb", () => {
  const board = stableBoard();
  board[25] = 0;
  board[26] = 0;
  board[27] = 0;
  board[18] = 0;
  board[34] = 0;
  const result = resolveSpecialCascades(board, emptySpecials(), createRng(12), {
    from: 25,
    to: 26,
    rules: { stripe: true, bomb: true, color: true },
  });

  assert.ok(result.transitions[0].createdSpecials.some((creation) => creation.special === SPECIAL.BOMB));
  assert.ok(result.specials.includes(SPECIAL.BOMB));
});

test("match five creates a persistent color clearer", () => {
  const board = stableBoard();
  board.splice(0, 8, 0, 0, 0, 0, 0, 2, 3, 4);
  const result = resolveSpecialCascades(board, emptySpecials(), createRng(13), {
    from: 0,
    to: 2,
    rules: { stripe: true, bomb: true, color: true },
  });

  assert.equal(result.transitions[0].createdSpecials[0].special, SPECIAL.COLOR);
  assert.ok(result.specials.includes(SPECIAL.COLOR));
});

test("a saved color clearer never participates in an ordinary color match", () => {
  const board = stableBoard();
  const specials = emptySpecials();
  board[0] = 2;
  board[1] = 2;
  board[2] = 2;
  specials[1] = SPECIAL.COLOR;

  assert.equal(findSpecialMatchGroups(board, specials).length, 0);
});

test("special creation can be disabled for the opening teaching level", () => {
  const board = stableBoard();
  board.splice(0, 8, 0, 0, 0, 0, 1, 2, 3, 4);
  const result = resolveSpecialCascades(board, emptySpecials(), createRng(14), {
    rules: { stripe: false, bomb: false, color: false },
  });
  assert.equal(result.transitions[0].createdSpecials.length, 0);
  assert.equal(result.specials.some(Boolean), false);
});

test("adjacent stripes combine even when the swap does not make an ordinary match", () => {
  const board = stableBoard();
  const specials = emptySpecials();
  specials[0] = SPECIAL.STRIPE_H;
  specials[1] = SPECIAL.STRIPE_V;
  const result = applySpecialSwap(board, specials, 0, 1, createRng(15), {
    rules: { stripe: true, bomb: true, color: true },
  });

  assert.equal(result.legal, true);
  assert.equal(result.transitions[0].combo, "stripe+stripe");
  assert.ok(result.transitions[0].matched.length >= 15);
});

test("color clearer swapped with a normal tile sweeps that tile color", () => {
  const board = stableBoard();
  const specials = emptySpecials();
  specials[0] = SPECIAL.COLOR;
  const targetKind = board[1];
  const countBefore = board.filter((kind) => kind === targetKind).length;
  const result = applySpecialSwap(board, specials, 0, 1, createRng(16), {
    rules: { stripe: true, bomb: true, color: true },
  });

  assert.equal(result.legal, true);
  assert.equal(result.transitions[0].combo, "color");
  assert.ok(result.transitions[0].matched.length >= countBefore);
});

test("hammer chips exactly one ice layer without clearing the protected candy", () => {
  const board = stableBoard();
  const specials = emptySpecials();
  const ice = Array(64).fill(0);
  ice[9] = 2;
  const protectedKind = board[9];
  specials[9] = SPECIAL.STRIPE_H;

  const result = applySpecialHammer(board, specials, 9, createRng(17), { ice });

  assert.equal(result.legal, true);
  assert.equal(result.ice[9], 1);
  assert.equal(result.board[9], protectedKind);
  assert.equal(result.specials[9], SPECIAL.STRIPE_H);
  assert.equal(result.iceHitCount, 1);
  assert.equal(result.transitions[0].iceHits[0].before, 2);
  assert.equal(result.transitions[0].iceHits[0].after, 1);
  assert.deepEqual(result.clearedKindCounts, Array(6).fill(0));
});

test("hammer clears exposed candy normally once no ice remains", () => {
  const board = stableBoard();
  const kind = board[9];
  const result = applySpecialHammer(board, emptySpecials(), 9, createRng(18), {
    ice: Array(64).fill(0),
  });

  assert.equal(result.legal, true);
  assert.equal(result.iceHitCount, 0);
  assert.equal(result.clearedKindCounts[kind], 1);
  assert.equal(result.transitions[0].matched.includes(9), true);
});


test("a caged candy cannot be swapped until its cage opens", () => {
  const board = stableBoard();
  const locks = {
    total: 1,
    opened: 0,
    layers: Array(64).fill(0),
    requiredKinds: Array(64).fill(-1),
    recall: false,
  };
  locks.layers[9] = 1;

  const result = applySpecialSwap(board, emptySpecials(), 9, 10, createRng(28), {
    locks,
    rules: { stripe: true, bomb: true, color: true, fish: true },
  });

  assert.equal(result.legal, false);
  assert.equal(result.reason, "locked");
  assert.equal(result.locks.layers[9], 1);
});

test("ordinary cages absorb a direct special hit before the candy can clear", () => {
  const board = stableBoard();
  const original = board[9];
  const locks = {
    total: 1,
    opened: 0,
    layers: Array(64).fill(0),
    requiredKinds: Array(64).fill(-1),
    recall: false,
  };
  locks.layers[9] = 1;

  const result = resolveSpecialCascades(board, emptySpecials(), createRng(29), {
    locks,
    forced: { kind: "test-lock-hit", indices: [9], colorTarget: null },
    rules: { stripe: true, bomb: true, color: true, fish: true },
  });

  assert.equal(result.transitions[0].lockHits.length, 1);
  assert.equal(result.transitions[0].matched.includes(9), false);
  assert.equal(result.locks.layers[9], 0);
  assert.equal(result.transitions[0].cleared[9], original);
});

test("Recall Locks open only from the remembered adjacent color", () => {
  const board = stableBoard();
  const locks = {
    total: 1,
    opened: 0,
    layers: Array(64).fill(0),
    requiredKinds: Array(64).fill(-1),
    recall: true,
  };
  locks.layers[9] = 1;
  board[8] = 2;
  board[10] = 3;
  locks.requiredKinds[9] = 2;

  const wrong = resolveSpecialCascades(board, emptySpecials(), createRng(30), {
    locks,
    forced: { kind: "wrong-recall-color", indices: [10], colorTarget: null },
    rules: { stripe: true, bomb: true, color: true, fish: true },
  });
  assert.equal(wrong.locks.layers[9], 1);
  assert.equal(wrong.transitions[0].lockHits.length, 0);

  const right = resolveSpecialCascades(board, emptySpecials(), createRng(31), {
    locks,
    forced: { kind: "right-recall-color", indices: [8], colorTarget: null },
    rules: { stripe: true, bomb: true, color: true, fish: true },
  });
  assert.equal(right.locks.layers[9], 0);
  assert.equal(right.transitions[0].lockHits.length, 1);
  assert.equal(right.transitions[0].lockHits[0].requiredKind, 2);
});

test("a 2x2 square creates a persistent Butterfly when the homing rule is active", () => {
  const board = stableBoard();
  board[0] = 0;
  board[1] = 0;
  board[8] = 0;
  board[9] = 0;
  const result = resolveSpecialCascades(board, emptySpecials(), createRng(31), {
    from: 0,
    to: 1,
    rules: { stripe: true, bomb: true, color: true, fish: true },
  });

  assert.ok(result.transitions[0].createdSpecials.some((creation) => creation.special === SPECIAL.FISH));
  assert.ok(result.specials.includes(SPECIAL.FISH));
});

test("Butterfly chooses a seeded random useful objective target without ranking deeper ice first", () => {
  const board = stableBoard();
  const specials = emptySpecials();
  const ice = Array(64).fill(0);
  specials[0] = SPECIAL.FISH;
  ice[10] = 2;
  ice[63] = 1;

  const result = applySpecialHammer(board, specials, 0, createRng(12288), {
    ice,
    rules: { stripe: true, bomb: true, color: true, fish: true },
  });

  assert.equal(result.legal, true);
  assert.ok(result.transitions[0].matched.includes(63));
  assert.equal(result.transitions[0].matched.includes(10), false);
  assert.ok(result.transitions[0].iceHits.some((hit) => hit.index === 63));
  assert.equal(result.transitions[0].iceHits.some((hit) => hit.index === 10), false);
  assert.ok(result.transitions[0].triggeredSpecials.some((trigger) => trigger.special === SPECIAL.FISH));
});

test("Butterfly never falls back to generic cells while direct objective targets remain", () => {
  const board = stableBoard();
  const ice = Array(64).fill(0);
  ice[10] = 1;
  ice[63] = 1;

  for (const seed of [1, 2, 3, 4, 5, 77, 12288]) {
    const specials = emptySpecials();
    specials[0] = SPECIAL.FISH;
    const result = applySpecialHammer(board, specials, 0, createRng(seed), {
      ice,
      rules: { stripe: true, bomb: true, color: true, fish: true },
    });
    const trigger = result.transitions[0].triggeredSpecials.find((item) => item.special === SPECIAL.FISH);
    assert.ok(trigger);
    assert.equal(trigger.cleared.length, 1);
    assert.ok([10, 63].includes(trigger.cleared[0]));
  }
});

test("Butterfly treats a drop support cell as a useful objective target", () => {
  const board = stableBoard();
  const specials = emptySpecials();
  specials[0] = SPECIAL.FISH;

  const result = applySpecialHammer(board, specials, 0, createRng(77), {
    targetIndices: [63],
    rules: { stripe: true, bomb: true, color: true, fish: true },
  });

  assert.equal(result.legal, true);
  assert.ok(result.transitions[0].matched.includes(63));
  assert.ok(result.transitions[0].triggeredSpecials.some((trigger) => trigger.special === SPECIAL.FISH));
});

test("Butterfly combo targeting uses the seeded random useful target", () => {
  const board = stableBoard();
  const specials = emptySpecials();
  const ice = Array(64).fill(0);
  specials[0] = SPECIAL.FISH;
  specials[1] = SPECIAL.BOMB;
  ice[10] = 2;
  ice[63] = 1;

  const result = applySpecialSwap(board, specials, 0, 1, createRng(12288), {
    ice,
    rules: { stripe: true, bomb: true, color: true, fish: true },
  });

  assert.equal(result.legal, true);
  assert.equal(result.transitions[0].combo, "fish+bomb");
  assert.ok(result.transitions[0].iceHits.some((hit) => hit.index === 63));
  assert.equal(result.transitions[0].iceHits.some((hit) => hit.index === 10), false);
});

test("Butterfly plus Butterfly sends three seeded random hits toward useful objectives", () => {
  const board = stableBoard();
  const specials = emptySpecials();
  const ice = Array(64).fill(0);
  specials[0] = SPECIAL.FISH;
  specials[1] = SPECIAL.FISH;
  ice[55] = 1;
  ice[62] = 1;
  ice[63] = 1;

  const result = applySpecialSwap(board, specials, 0, 1, createRng(33), {
    ice,
    rules: { stripe: true, bomb: true, color: true, fish: true },
  });

  assert.equal(result.legal, true);
  assert.equal(result.transitions[0].combo, "fish+fish");
  assert.equal(result.ice.filter((layers) => layers > 0).length, 0);
});
