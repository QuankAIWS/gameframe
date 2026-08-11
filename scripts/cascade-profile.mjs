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
const percent = (value) => `${Math.round(value * 100)}%`;

console.log(`Cascade difficulty profile · persistent specials + campaign waves · ${runsPerLevel} seeds per level/strategy`);
console.log("Lvl Mv Target Difficulty  Random Greedy Look   Gap  ObjFail Ice Made Trig Combo");
for (const level of report.levels) {
  const random = level.strategies.random;
  const greedy = level.strategies.greedy;
  const lookahead = level.strategies.lookahead;
  const gap = level.skillSensitivity === null ? "n/a" : `${Math.round(level.skillSensitivity * 100)}pp`;
  console.log(
    `${String(level.level).padStart(3)} ${String(level.moves).padStart(2)} ${String(level.target).padStart(6)} ` +
    `${String(level.difficulty || "normal").padEnd(10)} ` +
    `${percent(random.winRate).padStart(7)} ${percent(greedy.winRate).padStart(6)} ${percent(lookahead.winRate).padStart(5)} ` +
    `${gap.padStart(5)} ${percent(lookahead.objectiveFailureRate).padStart(7)} ` +
    `${lookahead.averageIceHits.toFixed(1).padStart(4)} ` +
    `${lookahead.averageSpecialsCreated.toFixed(1).padStart(4)} ` +
    `${lookahead.averageSpecialsTriggered.toFixed(1).padStart(4)} ` +
    `${lookahead.averageSpecialCombos.toFixed(1).padStart(5)}`,
  );
}

console.log("\nTension-wave summary");
for (let start = 0; start < report.levels.length; start += 10) {
  const wave = report.levels.slice(start, start + 10);
  const average = (selector) => wave.reduce((sum, item) => sum + selector(item), 0) / wave.length;
  const random = average((item) => item.strategies.random.winRate);
  const greedy = average((item) => item.strategies.greedy.winRate);
  const lookahead = average((item) => item.strategies.lookahead.winRate);
  const worstLookahead = Math.min(...wave.map((item) => item.strategies.lookahead.winRate));
  const created = average((item) => item.strategies.lookahead.averageSpecialsCreated);
  const combos = average((item) => item.strategies.lookahead.averageSpecialCombos);
  console.log(
    `L${String(start + 1).padStart(3)}-${String(start + wave.length).padStart(3)} ` +
    `random ${percent(random)} · greedy ${percent(greedy)} · lookahead ${percent(lookahead)} · ` +
    `worst ${percent(worstLookahead)} · specials ${created.toFixed(1)} · combos ${combos.toFixed(1)}`,
  );
}

console.log("\nCampaign chapter summary");
const chapters = new Map();
for (const level of report.levels) {
  const key = level.chapter || "unknown";
  if (!chapters.has(key)) chapters.set(key, []);
  chapters.get(key).push(level);
}
for (const [chapter, chapterLevels] of chapters) {
  const average = (selector) => chapterLevels.reduce((sum, item) => sum + selector(item), 0) / chapterLevels.length;
  const lookahead = average((item) => item.strategies.lookahead.winRate);
  const random = average((item) => item.strategies.random.winRate);
  const objectiveFailure = average((item) => item.strategies.lookahead.objectiveFailureRate);
  const worst = Math.min(...chapterLevels.map((item) => item.strategies.lookahead.winRate));
  console.log(
    `${chapter.padEnd(18)} L${String(chapterLevels[0].level).padStart(3)}-${String(chapterLevels.at(-1).level).padStart(3)} · ` +
    `random ${percent(random)} · lookahead ${percent(lookahead)} · worst ${percent(worst)} · objective fail ${percent(objectiveFailure)}`,
  );
}

const allLookaheadBeatable = report.levels.every((level) => level.strategies.lookahead.wins > 0);
const laterLevels = report.levels.slice(30);
const skillSeparated = laterLevels.filter((level) => level.strategies.random.winRate < level.strategies.lookahead.winRate).length;
const planningSeparated = laterLevels.filter((level) => level.strategies.greedy.winRate < level.strategies.lookahead.winRate).length;
console.log("");
console.log(`Lookahead can clear all ${report.levels.length} levels in the sampled seeds: ${allLookaheadBeatable ? "yes" : "no"}`);
console.log(`L31-${report.levels.length} levels with random < lookahead: ${skillSeparated}/${laterLevels.length}`);
console.log(`L31-${report.levels.length} levels with greedy < lookahead: ${planningSeparated}/${laterLevels.length}`);

if (jsonPath) {
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`JSON report written to ${jsonPath}`);
}

if (!allLookaheadBeatable) {
  const deadLevels = report.levels
    .filter((level) => level.strategies.lookahead.wins === 0)
    .map((level) => level.level);
  console.error(`Lookahead sampled no wins on levels: ${deadLevels.join(", ")}`);
  process.exitCode = 1;
}
