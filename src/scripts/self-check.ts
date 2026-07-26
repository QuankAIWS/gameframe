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
  "planning/ROADMAP.md",
  "planning/architecture.md",
  "planning/testing-strategy.md",
  "planning/deployment-topology.md",
  "planning/scribbles-runtime-integration.md",
  "planning/decisions/0002-websockets-are-projections.md",
  "planning/decisions/0003-server-derived-player-identity.md",
  "planning/decisions/0004-signed-discord-activity-sessions.md",
  "planning/decisions/0005-scribbles-theo-identity-boundary.md",
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

const retiredPlatformTokens = [
  "theo-gameframe",
  "@quankaiws/theo-gameframe",
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

const service = await readFile(
  join(repositoryRoot, "src/server/tic-tac-toe-match-service.ts"),
  "utf8",
);
assert.match(service, /PerfectTicTacToePlayer\("theo"\)/);
assert.doesNotMatch(service, /PerfectTicTacToePlayer\("scribbles"\)/);

console.log("Repository self-check passed.");
