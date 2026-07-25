import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
assert.equal(packageJson.private, true);
assert.equal(packageJson.type, "module");
assert.match(packageJson.engines.node, /22/);

for (const path of [
  "../../README.md",
  "../../AGENTS.md",
  "../../NOTICE",
  "../../planning/ROADMAP.md",
  "../../planning/architecture.md",
  "../../planning/testing-strategy.md",
  "../../planning/deployment-topology.md",
  "../../planning/openclaw-integration.md",
  "../../planning/decisions/0002-websockets-are-projections.md",
  "../../wrangler.jsonc",
]) {
  const content = await readFile(new URL(path, import.meta.url), "utf8");
  assert.ok(content.trim().length > 40, `${path} must contain durable content.`);
}

console.log("Repository self-check passed.");
