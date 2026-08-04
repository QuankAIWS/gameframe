import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const read = async (path) => await readFile(new URL(path, root), "utf8");

test("Monster Master target options use a stable body-level interaction layer", async () => {
  const [launcher, layer, styles, browserSpec, packageSource, workflow] = await Promise.all([
    read("public/auth-launcher.js"),
    read("public/monster-master-option-layer.js"),
    read("public/monster-master-option-layer.css"),
    read("test/browser/monster-master-option-hit-testing.spec.mjs"),
    read("package.json"),
    read(".github/workflows/player-ui-review.yml"),
  ]);
  const packageJson = JSON.parse(packageSource);

  const correctionImport = launcher.indexOf('await import("./monster-master-correction.js")');
  const optionLayerImport = launcher.indexOf('await import("./monster-master-option-layer.js")');
  const monsterAppImport = launcher.indexOf("await import(entry)", optionLayerImport);
  assert.ok(correctionImport >= 0);
  assert.ok(optionLayerImport > correctionImport);
  assert.ok(monsterAppImport > optionLayerImport);

  assert.match(layer, /document\.body\.append\(options\)/);
  assert.match(layer, /data\.optionLayer = "true"/);
  assert.match(layer, /installStableOptionReconciliation/);
  assert.match(layer, /nodesSignature\(currentNodes\) === nodesSignature\(nextNodes\)/);
  assert.match(layer, /queueMicrotask\(flushPendingOptions\)/);
  assert.match(layer, /new MutationObserver\(scheduleOptionLayerPosition\)/);
  assert.doesNotMatch(layer, /attributes:\s*true/);

  assert.match(styles, /#monster-master-options\[data-option-layer="true"\]/);
  assert.match(styles, /position:\s*fixed !important/);
  assert.match(styles, /--monster-option-layer-left/);
  assert.match(styles, /--monster-option-layer-width/);
  assert.match(styles, /--monster-option-layer-bottom/);
  assert.match(styles, /pointer-events:\s*auto !important/);

  assert.match(browserSpec, /document\.elementFromPoint/);
  assert.match(browserSpec, /__monsterMasterStableOption/);
  assert.match(browserSpec, /desktop target options remain stable/);
  assert.match(browserSpec, /mobile target options remain stable/);

  assert.match(
    packageJson.scripts["test:browser:required"],
    /monster-master-option-hit-testing\.spec\.mjs/,
  );
  assert.match(
    packageJson.scripts["check:browser"],
    /monster-master-option-layer\.js/,
  );
  assert.match(workflow, /monster-master-option-layer-contract\.test\.mjs/);
  assert.match(workflow, /monster-master-option-hit-testing\.spec\.mjs/);
});
