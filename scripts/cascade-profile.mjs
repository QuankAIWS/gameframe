import { writeFile } from "node:fs/promises";
import { CASCADE_LEVELS } from "../public/cascade-engine.js";
import { profileCascadeLevels } from "../src/games/cascade/cascade-simulator.js";
import { selectContiguousShard, selectEvenlySpaced } from "./cascade-profile-selection.mjs";

function readNumberFlag(name, fallback) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function readNonNegativeNumberFlag(name, fallback = null) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function readStringFlag(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || null;
}

const runsPerLevel = readNumberFlag("runs", 40);
const humanRunsPerLevel = readNumberFlag("human-runs", Math.max(1, Math.floor(runsPerLevel / 2)));
const fromLevel = Math.max(1, readNumberFlag("from", 1));
const toLevel = Math.min(CASCADE_LEVELS.length, readNumberFlag("to", CASCADE_LEVELS.length));
if (toLevel < fromLevel) throw new Error(`Invalid Cascade profile range: ${fromLevel}-${toLevel}`);
const requestedDefinitions = CASCADE_LEVELS.slice(fromLevel - 1, toLevel);
const shardCount = readNumberFlag("shard-count", 1);
const shardIndex = readNonNegativeNumberFlag("shard-index");
const sampleCount = readNonNegativeNumberFlag("sample-count", 0);
let levelDefinitions = requestedDefinitions;
if (shardIndex !== null) levelDefinitions = selectContiguousShard(levelDefinitions, shardIndex, shardCount);
if (sampleCount > 0) levelDefinitions = selectEvenlySpaced(levelDefinitions, sampleCount);
if (!levelDefinitions.length) throw new Error("Cascade profile selection produced no levels");

const jsonPath = readStringFlag("json");
const report = profileCascadeLevels({ levelDefinitions, runsPerLevel, humanRunsPerLevel });
report.selection = {
  requestedFrom: fromLevel,
  requestedTo: toLevel,
  selectedCount: levelDefinitions.length,
  selectedLevels: levelDefinitions.map((level) => level.level),
  sampleCount,
  shardIndex,
  shardCount: shardIndex === null ? null : shardCount,
};
const percent = (value) => `${Math.round(value * 100)}%`;
const selectionLabel = shardIndex === null
  ? sampleCount > 0
    ? `sample ${levelDefinitions.length}/${requestedDefinitions.length}`
    : `${levelDefinitions.length} levels`
  : `shard ${shardIndex + 1}/${shardCount} · ${levelDefinitions.length} levels`;

