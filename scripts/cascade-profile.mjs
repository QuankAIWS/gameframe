import { writeFile } from "node:fs/promises";
import { profileCascadeLevels } from "../src/games/cascade/cascade-simulator.js";

function readNumberFlag(name, fallback) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function readStringFlag(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || null;
}

const runsPerLevel = readNumberFlag("runs", 40);
const jsonPath = readStringFlag("json");
const report = profileCascadeLevels({ runsPerLevel });

console.log(`Cascade difficulty profile · ${runsPerLevel} seeds per level/strategy`);
console.log("Lvl  Moves  Target  Random  Greedy  Lookahead  PlanGap  L-maxCascade");
for (const level of report.levels) {
  const random = level.strategies.random;
  const greedy = level.strategies.greedy;
  const lookahead = level.strategies.lookahead;
  const percent = (value) => `${Math.round(value * 100)}%`.padStart(4);
  const gap = level.planningSensitivity === null ? "  n/a" : `${Math.round(level.planningSensitivity * 100)}pp`.padStart(5);
  console.log(
    `${String(level.level).padStart(3)}  ${String(level.moves).padStart(5)}  ${String(level.target).padStart(6)}  ` +
    `${percent(random.winRate).padStart(6)}  ${percent(greedy.winRate).padStart(6)}  ${percent(lookahead.winRate).padStart(9)}  ` +
    `${gap.padStart(7)}  ${String(lookahead.maxCascade).padStart(12)}`,
  );
}

const allLookaheadBeatable = report.levels.every((level) => level.strategies.lookahead.wins > 0);
const allRandomHigh = report.levels.every((level) => level.strategies.random.winRate >= 0.9);
console.log("");
console.log(`Lookahead can clear all 20 levels: ${allLookaheadBeatable ? "yes" : "no"}`);
if (allRandomHigh) {
  console.log("Current calibration: the opening run is extremely forgiving; even random legal play clears at least 90% of sampled runs on every level.");
}

if (jsonPath) {
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`JSON report written to ${jsonPath}`);
}
