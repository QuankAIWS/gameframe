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

const durableFiles = [
  "README.md",
  "AGENTS.md",
  "NOTICE",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "planning/ROADMAP.md",
  "planning/architecture.md",
  "planning/testing-strategy.md",
  "planning/development-workflow.md",
  "planning/deployment-topology.md",
  "planning/scribbles-runtime-integration.md",
  "planning/decisions/0002-websockets-are-projections.md",
  "planning/decisions/0003-server-derived-player-identity.md",
  "planning/decisions/0004-signed-discord-activity-sessions.md",
  "planning/decisions/0005-scribbles-theo-identity-boundary.md",
  "planning/decisions/0008-public-source-proprietary-repository.md",
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

const testingStrategy = await readFile(
  join(repositoryRoot, "planning/testing-strategy.md"),
  "utf8",
);
assert.match(testingStrategy, /Feature-branch verification/);
assert.match(testingStrategy, /Canonical merge verification/);
assert.match(testingStrategy, /Any commit added after the canonical pass invalidates that pass/);
assert.match(testingStrategy, /GitHub-hosted runner/);

const service = await readFile(
  join(repositoryRoot, "src/server/tic-tac-toe-match-service.ts"),
  "utf8",
);
assert.match(service, /PerfectTicTacToePlayer\("theo"\)/);
assert.doesNotMatch(service, /PerfectTicTacToePlayer\("scribbles"\)/);

console.log("Repository self-check passed.");
