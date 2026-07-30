import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const read = (path: string) => readFile(join(repositoryRoot, path), "utf8");

test("TC-0001 remains durably complete and TC-0002 remains the active tactical lane", async () => {
  const validation = await read("planning/validation/2026-07-30-tactical-canvas-canary.md");
  assert.match(validation, /Frozen feature head: `8ec9b50fa00d7f2ffb4970b179df27e511979458`/);
  assert.match(validation, /Canonical Validation run: #52 \(`30504067555`\)/);
  assert.match(validation, /Squash merge: `64937b76bcca5cd0ed515b2d801fd9a01bffe0bc`/);
  assert.match(validation, /92 core repository tests passed/);
  assert.match(validation, /6 real Workers-runtime tests passed/);
  assert.match(validation, /10 Playwright browser tests passed/);

  const roadmap = await read("planning/ROADMAP.md");
  assert.match(roadmap, /TC-0001 .* Complete/);
  assert.match(roadmap, /TC-0002 .* Active/);
  assert.match(roadmap, /Initiative, activations, line of sight, combat, effects, and victory/);
  assert.match(roadmap, /GF-0004 .* Paused/);

  const agents = await read("AGENTS.md");
  assert.match(agents, /GF-0010 \/ TC-0002/);
  assert.match(agents, /move-plus-primary-action budget/);
  assert.match(agents, /Do not expand TC-0002 into reactions/);

  const readme = await read("README.md");
  assert.match(readme, /TC-0001 tactical map, movement, Canvas, service, and Workers-runtime canary/);
  assert.match(readme, /GF-0010 \/ TC-0002/);
  assert.match(readme, /tactical-canvas-canary\.md/);
});
