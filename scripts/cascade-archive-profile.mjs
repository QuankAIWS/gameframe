import { readFile, writeFile } from "node:fs/promises";

function flag(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || null;
}

const input = flag("profile");
const output = flag("out");
if (!input || !output) {
  throw new Error("Usage: npm run cascade:archive -- --profile=<profile.json> --out=<archive.json> [--status=accepted] [--label=...] [--run-id=...] [--job-id=...] [--head-sha=...]");
}

const source = JSON.parse(await readFile(input, "utf8"));
const status = flag("status") || "candidate";
if (!["historical", "accepted", "candidate"].includes(status)) throw new Error(`Invalid archive status: ${status}`);

const levelRange = source.levelRange || (
  source.levels?.length
    ? { from: source.levels[0].level, to: source.levels.at(-1).level, count: source.levels.length }
    : null
);
const label = flag("label") || `cascade-${levelRange?.from ?? "unknown"}-${levelRange?.to ?? "unknown"}`;

const compact = {
  archiveSchemaVersion: 1,
  archiveType: "cascade-bot-profile",
  status,
  label,
  provenance: {
    workflowRunId: flag("run-id") ? Number(flag("run-id")) : null,
    workflowJobId: flag("job-id") ? Number(flag("job-id")) : null,
    headSha: flag("head-sha"),
    capturedFrom: input,
  },
  sampling: {
    runsPerLevel: source.runsPerLevel ?? null,
    humanRunsPerLevel: source.humanRunsPerLevel ?? null,
    seedBase: source.seedBase ?? null,
  },
  levelRange,
  levels: (source.levels || []).map((level) => ({
    level: level.level,
    chapter: level.chapter,
    difficulty: level.difficulty,
    target: level.target,
    moves: level.moves,
    skillSensitivity: level.skillSensitivity ?? null,
    planningSensitivity: level.planningSensitivity ?? null,
    humanSkillSpread: level.humanSkillSpread ?? null,
    targetFirstPassBand: level.targetFirstPassBand ?? null,
    humanSkilledTargetDelta: level.humanSkilledTargetDelta ?? null,
    strategies: Object.fromEntries(Object.entries(level.strategies || {}).map(([name, result]) => [
      name,
      {
        runs: result.runs,
        wins: result.wins,
        winRate: result.winRate,
        medianMovesToWin: result.medianMovesToWin ?? null,
        p90MovesToWin: result.p90MovesToWin ?? null,
        objectiveFailureRate: result.objectiveFailureRate ?? null,
        shuffleRate: result.shuffleRate ?? null,
      },
    ])),
  })),
};

await writeFile(output, JSON.stringify(compact, null, 2) + "\n", "utf8");
console.log(`Archived ${compact.levels.length} Cascade levels to ${output}`);
