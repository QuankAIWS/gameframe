import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const read = (path: string) => readFile(join(repositoryRoot, path), "utf8");

test("the tactical Canvas canary remains a projection over shared authority", async () => {
  const requiredFiles = [
    "public/tactical.html",
    "public/tactical.css",
    "public/tactical-app.js",
    "src/server/tactical-movement-match-service.ts",
    "src/server/tactical-movement-match-service.test.ts",
    "src/server/tactical-http.test.ts",
    "test/browser/tactical-movement.spec.mjs",
    "planning/tactical-canvas-canary.md",
  ];
  for (const path of requiredFiles) {
    const content = await read(path);
    assert.ok(content.trim().length > 40, `${path} must contain durable tactical Canvas content.`);
  }

  const tacticalPage = await read("public/tactical.html");
  assert.match(tacticalPage, /id="tactical-canvas"/);
  assert.match(tacticalPage, /Pan camera north/);
  assert.match(tacticalPage, /id="tactical-destinations"/);

  const tacticalClient = await read("public/tactical-app.js");
  assert.match(tacticalClient, /const gameId = "tactical-movement-canary"/);
  assert.match(tacticalClient, /function visibleBounds/);
  assert.match(tacticalClient, /function panViewport/);
  assert.match(tacticalClient, /function changeZoom/);
  assert.match(tacticalClient, /current\.observation\.legalActions/);
  assert.match(tacticalClient, /expectedRevision: current\.revision/);
  assert.match(tacticalClient, /action,/);
  assert.doesNotMatch(tacticalClient, /applyTacticalMove|searchReachable|MatchSession/);

  const tacticalService = await read("src/server/tactical-movement-match-service.ts");
  assert.match(tacticalService, /tacticalMovementDefinition/);
  assert.match(tacticalService, /chooseAgentDecision/);
  assert.match(tacticalService, /DeterministicTacticalMovementPlayer\("theo"\)/);

  const inMemoryDispatch = await read("src/server/in-memory-match-service.ts");
  assert.match(inMemoryDispatch, /"tactical-movement-canary"/);
  assert.match(inMemoryDispatch, /TacticalMovementMatchService/);
  assert.match(inMemoryDispatch, /parseTacticalMovementAction/);

  const durableRuntime = await read("src/cloudflare/match-object-runtime.ts");
  assert.match(durableRuntime, /TacticalMovementMatchService/);
  assert.match(durableRuntime, /"tactical-movement-canary"/);
  assert.match(durableRuntime, /parseTacticalMovementAction/);

  const workerdTest = await read("test/workerd/cloudflare-runtime.test.ts");
  assert.match(workerdTest, /restores tactical state and canonical paths after Durable Object eviction/);

  const browserTest = await read("test/browser/tactical-movement.spec.mjs");
  assert.match(browserTest, /plays, pans, zooms, and resumes/);
  assert.match(browserTest, /two browser seats share and advance/);
  assert.match(browserTest, /without horizontal overflow on mobile/);
});
