import { readFile } from "node:fs/promises";

function readNumberFlag(name, fallback) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const files = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
if (files.length < 2) {
  console.error("Usage: node scripts/cascade-profile-compare.mjs <baseline.json> <candidate.json> [--threshold=0.17]");
  process.exit(2);
}

const [baselinePath, candidatePath] = files;
const threshold = Math.max(0, readNumberFlag("threshold", 0.17));
const [baseline, candidate] = await Promise.all([
  readFile(baselinePath, "utf8").then(JSON.parse),
  readFile(candidatePath, "utf8").then(JSON.parse),
]);

if (baseline.seedBase !== candidate.seedBase) {
  console.error(`Seed base mismatch: baseline ${baseline.seedBase} vs candidate ${candidate.seedBase}`);
  process.exit(2);
}
if (baseline.runsPerLevel !== candidate.runsPerLevel || baseline.humanRunsPerLevel !== candidate.humanRunsPerLevel) {
  console.error("Run-count mismatch; paired comparison requires identical solver and human-persona sample counts.");
  process.exit(2);
}

const baseLevels = new Map((baseline.levels || []).map((level) => [level.level, level]));
const rows = [];
for (const level of candidate.levels || []) {
  const before = baseLevels.get(level.level);
  if (!before) continue;
  const strategies = [...new Set([
    ...Object.keys(before.strategies || {}),
    ...Object.keys(level.strategies || {}),
  ])];
  const deltas = {};
  for (const strategy of strategies) {
    const a = before.strategies?.[strategy]?.winRate;
    const b = level.strategies?.[strategy]?.winRate;
    if (Number.isFinite(a) && Number.isFinite(b)) deltas[strategy] = b - a;
  }
  rows.push({
    level: level.level,
    chapter: level.chapter,
    difficulty: level.difficulty,
    deltas,
  });
}

const metric = (row) => Math.max(
  Math.abs(row.deltas["human-skilled"] || 0),
  Math.abs(row.deltas["human-casual"] || 0),
  Math.abs(row.deltas.lookahead || 0),
);
const changed = rows.filter((row) => metric(row) >= threshold)
  .sort((a, b) => metric(b) - metric(a) || a.level - b.level);
const percentPoint = (value) => `${value >= 0 ? "+" : ""}${Math.round(value * 100)}pp`;

console.log(`Cascade paired-seed comparison · threshold ${Math.round(threshold * 100)}pp · ${rows.length} common levels`);
console.log(`Materially changed levels: ${changed.length}`);
for (const row of changed.slice(0, 60)) {
  console.log(
    `L${String(row.level).padStart(3)} ${String(row.difficulty).padEnd(10)} · ` +
    `casual ${percentPoint(row.deltas["human-casual"] || 0)} · ` +
    `skilled ${percentPoint(row.deltas["human-skilled"] || 0)} · ` +
    `greedy ${percentPoint(row.deltas.greedy || 0)} · ` +
    `lookahead ${percentPoint(row.deltas.lookahead || 0)}`,
  );
}
