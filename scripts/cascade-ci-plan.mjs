import { appendFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { CASCADE_LEVELS } from "../public/cascade-engine.js";

const execFileAsync = promisify(execFile);
const PROFILE_SEAM = 30;

function readFlag(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || null;
}

function canonicalLevelValue(value) {
  if (Array.isArray(value)) return value.map(canonicalLevelValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, child]) => child !== null && child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalLevelValue(child)]),
  );
}

export function changedLevelRange(baseLevels, headLevels, seam = PROFILE_SEAM) {
  const base = Array.from(baseLevels || []);
  const head = Array.from(headLevels || []);
  const changed = [];
  const length = Math.max(base.length, head.length);

  for (let index = 0; index < length; index += 1) {
    const before = canonicalLevelValue(base[index] ?? null);
    const after = canonicalLevelValue(head[index] ?? null);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changed.push(index + 1);
    }
  }

  if (!changed.length) {
    return {
      changed: false,
      changedLevelCount: 0,
      profileFrom: 1,
      profileTo: head.length,
    };
  }

  const minChanged = Math.min(...changed);
  const maxChanged = Math.min(head.length, Math.max(...changed));
  return {
    changed: true,
    changedLevelCount: changed.length,
    profileFrom: Math.max(1, minChanged - seam),
    profileTo: Math.min(head.length, maxChanged + seam),
  };
}

export function isCascadeBalanceSemanticFile(file) {
  return file === "public/cascade-engine.js"
    || file === "public/cascade-special-engine.js"
    || file === "src/games/cascade/cascade-simulator.js"
    || file === "scripts/cascade-profile.mjs"
    || file === "scripts/cascade-profile-selection.mjs"
    || file === "scripts/cascade-fragility.mjs";
}

async function gitText(args) {
  const { stdout } = await execFileAsync("git", args, { maxBuffer: 32 * 1024 * 1024 });
  return stdout;
}

async function loadBaseLevels(baseSha) {
  const source = await gitText(["show", `${baseSha}:public/cascade-engine.js`]);
  const directory = await mkdtemp(join(tmpdir(), "cascade-ci-plan-"));
  const file = join(directory, "cascade-engine-base.mjs");
  try {
    await writeFile(file, source, "utf8");
    const module = await import(`${pathToFileURL(file).href}?sha=${encodeURIComponent(baseSha)}`);
    return module.CASCADE_LEVELS;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function emit(plan, outputPath) {
  const lines = Object.entries(plan).map(([key, value]) => `${key}=${value}`);
  if (outputPath) await appendFile(outputPath, `${lines.join("\n")}\n`);
  else process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
}

async function main() {
  const baseSha = readFlag("base-sha");
  const headSha = readFlag("head-sha") || "HEAD";
  const outputPath = readFlag("github-output");
  const manual = process.argv.includes("--manual");

  if (manual || !baseSha) {
    await emit({
      canary: true,
      deep: false,
      changedLevelCount: 0,
      profileFrom: 1,
      profileTo: CASCADE_LEVELS.length,
      reason: "manual-canary",
    }, outputPath);
    return;
  }

  const changedFiles = (await gitText(["diff", "--name-only", baseSha, headSha]))
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);

  let range = {
    changed: false,
    changedLevelCount: 0,
    profileFrom: 1,
    profileTo: CASCADE_LEVELS.length,
  };

  if (changedFiles.includes("public/cascade-engine.js")) {
    const baseLevels = await loadBaseLevels(baseSha);
    range = changedLevelRange(baseLevels, CASCADE_LEVELS);
  }

  const canary = changedFiles.some(isCascadeBalanceSemanticFile) || range.changed;
  const plan = {
    canary,
    deep: range.changed,
    changedLevelCount: range.changedLevelCount,
    profileFrom: range.profileFrom,
    profileTo: range.profileTo,
    reason: range.changed
      ? `changed-levels-${range.profileFrom}-${range.profileTo}`
      : canary
        ? "balance-semantics-canary"
        : "no-balance-profile",
  };
  console.log(`Cascade CI plan: ${JSON.stringify(plan)}`);
  await emit(plan, outputPath);
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entrypoint) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
