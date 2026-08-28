import { readFile, writeFile } from "node:fs/promises";
import { analyzePlaytestExport } from "../src/games/cascade/cascade-playtest-analysis.js";

function readStringFlag(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || null;
}

const inputPath = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
if (!inputPath) {
  console.error("Usage: node scripts/cascade-playtest-analyze.mjs <export.json> [--exclude-booster-player=Name[,Name]] [--json=report.json]");
  process.exit(2);
}

const exclusions = Object.fromEntries(
  (readStringFlag("exclude-booster-player") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((name) => [name, "Known booster-test contamination; booster usage is excluded from calibration."]),
);
const jsonPath = readStringFlag("json");
const raw = await readFile(inputPath, "utf8");
const data = JSON.parse(raw);
const report = analyzePlaytestExport(data, { boosterMetricExclusions: exclusions });
const percent = (value) => value === null ? "n/a" : `${Math.round(value * 100)}%`;
const fixed = (value) => value === null ? "n/a" : value.toFixed(2);

console.log(`Cascade family playtest analysis · ${report.playerCount} players · ${report.resolvedNormalAttempts} resolved normal attempts`);
console.log(`Unassisted difficulty sample: ${report.unassistedResolvedAttempts} attempts · win rate ${percent(report.unassistedWinRate)}`);
console.log("");
console.log("Player           Resolved RawWin CleanWin FirstPass  APS  Highest  Booster metric");
for (const player of report.players) {
  const booster = player.boosterMetrics.excluded
    ? "excluded"
    : `${player.boosterMetrics.hammerUses} uses`;
  console.log(
    `${String(player.displayName || "unknown").padEnd(16)} ` +
    `${String(player.resolvedAttempts).padStart(8)} ` +
    `${percent(player.observedWinRate).padStart(6)} ` +
    `${percent(player.unassistedWinRate).padStart(8)} ` +
    `${percent(player.firstPass.rate).padStart(9)} ` +
    `${fixed(player.unassistedAttemptsPerSuccess.attemptsPerSuccess).padStart(4)} ` +
    `${String(player.highestLevelCompleted ?? "-").padStart(7)}  ${booster}`,
  );
}

console.log("\nUnassisted outcomes by current difficulty label");
for (const bucket of report.byDifficulty) {
  console.log(
    `${bucket.difficulty.padEnd(12)} ${String(bucket.attempts).padStart(4)} attempts · ` +
    `win ${percent(bucket.winRate)} · fail ${percent(bucket.failureRate)}`,
  );
}

console.log("\nUnassisted outcomes by current chapter");
for (const bucket of report.byChapter) {
  console.log(
    `${bucket.chapter.padEnd(18)} L${String(bucket.startLevel).padStart(3)}-${String(bucket.endLevel).padStart(3)} · ` +
    `${String(bucket.attempts).padStart(4)} attempts · win ${percent(bucket.winRate)}`,
  );
}

console.log("\nPolicy: hammer-assisted attempts are excluded from intrinsic difficulty; invalid swaps are not a skill signal; device class does not alter level difficulty.");

if (jsonPath) {
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`JSON report written to ${jsonPath}`);
}
