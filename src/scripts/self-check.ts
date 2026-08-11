import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const read = (path: string) => readFile(join(repositoryRoot, path), "utf8");
const retiredBuiltInIdentity = ["th", "eo"].join("");
const retiredBuiltInIdentityPattern = new RegExp(`\\b${retiredBuiltInIdentity}\\b`, "i");

const packageJson = JSON.parse(await read("package.json"));
assert.equal(packageJson.name, "@quankaiws/scribbles-gameframe");
assert.equal(packageJson.private, true);
assert.equal(packageJson.type, "module");
assert.match(packageJson.engines.node, /22/);
assert.equal(
  packageJson.scripts["test:workerd"],
  "vitest run --config vitest.config.ts --max-workers=1 --no-isolate",
);
assert.equal(packageJson.scripts["test:browser"], "playwright test --config playwright.config.mjs");
assert.match(packageJson.scripts["validate:core"], /npm run test:workerd/);
assert.match(packageJson.scripts.validate, /npm run validate:core/);
assert.match(packageJson.scripts.validate, /npm run test:browser:required/);
assert.match(packageJson.scripts["validate:full"], /npm run test:visual-baseline/);

for (const browserEntry of [
  "public/discord-activity-bootstrap.js",
  "public/gameframe-auth.js",
  "public/auth-launcher.js",
  "public/app.js",
  "public/tactical-app.js",
  "public/combat-app.js",
  "public/monster-master-app.js",
  "public/monster-master-rpg-return.js",
]) {
  assert.match(
    packageJson.scripts["check:browser"],
    new RegExp(browserEntry.replaceAll(".", "\\.")),
  );
}

const durableFiles = [
  "README.md",
  "AGENTS.md",
  "NOTICE",
  "THIRD_PARTY_NOTICES.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "package-lock.json",
  "src/agents/gameframe-bot.ts",
  "src/agents/index.ts",
  "src/agents/decision-protocol.ts",
  "src/server/tic-tac-toe-match-service.ts",
  "src/server/checkers-match-service.ts",
  "src/server/tactical-movement-match-service.ts",
  "src/server/tactical-combat-match-service.ts",
  "src/server/monster-master-match-service.ts",
  "src/rpg/in-memory-rpg-encounter-match-coordinator.ts",
  "src/server/rpg-encounter-match-http.test.ts",
  "public/app.js",
  "public/tactical-app.js",
  "public/combat-app.js",
  "public/monster-master-app.js",
  "public/othello-game-menu.js",
  "test/fixtures/agent-decision/request-v1.json",
  "test/fixtures/agent-decision/response-v1.json",
  "planning/ROADMAP.md",
  "planning/architecture.md",
  "planning/testing-strategy.md",
  "planning/development-workflow.md",
  "planning/decisions/0005-gameframe-bot-and-external-agent-boundary.md",
  ".github/workflows/ci.yml",
  "wrangler.jsonc",
];

for (const path of durableFiles) {
  const content = await read(path);
  assert.ok(content.trim().length > 40, `${path} must contain durable content.`);
}

for (const removedPath of [
  "planning/openclaw-integration.md",
  `planning/decisions/0005-scribbles-${retiredBuiltInIdentity}-identity-boundary.md`,
  "LICENSE",
  ".github/workflows/activity-bundle-bootstrap.yml",
]) {
  await assert.rejects(
    access(join(repositoryRoot, removedPath)),
    `${removedPath} must not remain active.`,
  );
}

const lockfile = JSON.parse(await read("package-lock.json"));
assert.equal(lockfile.lockfileVersion, 3);
assert.equal(lockfile.packages[""].name, packageJson.name);
assert.deepEqual(lockfile.packages[""].devDependencies, packageJson.devDependencies);

const workflow = await read(".github/workflows/ci.yml");
assert.match(workflow, /^name: Canonical Validation$/m);
assert.match(workflow, /^\s{2}workflow_dispatch:\s*$/m);
assert.match(workflow, /^\s{2}pull_request:\s*$/m);
assert.match(workflow, /^\s{4}types: \[labeled\]\s*$/m);
assert.match(workflow, /^\s{4}runs-on: ubuntu-latest$/m);
assert.doesNotMatch(workflow, /self-hosted/);
assert.match(workflow, /^\s{8}run: npm ci --no-audit --no-fund$/m);
assert.match(workflow, /^\s{8}run: npx playwright install --with-deps chromium$/m);
assert.match(workflow, /^\s{8}run: npm run validate$/m);
for (const automaticTrigger of ["push", "schedule"]) {
  assert.doesNotMatch(
    workflow,
    new RegExp(`^\\s{2}${automaticTrigger}:`, "m"),
    `Canonical validation must not use the automatic ${automaticTrigger} trigger.`,
  );
}

const gitignore = await read(".gitignore");
for (const requiredIgnore of [
  ".env.*",
  ".dev.vars.*",
  ".wrangler/",
  "*.pem",
  "*.key",
  "credentials/",
  "secrets/",
  "playwright-report/",
  "test-results/",
]) {
  assert.match(
    gitignore,
    new RegExp(requiredIgnore.replaceAll(".", "\\.").replaceAll("*", ".*")),
  );
}

async function collectFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(absolutePath));
    else if (entry.isFile()) files.push(absolutePath);
  }
  return files;
}

const textExtensions = new Set([
  ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".jsonc", ".html", ".css",
  ".md", ".txt", ".yml", ".yaml",
]);
const executableRoots = ["src", "public", "test", "scripts", ".github"];
const retiredIdentityViolations: string[] = [];

