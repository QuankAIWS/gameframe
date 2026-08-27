import { readFile } from "node:fs/promises";
import { analyzePlaytestExport } from "../src/games/cascade/cascade-playtest-analysis.js";

function readStringFlag(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || null;
}

const files = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
if (files.length < 2) {
  console.error("Usage: node scripts/cascade-persona-calibrate.mjs <playtest.json> <profile.json> [--exclude-booster-player=Name[,Name]]");
  process.exit(2);
}

const [playtestPath, profilePath] = files;
const exclusions = Object.fromEntries(
  (readStringFlag("exclude-booster-player") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((name) => [name, "Known booster-test contamination; booster usage is excluded from calibration."]),
);

const [playtest, profile] = await Promise.all([
  readFile(playtestPath, "utf8").then(JSON.parse),
  readFile(profilePath, "utf8").then(JSON.parse),
]);
const observed = analyzePlaytestExport(playtest, { boosterMetricExclusions: exclusions });
const profileLevels = new Map((profile.levels || []).map((level) => [level.level, level]));
const percent = (value) => value === null ? "n/a" : `${Math.round(value * 100)}%`;
const pp = (value) => `${value >= 0 ? "+" : ""}${Math.round(value * 100)}pp`;

function calibrationRows(groupKey) {
  const buckets = new Map();
  for (const row of observed.cleanFirstPass.levels) {
    const simulated = profileLevels.get(row.level)?.strategies?.["human-skilled"]?.winRate;
    if (!Number.isFinite(simulated)) continue;
    const key = row[groupKey];
    if (!buckets.has(key)) {
      buckets.set(key, { key, eligible: 0, wins: 0, predictedWeighted: 0 });
    }
    const bucket = buckets.get(key);
    bucket.eligible += row.eligible;
    bucket.wins += row.wins;
    bucket.predictedWeighted += simulated * row.eligible;
  }
  return [...buckets.values()].map((bucket) => {
    const actual = bucket.eligible ? bucket.wins / bucket.eligible : null;
    const predicted = bucket.eligible ? bucket.predictedWeighted / bucket.eligible : null;
    return {
      ...bucket,
      actual,
      predicted,
      delta: Number.isFinite(actual) && Number.isFinite(predicted) ? predicted - actual : null,
    };
  });
}

const difficultyRows = calibrationRows("difficulty");
const chapterRows = calibrationRows("chapter");
const levelRows = observed.cleanFirstPass.levels
  .map((row) => {
    const predicted = profileLevels.get(row.level)?.strategies?.["human-skilled"]?.winRate;
    return {
      ...row,
      predicted: Number.isFinite(predicted) ? predicted : null,
      delta: Number.isFinite(predicted) ? predicted - row.rate : null,
    };
  })
  .filter((row) => row.predicted !== null);

const weightedAbsoluteError = levelRows.reduce(
  (sum, row) => sum + Math.abs(row.delta) * row.eligible,
  0,
);
const eligible = levelRows.reduce((sum, row) => sum + row.eligible, 0);
const weightedMae = eligible ? weightedAbsoluteError / eligible : null;

console.log(`Cascade persona outcome calibration · ${eligible} clean first-pass observations · human-skilled`);
console.log(`Weighted first-pass MAE: ${weightedMae === null ? "n/a" : pp(weightedMae)}`);

console.log("\nBy difficulty");
for (const row of difficultyRows) {
  console.log(
    `${String(row.key).padEnd(12)} n=${String(row.eligible).padStart(3)} · observed ${percent(row.actual)} · persona ${percent(row.predicted)} · delta ${pp(row.delta)}`,
  );
}

console.log("\nBy chapter");
for (const row of chapterRows) {
  console.log(
    `${String(row.key).padEnd(18)} n=${String(row.eligible).padStart(3)} · observed ${percent(row.actual)} · persona ${percent(row.predicted)} · delta ${pp(row.delta)}`,
  );
}

console.log("\nLargest level-level deltas with at least two clean observations");
for (const row of levelRows
  .filter((item) => item.eligible >= 2)
  .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.level - b.level)
  .slice(0, 25)) {
  console.log(
    `L${String(row.level).padStart(3)} n=${row.eligible} · observed ${percent(row.rate)} · persona ${percent(row.predicted)} · delta ${pp(row.delta)}`,
  );
}