console.log(`Cascade difficulty profile · L${fromLevel}-${toLevel} · ${selectionLabel} · persistent specials + campaign waves · ${runsPerLevel} solver seeds · ${humanRunsPerLevel} human-persona seeds`);
console.log("Lvl Mv Target Difficulty  Random Casual Skill  Greedy Look   Gap  ObjFail Ice Made Trig Combo");
for (const level of report.levels) {
  const random = level.strategies.random;
  const casual = level.strategies["human-casual"];
  const skilled = level.strategies["human-skilled"];
  const greedy = level.strategies.greedy;
  const lookahead = level.strategies.lookahead;
  const gap = level.skillSensitivity === null ? "n/a" : `${Math.round(level.skillSensitivity * 100)}pp`;
  console.log(
    `${String(level.level).padStart(3)} ${String(level.moves).padStart(2)} ${String(level.target).padStart(6)} ` +
    `${String(level.difficulty || "normal").padEnd(10)} ` +
    `${percent(random.winRate).padStart(7)} ${percent(casual.winRate).padStart(6)} ${percent(skilled.winRate).padStart(5)} ` +
    `${percent(greedy.winRate).padStart(6)} ${percent(lookahead.winRate).padStart(5)} ` +
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
  const casual = average((item) => item.strategies["human-casual"].winRate);
  const skilled = average((item) => item.strategies["human-skilled"].winRate);
  const greedy = average((item) => item.strategies.greedy.winRate);
  const lookahead = average((item) => item.strategies.lookahead.winRate);
  const worstLookahead = Math.min(...wave.map((item) => item.strategies.lookahead.winRate));
  const created = average((item) => item.strategies.lookahead.averageSpecialsCreated);
  const combos = average((item) => item.strategies.lookahead.averageSpecialCombos);
  console.log(
    `L${String(wave[0].level).padStart(3)}-${String(wave.at(-1).level).padStart(3)} ` +
    `random ${percent(random)} · casual ${percent(casual)} · skilled ${percent(skilled)} · ` +
    `greedy ${percent(greedy)} · lookahead ${percent(lookahead)} · ` +
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
  const casual = average((item) => item.strategies["human-casual"].winRate);
  const skilled = average((item) => item.strategies["human-skilled"].winRate);
  const objectiveFailure = average((item) => item.strategies.lookahead.objectiveFailureRate);
  const worst = Math.min(...chapterLevels.map((item) => item.strategies.lookahead.winRate));
  console.log(
    `${chapter.padEnd(18)} L${String(chapterLevels[0].level).padStart(3)}-${String(chapterLevels.at(-1).level).padStart(3)} · ` +
    `random ${percent(random)} · casual ${percent(casual)} · skilled ${percent(skilled)} · lookahead ${percent(lookahead)} · worst ${percent(worst)} · objective fail ${percent(objectiveFailure)}`,
  );
}

const allLookaheadBeatable = report.levels.every((level) => level.strategies.lookahead.wins > 0);
const laterLevels = report.levels.filter((level) => level.level >= 31);
const postOnboardingLevels = report.levels.filter((level) => level.level >= 6);
const skillSeparated = laterLevels.filter((level) => level.strategies.random.winRate < level.strategies.lookahead.winRate).length;
const planningSeparated = laterLevels.filter((level) => level.strategies.greedy.winRate < level.strategies.lookahead.winRate).length;
const reliefCliffs = postOnboardingLevels.filter((level) => level.difficulty === "relief" && level.strategies.lookahead.winRate < 0.5);
const normalCliffs = postOnboardingLevels.filter((level) => level.difficulty === "normal" && level.strategies.lookahead.winRate < (1 / 3));

console.log("");
console.log(`Lookahead can clear all ${report.levels.length} levels in the sampled seeds: ${allLookaheadBeatable ? "yes" : "no"}`);
console.log(`L${laterLevels[0]?.level ?? fromLevel}-${laterLevels.at(-1)?.level ?? toLevel} levels with random < lookahead: ${skillSeparated}/${laterLevels.length}`);
console.log(`L${laterLevels[0]?.level ?? fromLevel}-${laterLevels.at(-1)?.level ?? toLevel} levels with greedy < lookahead: ${planningSeparated}/${laterLevels.length}`);
console.log(`Family-beta relief cliffs (<50% lookahead): ${reliefCliffs.length ? reliefCliffs.map((level) => level.level).join(", ") : "none"}`);
console.log(`Family-beta normal cliffs (<33% lookahead): ${normalCliffs.length ? normalCliffs.map((level) => level.level).join(", ") : "none"}`);
const targetable = report.levels.filter((level) => level.targetFirstPassBand);
const targetMisses = targetable.filter((level) => Math.abs(level.humanSkilledTargetDelta || 0) > 0.0001);
const targetBelow = targetMisses.filter((level) => level.humanSkilledTargetDelta < 0);
const targetAbove = targetMisses.filter((level) => level.humanSkilledTargetDelta > 0);
console.log(`Human-skilled target bands are advisory until telemetry calibration: ${targetable.length} post-300 expansion levels tracked`);
console.log(`Human-skilled below target band: ${targetBelow.length}; above target band: ${targetAbove.length}`);

if (jsonPath) {
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`JSON report written to ${jsonPath}`);
}

if (!allLookaheadBeatable || reliefCliffs.length || normalCliffs.length) {
  if (!allLookaheadBeatable) {
    const deadLevels = report.levels
      .filter((level) => level.strategies.lookahead.wins === 0)
      .map((level) => level.level);
    console.error(`Lookahead sampled no wins on levels: ${deadLevels.join(", ")}`);
  }
  if (reliefCliffs.length) console.error(`Relief beats are not releasing tension on levels: ${reliefCliffs.map((level) => level.level).join(", ")}`);
  if (normalCliffs.length) console.error(`Normal levels are behaving like unintended hard spikes on levels: ${normalCliffs.map((level) => level.level).join(", ")}`);
  process.exitCode = 1;
}