for (const root of executableRoots) {
  const absoluteRoot = join(repositoryRoot, root);
  for (const absolutePath of await collectFiles(absoluteRoot)) {
    const repositoryPath = relative(repositoryRoot, absolutePath).replaceAll("\\", "/");
    if (!textExtensions.has(extname(absolutePath).toLowerCase())) continue;
    const content = await readFile(absolutePath, "utf8");
    if (retiredBuiltInIdentityPattern.test(repositoryPath)) {
      retiredIdentityViolations.push(`${repositoryPath} (path)`);
    }
    if (retiredBuiltInIdentityPattern.test(content)) {
      retiredIdentityViolations.push(`${repositoryPath} (content)`);
    }
  }
}
assert.deepEqual(
  retiredIdentityViolations,
  [],
  `Executable GameFrame surfaces retain the retired built-in opponent identity:\n${retiredIdentityViolations.join("\n")}`,
);

const retiredProjectName = [retiredBuiltInIdentity, "gameframe"].join("-");
const retiredPlatformTokens = [retiredProjectName, `@quankaiws/${retiredProjectName}`];
const publicHygieneTokens = [
  ["gh", "runner", "01"].join("-"),
  ["AI Workspace", "Software Development Doctrine"].join(" "),
  ["codename", "scribbles", "runtime"].join("-"),
  ["assistant", "execution environment"].join(" "),
  ["assistant", "local"].join("-"),
];

for (const absolutePath of await collectFiles(repositoryRoot)) {
  const repositoryPath = relative(repositoryRoot, absolutePath).replaceAll("\\", "/");
  if (!textExtensions.has(extname(absolutePath).toLowerCase())) continue;
  const content = await readFile(absolutePath, "utf8");
  const normalizedPath = repositoryPath.toLowerCase();
  const normalizedContent = content.toLowerCase();
  for (const token of retiredPlatformTokens) {
    assert.equal(
      normalizedPath.includes(token) || normalizedContent.includes(token),
      false,
      `${repositoryPath} contains retired platform identifier ${token}.`,
    );
  }
  for (const token of publicHygieneTokens) {
    assert.equal(
      normalizedPath.includes(token.toLowerCase()) || normalizedContent.includes(token.toLowerCase()),
      false,
      `${repositoryPath} contains internal-only public-hygiene marker ${token}.`,
    );
  }
}

const canonicalBot = await read("src/agents/gameframe-bot.ts");
assert.match(canonicalBot, /GAMEFRAME_BOT_PLAYER_ID = "gameframe-bot"/);
assert.match(canonicalBot, /GAMEFRAME_BOT_DISPLAY_NAME = "GameFrameBot"/);

for (const servicePath of [
  "src/server/tic-tac-toe-match-service.ts",
  "src/server/checkers-match-service.ts",
  "src/server/tactical-movement-match-service.ts",
  "src/server/tactical-combat-match-service.ts",
  "src/server/monster-master-match-service.ts",
]) {
  const service = await read(servicePath);
  assert.match(service, /GAMEFRAME_BOT_PLAYER_ID/);
  assert.match(service, /#bot/);
  assert.match(service, /chooseAgentDecision/);
}

const encounterCoordinator = await read("src/rpg/in-memory-rpg-encounter-match-coordinator.ts");
assert.match(encounterCoordinator, /GAMEFRAME_BOT_PLAYER_ID/);
assert.match(encounterCoordinator, /Monster Master BattleBot/);
assert.match(encounterCoordinator, /rpg-gm-runtime/);

const readme = await read("README.md");
assert.match(readme, /GameFrameBot/);
assert.match(readme, /rules-based bots/);
assert.match(readme, /not model-driven AI/);
assert.match(readme, /rpg-gm-runtime/);
assert.match(readme, /Theo is a separate agent hosted by Scribbles Runtime/);

const agents = await read("AGENTS.md");
assert.match(agents, /GameFrameBot/);
assert.match(agents, /gameframe-bot/);
assert.match(agents, /rpg-gm-runtime/);
assert.match(agents, /future external player/i);

const decision = await read("planning/decisions/0005-gameframe-bot-and-external-agent-boundary.md");
assert.match(decision, /GameFrameBot/);
assert.match(decision, /rules-based bots/);
assert.match(decision, /ordinary player seat/);
assert.match(decision, /No compatibility alias/);

const roadmap = await read("planning/ROADMAP.md");
assert.match(roadmap, /rpg-gm-runtime.*Dungeon Master/s);
assert.match(roadmap, /Campaign combat uses \*\*Tactical Activation/);
assert.doesNotMatch(roadmap, /Game Director.*Scribbles Runtime/is);

const architecture = await read("planning/architecture.md");
assert.match(architecture, /GameFrameBot/);
assert.match(architecture, /rpg-gm-runtime/);
assert.match(architecture, /future Scribbles Runtime connector/i);

const sharedBrowser = await read("public/app.js");
assert.match(sharedBrowser, /Challenge CPU Opponent/);
assert.match(sharedBrowser, /Challenge CheckersBot/);
assert.match(sharedBrowser, /gameframe-bot/);

for (const [path, label] of [
  ["public/tactical-app.js", "ArenaBot"],
  ["public/combat-app.js", "ArenaBot"],
  ["public/monster-master-app.js", "Monster Master BattleBot"],
  ["public/othello-game-menu.js", "OthelloBot"],
] as const) {
  const client = await read(path);
  assert.match(client, new RegExp(label));
}

const requestFixture = JSON.parse(await read("test/fixtures/agent-decision/request-v1.json"));
const responseFixture = JSON.parse(await read("test/fixtures/agent-decision/response-v1.json"));
assert.equal(requestFixture.playerId, "gameframe-bot");
assert.equal(responseFixture.playerId, "gameframe-bot");

console.log("Repository self-check passed.");
