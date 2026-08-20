import assert from "node:assert/strict";
import test from "node:test";

import {
  BOARD_SIZE,
  FULL_SPECIAL_RULES,
  SPECIAL,
  createRng,
  emptySpecials,
  resolveSpecialCascades,
} from "../../../public/cascade-special-engine-unlocked.js";

function boardWithSingleFourMatch() {
  const board = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
    const row = Math.floor(index / BOARD_SIZE);
    const col = index % BOARD_SIZE;
    return (row * 2 + col) % 6;
  });
  board[0] = 1;
  board[1] = 1;
  board[2] = 1;
  board[3] = 1;
  return board;
}

test("Cascade unlocked adapter enables every special rule from the first level", () => {
  assert.deepEqual(FULL_SPECIAL_RULES, {
    stripe: true,
    bomb: true,
    color: true,
  });

  const result = resolveSpecialCascades(
    boardWithSingleFourMatch(),
    emptySpecials(),
    createRng(12345),
    {
      // A caller can still supply the legacy first-level lock. The adapter must
      // override it so campaign level never controls special availability.
      rules: { stripe: false, bomb: false, color: false },
    },
  );

  assert.ok(result.specialCreatedCount >= 1);
  assert.ok(result.specials.some((value) => value === SPECIAL.STRIPE_H || value === SPECIAL.STRIPE_V));
});
