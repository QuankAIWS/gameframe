import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const packageJson = JSON.parse(await readFile(join(repositoryRoot, "package.json"), "utf8"));
assert.equal(packageJson.name, "@quankaiws/scribbles-gameframe");
assert.equal(packageJson.private, true);
assert.equal(packageJson.type, "module");
assert.match(packageJson.engines.node, /22/);
assert.equal(packageJson.scripts["test:workerd"], "vitest run --config vitest.config.ts --max-workers=1 --no-isolate");
assert.equal(packageJson.scripts["test:browser"], "playwright test --config playwright.config.mjs");
assert.match(packageJson.scripts.validate, /npm run test:workerd/);
assert.match(packageJson.scripts.validate, /npm run test:browser/);
assert.deepEqual(packageJson.devDependencies, {
  "@cloudflare/vitest-pool-workers": "0.19.0",
  "@playwright/test": "1.61.1",
  vitest: "4.1.10",
  wrangler: "4.115.0",
});

const durableFiles = [
  "README.md",
  "AGENTS.md",
  "NOTICE",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "package-lock.json",
  "playwright.config.mjs",
  "vitest.config.ts",
  "test/browser/tic-tac-toe.spec.mjs",
  "test/workerd/cloudflare-runtime.test.ts",
  "planning/ROADMAP.md",
  "planning/architecture.md",
  "planning/testing-strategy.md",
  "planning/development-workflow.md",
  "planning/deployment-topology.md",
  "planning/scribbles-runtime-integration.md",
  "planning/tactical-battler-rpg-foundation.md",
  "planning/decisions/0001-zero-dependency-walking-skeleton.md",
  "planning/decisions/0002-websockets-are-projections.md",
  "planning/decisions/0003-server-derived-player-identity.md",
  "planning/decisions/0004-signed-discord-activity-sessions.md",
  "planning/decisions/0005-scribbles-theo-identity-boundary.md",
  "planning/decisions/0006-scrollable-tactical-battlefields.md",
  "planning/decisions/0007-platform-proof-sequence-and-mock-agents.md",
  "planning/decisions/0008-public-source-proprietary-repository.md",
  "planning/validation/2026-07-27-canonical-baseline.md",
  ".github/workflows/ci.yml",
  "wrangler.jsonc",
];

for (const path of durableFiles) {
  const content = await readFile(join(repositoryRoot, path), "utf8");
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

const lockfile = JSON.parse(await readFile(join(repositoryRoot, "package-lock.json"), "utf8"));
assert.equal(lockfile.lockfileVersion, 3);
assert.equal(lockfile.packages[""].name, packageJson.name);
assert.deepEqual(lockfile.packages[""].devDependencies, packageJson.devDependencies);

const workflow = await readFile(
  join(repositoryRoot, ".github/workflows/ci.yml"),
  "utf8",
);
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

const gitignore = await readFile(join(repositoryRoot, ".gitignore"), "utf8");
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
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files;
}

const retiredProjectName = ["theo", "gameframe"].join("-");
const retiredPlatformTokens = [
  retiredProjectName,
  `@quankaiws/${retiredProjectName}`,
];
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

const readme = await readFile(join(repositoryRoot, "README.md"), "utf8");
assert.match(readme, /Scribbles GameFrame/);
assert.match(readme, /Scribbles Runtime/);
assert.match(readme, /Theo/);
assert.match(readme, /publicly viewable proprietary software/);
assert.match(readme, /No open-source license is granted/);

const notice = await readFile(join(repositoryRoot, "NOTICE"), "utf8");
assert.match(notice, /All rights reserved/);
assert.match(notice, /No open-source license/);

const roadmap = await readFile(join(repositoryRoot, "planning/ROADMAP.md"), "utf8");
assert.match(roadmap, /American checkers/);
assert.match(roadmap, /Monster-master tactical battler foundation/);
assert.match(roadmap, /RPG encounter and campaign foundation/);

const testingStrategy = await readFile(
  join(repositoryRoot, "planning/testing-strategy.md"),
  "utf8",
);
assert.match(testingStrategy, /Feature-branch verification/);
assert.match(testingStrategy, /Canonical merge verification/);
assert.match(testingStrategy, /Workers-runtime integration/);
assert.match(testingStrategy, /Browser acceptance/);
assert.match(testingStrategy, /Artifact policy/);
assert.match(testingStrategy, /Any commit added after the canonical pass invalidates that pass/);
assert.match(testingStrategy, /GitHub-hosted runner/);

const browserTest = await readFile(
  join(repositoryRoot, "test/browser/tic-tac-toe.spec.mjs"),
  "utf8",
);
assert.match(browserTest, /completes and resumes a deterministic match against Theo/);
assert.match(browserTest, /two browser seats can share, refresh, and complete one match/);
assert.match(browserTest, /mobile layout remains usable without horizontal overflow/);

const workerdTest = await readFile(
  join(repositoryRoot, "test/workerd/cloudflare-runtime.test.ts"),
  "utf8",
);
assert.match(workerdTest, /evictDurableObject/);
assert.match(workerdTest, /serializes competing writes/);
assert.match(workerdTest, /resumes a hibernatable WebSocket/);

const service = await readFile(
  join(repositoryRoot, "src/server/tic-tac-toe-match-service.ts"),
  "utf8",
);
assert.match(service, /PerfectTicTacToePlayer\("theo"\)/);
assert.doesNotMatch(service, /PerfectTicTacToePlayer\("scribbles"\)/);

console.log("Repository self-check passed.");
