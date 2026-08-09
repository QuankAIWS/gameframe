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
console.log("Lvl Moves Target Random Greedy Lookahead SkillGap L-Power L-Sweep L-maxCascade");
for (const level of report.levels) {
  const random = level.strategies.random;
  const greedy = level.strategies.greedy;
  const lookahead = level.strategies.lookahead;
  const percent = (value) => `${Math.round(value * 100)}%`.padStart(4);
  const gap = level.skillSensitivity === null ? "n/a" : `${Math.round(level.skillSensitivity * 100)}pp`;
  console.log(
    `${String(level.level).padStart(3)} ${String(level.moves).padStart(5)} ${String(level.target).padStart(6)} ` +
    `${percent(random.winRate)} ${percent(greedy.winRate)} ${percent(lookahead.winRate).padStart(9)} ` +
    `${gap.padStart(7)} ${lookahead.averagePowerClears.toFixed(1).padStart(7)} ` +
    `${lookahead.averageColorSweeps.toFixed(1).padStart(7)} ${String(lookahead.maxCascade).padStart(12)}`,
  );
}

const allLookaheadBeatable = report.levels.every((level) => level.strategies.lookahead.wins > 0);
const lateLevels = report.levels.slice(20);
const lateSkillSeparation = lateLevels.some((level) => level.strategies.random.winRate < level.strategies.lookahead.winRate);
console.log("");
console.log(`Lookahead can clear all ${report.levels.length} levels in the sampled seeds: ${allLookaheadBeatable ? "yes" : "no"}`);
console.log(`Later levels separate random from lookahead play: ${lateSkillSeparation ? "yes" : "no"}`);

if (jsonPath) {
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`JSON report written to ${jsonPath}`);
}
