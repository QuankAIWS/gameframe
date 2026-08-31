import test from "node:test";
import assert from "node:assert/strict";
import { selectContiguousShard, selectEvenlySpaced } from "./cascade-profile-selection.mjs";

test("even sampling keeps endpoints and stays deterministic", () => {
  const values = Array.from({ length: 10 }, (_, index) => index + 1);
  assert.deepEqual(selectEvenlySpaced(values, 4), [1, 4, 7, 10]);
  assert.deepEqual(selectEvenlySpaced(values, 4), [1, 4, 7, 10]);
});

test("even sampling leaves short ranges intact", () => {
  assert.deepEqual(selectEvenlySpaced([1, 2, 3], 8), [1, 2, 3]);
  assert.deepEqual(selectEvenlySpaced([1, 2, 3], 0), [1, 2, 3]);
});

test("contiguous shards cover the whole range without overlap", () => {
  const values = Array.from({ length: 10 }, (_, index) => index + 1);
  const shards = Array.from({ length: 4 }, (_, index) => selectContiguousShard(values, index, 4));
  assert.deepEqual(shards, [[1, 2], [3, 4, 5], [6, 7], [8, 9, 10]]);
  assert.deepEqual(shards.flat(), values);
});

test("invalid shard coordinates fail closed", () => {
  assert.throws(() => selectContiguousShard([1, 2], -1, 4));
  assert.throws(() => selectContiguousShard([1, 2], 4, 4));
  assert.throws(() => selectContiguousShard([1, 2], 0, 0));
});
