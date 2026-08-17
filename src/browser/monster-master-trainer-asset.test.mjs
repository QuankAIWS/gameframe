import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../../public/monster-master-trainer-asset.js", import.meta.url),
  "utf8",
);

const contentIds = [
  "vanguard-trainer-v1",
  "commander-trainer-v1",
  "arcanic-trainer-v1",
  "medic-trainer-v1",
  "caller-trainer-v1",
  "rootmaw-brute-v1",
  "gloamspore-stalker-v1",
  "voidshard-reaver-v1",
  "stormcrest-skitter-v1",
  "mossmaw-colossus-v1",
];

test("illustrated Monster Master units use a shallow contact shadow instead of an opaque token disc", () => {
  assert.match(source, /--monster-master-contact-shadow-height:\s*16px/);
  assert.match(source, /radial-gradient\(ellipse at center, rgba\(0, 0, 0, \.30\)/);
  assert.match(source, /filter:\s*blur\(1\.5px\)/);
  assert.match(source, /Math\.max\(13, Math\.min\(20, Math\.round\(artHeight \* 0\.12\)\)\)/);
  assert.doesNotMatch(source, /width:\s*88px;\s*height:\s*88px/);
  assert.doesNotMatch(source, /radial-gradient\(circle at 50% 60%/);
  assert.doesNotMatch(source, /rgba\([^)]*,\s*\.9[68]\)\s*0\s*50%/);
});

test("illustrated artwork is explicitly layered above its contact shadow", () => {
  assert.match(source, /\.monster-master-trainer-token::before\s*\{[^}]*z-index:\s*0/s);
  assert.match(source, /\.monster-master-trainer-token img\s*\{[^}]*z-index:\s*1/s);
});

test("battlefield art consumes canonical scale and anchors in Pixi canvas-local coordinates", () => {
  assert.match(source, /battlefieldScale:\s*1\.58/);
  assert.match(source, /anchorY:\s*0\.88/);
  assert.match(source, /const artHeight = Math\.round\(BASE_BATTLEFIELD_HEIGHT \* presentation\.battlefieldScale\)/);
  assert.match(source, /image\.style\.top = `\$\{\-\(artHeight \* presentation\.anchorY\)\}px`/);
  assert.match(source, /token\.dataset\.anchorY = String\(presentation\.anchorY\)/);
  assert.match(source, /translate3d\(\$\{point\.x\}px, \$\{point\.y\}px, 0\) scale\(\$\{zoom\}\)/);
  assert.doesNotMatch(source, /point\.x - layerRect\.left/);
  assert.doesNotMatch(source, /point\.y - layerRect\.top/);
});

test("Monster Master keeps its Setup destination usable at compact desktop widths", () => {
  assert.match(source, /@media \(min-width: 721px\) and \(max-width: 1360px\)/);
  assert.match(source, /\.gameframe-destination-links \.monster-master-nav-setup\s*\{[^}]*display:\s*inline-flex !important[^}]*min-width:\s*70px/s);
});

test("every approved Arena illustration is available to world sprites and portraits", () => {
  for (const contentId of contentIds) {
    assert.ok(source.includes(`"${contentId}"`), `missing illustrated catalog entry: ${contentId}`);
  }
  assert.match(source, /function setPortraitArt\(/);
  assert.match(source, /background-image/);
  assert.match(source, /view\.observation\.phase === "deployment"[\s\S]*state\.selectedUnitId \?\? view\.observation\.activeUnitId/);
});

test("the illustration layer exposes one authoritative asset-ownership helper for the Pixi renderer", () => {
  assert.match(source, /window\.gameFrameMonsterIllustratedAssets\s*=\s*Object\.freeze\(\{/);
  assert.match(source, /hasAsset:\s*\(unit\)\s*=>\s*Boolean\(presentationFor\(unit\)\)/);
});
