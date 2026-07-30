import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const read = (path: string) => readFile(join(repositoryRoot, path), "utf8");

test("TC-0001 durable files and projection-independent boundaries remain present", async () => {
  const requiredFiles = [
    "src/games/tactical-core/index.ts",
    "src/games/tactical-core/index.test.ts",
    "src/client/tactical/viewport.ts",
    "src/client/tactical/viewport.test.ts",
    "planning/tactical-core-contract.md",
    "planning/tactical-battler-rpg-foundation.md",
    "planning/decisions/0006-scrollable-tactical-battlefields.md",
  ];
  for (const path of requiredFiles) {
    const content = await read(path);
    assert.ok(content.trim().length > 40, `${path} must contain durable TC-0001 content.`);
  }

  const tacticalCore = await read("src/games/tactical-core/index.ts");
  assert.match(tacticalCore, /gameId: "tactical-movement-canary"/);
  assert.match(tacticalCore, /TACTICAL_CANARY_MAP_WIDTH = 24/);
  assert.match(tacticalCore, /TACTICAL_CANARY_MAP_HEIGHT = 24/);
  assert.match(tacticalCore, /function searchReachable/);
  assert.match(tacticalCore, /movementCost/);
  assert.match(tacticalCore, /path: TacticalCoordinate\[\]/);
  assert.match(tacticalCore, /DeterministicTacticalMovementPlayer/);
  assert.doesNotMatch(tacticalCore, /camera|viewport|canvas/i);

  const viewport = await read("src/client/tactical/viewport.ts");
  assert.match(viewport, /baseColumns: number/);
  assert.match(viewport, /baseRows: number/);
  assert.match(viewport, /panTacticalViewport/);
  assert.match(viewport, /zoomTacticalViewport/);
  assert.match(viewport, /tacticalVisibleBounds/);
  assert.doesNotMatch(viewport, /MatchSession|GameDefinition|submitAction/);

  const contract = await read("planning/tactical-core-contract.md");
  assert.match(contract, /24x24/);
  assert.match(contract, /12x9/);
  assert.match(contract, /Camera position, pan, zoom/);
  assert.match(contract, /Complete movement actions/);
  assert.match(contract, /Explicitly deferred from TC-0001/);
});
