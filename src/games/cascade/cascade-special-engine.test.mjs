import test from "node:test";
import assert from "node:assert/strict";
import {
  SPECIAL,
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
