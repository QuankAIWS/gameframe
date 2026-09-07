import assert from "node:assert/strict";
import test from "node:test";
import {
  applySpiderMove,
  canDealSpiderStock,
  canMoveSpiderSequence,
  createSpiderDeck,
  createSpiderState,
  dealSpiderStock,
  listSpiderMoves,
  movableSequenceStarts,
  settleSpiderRuns,
  validateSpiderState,
} from "./engine.js";

function card(id, suit, rank, faceUp = true) {
  return { id, suit, rank, faceUp };
}

function makeSyntheticState({ tableau, stock = [], completedRuns = [], moveCount = 0 }) {
  const accounted = tableau.flat().length + stock.length + completedRuns.length * 13;
  const filler = [];
  for (let index = accounted; index < 104; index += 1) {
    filler.push(card(`filler-${index}`, "clubs", 1, false));
  }
  const paddedTableau = tableau.map((column) => [...column]);
  paddedTableau[9].unshift(...filler);
  return {
    version: 1,
    gameId: "spider-solitaire",
    seed: "synthetic",
    difficulty: 4,
    tableau: paddedTableau,
    stock: [...stock],
    completedRuns,
    moveCount,
    status: completedRuns.length === 8 ? "won" : "playing",
  };
}

test("difficulty deck composition always creates 104 cards", () => {
  const one = createSpiderDeck(1);
  const two = createSpiderDeck(2);
  const four = createSpiderDeck(4);
  assert.equal(one.length, 104);
  assert.equal(two.length, 104);
  assert.equal(four.length, 104);
  assert.deepEqual([...new Set(one.map((item) => item.suit))], ["spades"]);
  assert.deepEqual([...new Set(two.map((item) => item.suit))], ["spades", "hearts"]);
  assert.deepEqual([...new Set(four.map((item) => item.suit))].sort(), ["clubs", "diamonds", "hearts", "spades"]);
});

test("seeded initial deals are deterministic and use the standard 54/50 split", () => {
  const left = createSpiderState({ difficulty: 4, seed: "same-deal" });
  const right = createSpiderState({ difficulty: 4, seed: "same-deal" });
  const different = createSpiderState({ difficulty: 4, seed: "another-deal" });
  assert.deepEqual(left, right);
  assert.notDeepEqual(left.tableau, different.tableau);
  assert.deepEqual(left.tableau.map((column) => column.length), [6, 6, 6, 6, 5, 5, 5, 5, 5, 5]);
  assert.equal(left.stock.length, 50);
  assert.equal(left.tableau.flat().filter((item) => item.faceUp).length, 10);
  assert.equal(validateSpiderState(left), true);
});

test("only face-up descending same-suit suffixes are movable as a stack", () => {
  const column = [
    card("down", "spades", 10, false),
    card("nine", "spades", 9),
    card("eight", "spades", 8),
    card("seven-heart", "hearts", 7),
  ];
  assert.deepEqual(movableSequenceStarts(column), [3]);
  const sameSuit = [card("nine", "spades", 9), card("eight", "spades", 8), card("seven", "spades", 7)];
  assert.deepEqual(movableSequenceStarts(sameSuit), [0, 1, 2]);
});

test("a stack may land on an empty column or a card exactly one rank higher regardless of suit", () => {
  const tableau = Array.from({ length: 10 }, () => []);
  tableau[0] = [card("nine", "spades", 9), card("eight", "spades", 8)];
  tableau[1] = [card("ten-heart", "hearts", 10)];
  tableau[2] = [card("jack", "clubs", 11)];
  const state = makeSyntheticState({ tableau });
  assert.equal(canMoveSpiderSequence(state, 0, 0, 1), true);
  assert.equal(canMoveSpiderSequence(state, 0, 0, 2), false);
  assert.equal(canMoveSpiderSequence(state, 0, 0, 3), true);
});

test("moving a stack exposes and flips the source top card", () => {
  const tableau = Array.from({ length: 10 }, () => []);
  tableau[0] = [card("hidden-ten", "clubs", 10, false), card("nine", "spades", 9)];
  tableau[1] = [card("ten-heart", "hearts", 10)];
  const state = makeSyntheticState({ tableau });
  const next = applySpiderMove(state, { type: "move", fromColumn: 0, startIndex: 1, toColumn: 1 });
  assert.equal(next.tableau[0][0].faceUp, true);
  assert.equal(next.moveCount, 1);
});

test("stock dealing is blocked by empty columns and otherwise deals one face-up card to every column", () => {
  const state = createSpiderState({ difficulty: 1, seed: "stock-test" });
  assert.equal(canDealSpiderStock(state), true);
  const dealt = dealSpiderStock(state);
  assert.equal(dealt.stock.length, 40);
  assert.deepEqual(dealt.tableau.map((column) => column.length), [7, 7, 7, 7, 6, 6, 6, 6, 6, 6]);
  assert.equal(dealt.tableau.every((column) => column.at(-1).faceUp), true);

  const blocked = structuredClone(state);
  const removed = blocked.tableau[0];
  blocked.tableau[0] = [];
  blocked.tableau[1].unshift(...removed);
  assert.equal(canDealSpiderStock(blocked), false);
  assert.throws(() => dealSpiderStock(blocked), /Fill every empty column/);
});

test("a same-suit K-to-A top run is collected automatically and exposes the card below it", () => {
  const run = [];
  for (let rank = 13; rank >= 1; rank -= 1) run.push(card(`spade-${rank}`, "spades", rank));
  const tableau = Array.from({ length: 10 }, () => []);
  tableau[0] = [card("covered", "hearts", 4, false), ...run];
  const state = makeSyntheticState({ tableau });
  const settled = settleSpiderRuns(state);
  assert.equal(settled.completedRuns.length, 1);
  assert.equal(settled.completedRuns[0], "spades");
  assert.equal(settled.tableau[0].length, 1);
  assert.equal(settled.tableau[0][0].faceUp, true);
});

test("legal move enumeration emits only actions accepted by the move validator", () => {
  const state = createSpiderState({ difficulty: 2, seed: "legal-enumeration" });
  const moves = listSpiderMoves(state);
  assert.ok(moves.length > 0);
  for (const move of moves) {
    assert.equal(canMoveSpiderSequence(state, move.fromColumn, move.startIndex, move.toColumn), true);
  }
});
