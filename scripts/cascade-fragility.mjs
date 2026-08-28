import { CASCADE_LEVELS } from "../public/cascade-engine.js";
import { profileCascadeMoveFragility } from "../src/games/cascade/cascade-simulator.js";

function readNumberFlag(name, fallback) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function readStringFlag(name, fallback) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

const runsPerLevel = Math.max(1, readNumberFlag("runs", 8));
const from = Math.max(1, readNumberFlag("from", 1));
const to = Math.min(CASCADE_LEVELS.length, readNumberFlag("to", CASCADE_LEVELS.length));
const strategy = readStringFlag("strategy", "human-skilled");
const levels = CASCADE_LEVELS.slice(from - 1, to);
const report = profileCascadeMoveFragility({ levels, runsPerLevel, strategy });
const percent = (value) => `${Math.round(value * 100)}%`;

console.log(`Cascade move fragility · ${strategy} · ${runsPerLevel} paired seeds/variant · levels ${from}-${to}`);
console.log("Lvl Difficulty   -1mv  Base  +1mv  Swing  Brittle");
for (const level of report.levels) {
  console.log(
    `${String(level.level).padStart(3)} ${String(level.difficulty).padEnd(11)} ` +
    `${percent(level.minusOneWinRate).padStart(5)} ${percent(level.baselineWinRate).padStart(5)} ` +
    `${percent(level.plusOneWinRate).padStart(5)} ${percent(level.moveSensitivity).padStart(6)}  ` +
    `${level.brittle ? "YES" : ""}`,
  );
}

const ranked = report.levels
  .slice()
  .sort((a, b) => b.moveSensitivity - a.moveSensitivity || a.level - b.level)
  .slice(0, 20);

console.log("\nMost move-sensitive levels");
for (const level of ranked) {
  console.log(
    `L${level.level} ${level.difficulty} · -1 ${percent(level.minusOneWinRate)} · base ${percent(level.baselineWinRate)} · +1 ${percent(level.plusOneWinRate)} · swing ${percent(level.moveSensitivity)}`,
  );
}
