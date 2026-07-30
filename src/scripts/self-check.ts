import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const read = (path: string) => readFile(join(repositoryRoot, path), "utf8");

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
assert.equal(packageJson.scripts["build:activity"], "node scripts/build-activity-bundle.mjs");
assert.equal(packageJson.scripts["check:activity"], "node scripts/build-activity-bundle.mjs --check");
assert.match(packageJson.scripts.validate, /npm run test:workerd/);
assert.match(packageJson.scripts.validate, /npm run check:activity/);
assert.match(packageJson.scripts.validate, /npm run test:browser/);
for (const browserEntry of [
  "public/discord-activity-bootstrap.js",
  "public/gameframe-auth.js",
  "public/auth-launcher.js",
  "public/app.js",
  "public/tactical-app.js",
  "public/combat-app.js",
]) {
  assert.match(packageJson.scripts["check:browser"], new RegExp(browserEntry.replaceAll(".", "\\.")));
}
assert.deepEqual(packageJson.devDependencies, {
  "@cloudflare/vitest-pool-workers": "0.19.0",
  "@discord/embedded-app-sdk": "2.5.0",
  "@playwright/test": "1.61.1",
  esbuild: "0.28.1",
  vitest: "4.1.10",
  wrangler: "4.115.0",
});

const durableFiles = [
  "README.md",
  "AGENTS.md",
  "NOTICE",
  "THIRD_PARTY_NOTICES.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "package-lock.json",
  "playwright.config.mjs",
  "vitest.config.ts",
  "scripts/build-activity-bundle.mjs",
  "src/platform/match-session.ts",
  "src/platform/match-session.test.ts",
  "src/agents/index.ts",
  "src/agents/agent-player.ts",
  "src/agents/decision-protocol.ts",
  "src/agents/mock-decision-provider.ts",
  "src/agents/provider-backed-agent.ts",
  "src/agents/decision-protocol.test.ts",
  "src/auth/discord-oauth.ts",
  "src/auth/discord-activity-client.ts",
  "src/auth/discord-activity-client.test.ts",
  "src/auth/discord-activity-delivery-contract.test.ts",
  "src/browser/discord-activity-bootstrap.ts",
  "src/games/tic-tac-toe/index.ts",
  "src/games/checkers/index.ts",
  "src/games/checkers/index.test.ts",
  "src/games/checkers/integration.test.ts",
  "src/games/tactical-core/index.ts",
  "src/games/tactical-combat/index.ts",
  "src/games/tactical-combat/index.test.ts",
  "src/games/tactical-combat/repository-contract.test.ts",
  "src/server/tic-tac-toe-match-service.ts",
  "src/server/checkers-match-service.ts",
  "src/server/checkers-match-service.test.ts",
  "src/server/tactical-movement-match-service.ts",
  "src/server/tactical-combat-match-service.ts",
  "src/server/tactical-combat-match-service.test.ts",
  "src/server/checkers-http.test.ts",
  "src/server/in-memory-match-service.ts",
  "src/cloudflare/match-object-runtime.ts",
  "src/cloudflare/worker-router.ts",
  "public/discord-activity-bootstrap.js",
  "public/gameframe-auth.js",
  "public/gameframe-auth.css",
  "public/auth-launcher.js",
  "public/tactical.html",
  "public/tactical-app.js",
  "public/tactical.css",
  "public/combat.html",
  "public/combat-app.js",
  "public/combat.css",
  "test/browser/tic-tac-toe.spec.mjs",
  "test/browser/checkers.spec.mjs",
  "test/browser/tactical-movement.spec.mjs",
  "test/browser/tactical-combat.spec.mjs",
  "test/fixtures/agent-decision/request-v1.json",
  "test/fixtures/agent-decision/response-v1.json",
  "test/workerd/cloudflare-runtime.test.ts",
  "test/workerd/tactical-combat-runtime.test.ts",
  "test/workerd/discord-session-runtime.test.ts",
  "planning/ROADMAP.md",
  "planning/architecture.md",
  "planning/testing-strategy.md",
  "planning/development-workflow.md",
  "planning/deployment-topology.md",
  "planning/agent-decision-protocol.md",
  "planning/checkers-rules.md",
  "planning/scribbles-runtime-integration.md",
  "planning/discord-authentication-and-cloudflare-canary.md",
  "planning/tactical-battler-rpg-foundation.md",
  "planning/tactical-core-contract.md",
  "planning/tactical-canvas-canary.md",
  "planning/tactical-combat-contract.md",
  "planning/decisions/0001-zero-dependency-walking-skeleton.md",
  "planning/decisions/0002-websockets-are-projections.md",
  "planning/decisions/0003-server-derived-player-identity.md",
  "planning/decisions/0004-signed-discord-activity-sessions.md",
  "planning/decisions/0005-scribbles-theo-identity-boundary.md",
  "planning/decisions/0006-scrollable-tactical-battlefields.md",
  "planning/decisions/0007-platform-proof-sequence-and-mock-agents.md",
  "planning/decisions/0008-public-source-proprietary-repository.md",
  "planning/decisions/0009-defer-external-canaries-without-blocking-development.md",
  "planning/validation/2026-07-27-canonical-baseline.md",
  "planning/validation/2026-07-29-tic-tac-toe-browser-proof.md",
  "planning/validation/2026-07-29-agent-decision-contract.md",
  "planning/validation/2026-07-29-american-checkers-rules.md",
  ".github/workflows/ci.yml",
  "wrangler.jsonc",
];

