export function selectEvenlySpaced(items, requestedCount) {
  const values = Array.from(items || []);
  const count = Math.max(0, Math.floor(Number(requestedCount) || 0));
  if (!count || count >= values.length) return values;
  if (count === 1) return [values[0]];

  const selected = [];
  const seen = new Set();
  for (let slot = 0; slot < count; slot += 1) {
    const index = Math.round((slot * (values.length - 1)) / (count - 1));
    if (seen.has(index)) continue;
    seen.add(index);
    selected.push(values[index]);
  }
  return selected;
}

export function selectContiguousShard(items, shardIndex, shardCount) {
  const values = Array.from(items || []);
  const count = Math.floor(Number(shardCount));
  const index = Math.floor(Number(shardIndex));
  if (!Number.isInteger(count) || count < 1) throw new Error("shard-count must be a positive integer");
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new Error(`shard-index must be between 0 and ${count - 1}`);
  }

  const start = Math.floor((values.length * index) / count);
  const end = Math.floor((values.length * (index + 1)) / count);
  return values.slice(start, end);
}