for (const path of durableFiles) {
  const content = await read(path);
  assert.ok(content.trim().length > 40, `${path} must contain durable content.`);
}

await assert.rejects(
  access(join(repositoryRoot, "planning/openclaw-integration.md")),
  "The retired OpenClaw integration document must not remain active.",
);
await assert.rejects(
  access(join(repositoryRoot, "LICENSE")),
  "The proprietary public-source repository must not gain an open-source LICENSE file without an explicit decision.",
);
await assert.rejects(
  access(join(repositoryRoot, ".github/workflows/activity-bundle-bootstrap.yml")),
  "The temporary write-capable Activity bundle workflow must not remain on a final branch.",
);

const lockfile = JSON.parse(await read("package-lock.json"));
assert.equal(lockfile.lockfileVersion, 3);
assert.equal(lockfile.packages[""].name, packageJson.name);
assert.deepEqual(lockfile.packages[""].devDependencies, packageJson.devDependencies);

const workflow = await read(".github/workflows/ci.yml");
assert.match(workflow, /^name: Canonical Validation$/m);
assert.match(workflow, /^\s{2}workflow_dispatch:\s*$/m);
assert.match(workflow, /^\s{2}pull_request:\s*$/m);
assert.match(workflow, /^\s{4}types: \[labeled\]\s*$/m);
assert.match(
  workflow,
  /^\s{4}if: \$\{\{ github\.event_name == 'workflow_dispatch' \|\| github\.event\.label\.name == 'canonical-validation' \}\}\s*$/m,
);
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
assert.doesNotMatch(
  workflow,
  /^\s{4}types:.*\b(?:opened|reopened|synchronize|ready_for_review)\b/m,
  "Pull-request validation may run only for a deliberate label event.",
);

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
  assert.match(gitignore, new RegExp(requiredIgnore.replaceAll(".", "\\.").replaceAll("*", ".*")));
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

const retiredProjectName = ["theo", "gameframe"].join("-");
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
  const content = await readFile(absolutePath, "utf8");
  const normalizedPath = repositoryPath.toLowerCase();
  const normalizedContent = content.toLowerCase();
  for (const token of retiredPlatformTokens) {
    assert.equal(
      normalizedPath.includes(token) || normalizedContent.includes(token),
      false,
      `${repositoryPath} contains the retired platform identifier ${token}.`,
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

const readme = await read("README.md");
assert.match(readme, /Scribbles GameFrame/);
assert.match(readme, /Scribbles Runtime/);
assert.match(readme, /Theo/);
assert.match(readme, /American Checkers proof/);
assert.match(readme, /monster-master tactical battler foundation/i);
assert.match(readme, /publicly viewable proprietary software/);
assert.match(readme, /No open-source license is granted/);

const notice = await read("NOTICE");
assert.match(notice, /All rights reserved/);
assert.match(notice, /No open-source license/);

const roadmap = await read("planning/ROADMAP.md");
assert.match(roadmap, /GF-0004 .* Paused/);
assert.match(roadmap, /GF-0005 .* Complete/);
assert.match(roadmap, /GF-0006 .* Complete/);
assert.match(roadmap, /GF-0007 .* Complete/);
assert.match(roadmap, /GF-0010 .* Active/);
assert.match(roadmap, /Monster-master tactical battler foundation/);
assert.match(roadmap, /RPG encounter and campaign foundation/);

const testingStrategy = await read("planning/testing-strategy.md");
assert.match(testingStrategy, /Feature-branch verification/);
assert.match(testingStrategy, /Canonical merge verification/);
assert.match(testingStrategy, /Workers-runtime integration/);
assert.match(testingStrategy, /Browser acceptance/);
assert.match(testingStrategy, /Artifact policy/);
assert.match(testingStrategy, /Any commit added after the canonical pass invalidates that pass/);
assert.match(testingStrategy, /GitHub-hosted runner/);

const agentProtocol = await read("src/agents/decision-protocol.ts");
assert.match(agentProtocol, /AGENT_DECISION_PROTOCOL_VERSION = "1"/);
assert.match(agentProtocol, /request_mismatch/);
assert.match(agentProtocol, /duplicate_action_id/);
assert.match(agentProtocol, /illegal_action/);

const providerBackedAgent = await read("src/agents/provider-backed-agent.ts");
assert.match(providerBackedAgent, /parseAgentDecisionResponse/);
assert.match(providerBackedAgent, /provider_timeout/);
assert.match(providerBackedAgent, /fallback/);

const mockProvider = await read("src/agents/mock-decision-provider.ts");
for (const mode of [
  "deterministic",
  "scripted",
  "seeded-random",
  "delayed",
  "unavailable",
  "malformed",
  "illegal",
  "duplicate",
  "stale",
  "mismatched-request",
  "mismatched-player",
]) {
  assert.match(mockProvider, new RegExp(mode));
}

const checkersRules = await read("src/games/checkers/index.ts");
assert.match(checkersRules, /gameId: "american-checkers"/);
assert.match(checkersRules, /CHECKERS_NO_PROGRESS_PLY_LIMIT = 80/);
assert.match(checkersRules, /capturedPieceIds/);
assert.match(checkersRules, /DeterministicCheckersPlayer/);

const checkersService = await read("src/server/checkers-match-service.ts");
assert.match(checkersService, /chooseAgentDecision/);
assert.match(checkersService, /DeterministicCheckersPlayer\("theo"\)/);

const matchSession = await read("src/platform/match-session.ts");
assert.match(matchSession, /initialState\?: State/);
assert.match(matchSession, /snapshot\.initialState/);
assert.match(matchSession, /snapshot\.rejectedActions \?\? \[\]/);

const multiGameService = await read("src/server/in-memory-match-service.ts");
for (const gameId of [
  "tic-tac-toe",
  "american-checkers",
  "tactical-movement-canary",
  "tactical-combat-canary",
]) {
  assert.match(multiGameService, new RegExp(`"${gameId}"`));
}
assert.match(multiGameService, /InMemoryTacticalCombatService/);
assert.match(multiGameService, /parseTacticalCombatAction/);

const combatRules = await read("src/games/tactical-combat/index.ts");
assert.match(combatRules, /TACTICAL_COMBAT_GAME_ID = "tactical-combat-canary"/);
assert.match(combatRules, /gameId: TACTICAL_COMBAT_GAME_ID/);
assert.match(combatRules, /DeterministicTacticalCombatPlayer/);
assert.match(combatRules, /tacticalCombatLineOfSight/);
assert.match(combatRules, /primaryActionAvailable/);
assert.match(combatRules, /unit-defeated/);
assert.match(combatRules, /combat-completed/);
assert.doesNotMatch(combatRules, /Math\.random/);

const combatService = await read("src/server/tactical-combat-match-service.ts");
assert.match(combatService, /chooseAgentDecision/);
assert.match(combatService, /DeterministicTacticalCombatPlayer\("theo"\)/);
assert.match(combatService, /actionCount < 8/);

const combatClient = await read("public/combat-app.js");
assert.match(combatClient, /tactical-combat-canary/);
assert.match(combatClient, /dataset\.actionKind/);
assert.match(combatClient, /combat-effects/);
assert.match(combatClient, /WebSocket/);
assert.doesNotMatch(combatClient, /listTacticalMoveActions|applyAction|MatchSession/);

const ticTacToeBrowserTest = await read("test/browser/tic-tac-toe.spec.mjs");
assert.match(ticTacToeBrowserTest, /completes and resumes a deterministic match against Theo/);
assert.match(ticTacToeBrowserTest, /two browser seats can share, refresh, and complete one match/);
assert.match(ticTacToeBrowserTest, /mobile layout remains usable without horizontal overflow/);

const checkersBrowserTest = await read("test/browser/checkers.spec.mjs");
assert.match(checkersBrowserTest, /deterministic American Checkers match against Theo/);
assert.match(checkersBrowserTest, /two browser seats share, play, and resume one Checkers match/);
assert.match(checkersBrowserTest, /without horizontal overflow on mobile/);

const combatBrowserTest = await read("test/browser/tactical-combat.spec.mjs");
assert.match(combatBrowserTest, /moves, ends, observes Theo, and resumes/);
assert.match(combatBrowserTest, /two browser seats share and advance one combat match/);
assert.match(combatBrowserTest, /selects and commits a legal Canvas combat attack/);
assert.match(combatBrowserTest, /without horizontal overflow on mobile/);

const workerdTest = await read("test/workerd/cloudflare-runtime.test.ts");
assert.match(workerdTest, /tactical-combat-canary/);
assert.match(workerdTest, /restores committed Checkers state after Durable Object eviction/);
assert.match(workerdTest, /serializes competing writes/);
assert.match(workerdTest, /resumes a hibernatable WebSocket/);

const combatWorkerdTest = await read("test/workerd/tactical-combat-runtime.test.ts");
assert.match(combatWorkerdTest, /persists a human combat activation through Durable Object eviction/);
assert.match(combatWorkerdTest, /commits Theo's complete multi-action activation before persistence/);

const ticTacToeService = await read("src/server/tic-tac-toe-match-service.ts");
assert.match(ticTacToeService, /PerfectTicTacToePlayer\("theo"\)/);
assert.match(ticTacToeService, /chooseAgentDecision/);
assert.doesNotMatch(ticTacToeService, /PerfectTicTacToePlayer\("scribbles"\)/);

console.log("Repository self-check passed.");
