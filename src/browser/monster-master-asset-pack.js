export const MONSTER_MASTER_CORE_PACK_URL = "/assets/monster-master/packs/core-v1/manifest.json";

const ROLE_FALLBACK_CONTENT_IDS = Object.freeze({
  master: "warden-master-v1",
  bulwark: "stone-bulwark-v1",
  emberling: "emberling-skirmisher-v1",
});

function invariant(condition, message) {
  if (!condition) throw new Error(`Invalid Monster Master asset pack: ${message}`);
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function normalizedAnchor(anchor) {
  return anchor
    && Number.isFinite(anchor.x)
    && Number.isFinite(anchor.y)
    && anchor.x >= 0
    && anchor.x <= 1
    && anchor.y >= 0
    && anchor.y <= 1;
}

function validateRuntime(runtime, contentId) {
  invariant(typeof runtime.path === "string" && runtime.path.startsWith("/assets/"), `${contentId} runtime path`);
  invariant(runtime.format === "png" || runtime.format === "webp", `${contentId} runtime format`);
  invariant(positiveInteger(runtime.width), `${contentId} runtime width`);
  invariant(positiveInteger(runtime.height), `${contentId} runtime height`);
  invariant(typeof runtime.sha256 === "string" && /^[a-f0-9]{64}$/.test(runtime.sha256), `${contentId} runtime sha256`);
  invariant(typeof runtime.sourceMasterPath === "string" && runtime.sourceMasterPath.startsWith("public/assets/"), `${contentId} source master path`);
  invariant(typeof runtime.sourceMasterSha256 === "string" && /^[a-f0-9]{64}$/.test(runtime.sourceMasterSha256), `${contentId} source master sha256`);
  invariant(positiveInteger(runtime.sourceWidth), `${contentId} source width`);
  invariant(positiveInteger(runtime.sourceHeight), `${contentId} source height`);
  invariant(runtime.transform?.tool === "sharp", `${contentId} transform tool`);
  invariant(typeof runtime.transform?.version === "string", `${contentId} transform version`);
  invariant(runtime.transform?.fit === "contain", `${contentId} transform fit`);
}

export function validateMonsterMasterCorePack(manifest) {
  invariant(manifest && typeof manifest === "object", "manifest object");
  invariant(manifest.schemaVersion === 1, "schemaVersion must be 1");
  invariant(manifest.packId === "monster-master-core-v1", "packId");
  invariant(positiveInteger(manifest.packVersion), "packVersion");
  invariant(manifest.geometryProfile === "monster-master-isometric-72x36-wall29-v1", "geometryProfile");

  const atlas = manifest.legacyAtlas;
  invariant(atlas && typeof atlas === "object", "legacyAtlas");
  invariant(typeof atlas.path === "string" && atlas.path.startsWith("/assets/"), "legacyAtlas path");
  invariant(positiveInteger(atlas.cellWidth), "legacyAtlas cellWidth");
  invariant(positiveInteger(atlas.cellHeight), "legacyAtlas cellHeight");
  invariant(positiveInteger(atlas.columns), "legacyAtlas columns");
  invariant(positiveInteger(atlas.rows), "legacyAtlas rows");

  invariant(manifest.unitVisuals && typeof manifest.unitVisuals === "object", "unitVisuals");
  const entries = Object.entries(manifest.unitVisuals);
  invariant(entries.length > 0, "unitVisuals must not be empty");

  for (const [contentId, visual] of entries) {
    invariant(contentId.trim() === contentId && contentId.length > 0, "content ID");
    invariant(visual.family === "trainer" || visual.family === "monster", `${contentId} family`);
    invariant(typeof visual.continuityRef === "string" && visual.continuityRef.length > 0, `${contentId} continuityRef`);
    invariant(["legacy-fallback", "accepted", "superseded"].includes(visual.status), `${contentId} status`);
    invariant(normalizedAnchor(visual.battlefield?.anchor), `${contentId} battlefield anchor`);
    invariant(positiveInteger(visual.battlefield?.displayHeight), `${contentId} displayHeight`);
    invariant(typeof visual.battlefield?.mirrorSafe === "boolean", `${contentId} mirrorSafe`);

    if (visual.runtime) validateRuntime(visual.runtime, contentId);
    if (!visual.runtime) {
      invariant(visual.status === "legacy-fallback", `${contentId} without runtime must be a legacy fallback`);
      invariant(positiveInteger(visual.legacyFrame?.column + 1), `${contentId} legacy frame column`);
      invariant(positiveInteger(visual.legacyFrame?.row + 1), `${contentId} legacy frame row`);
      invariant(visual.legacyFrame.column < atlas.columns, `${contentId} legacy frame column bounds`);
      invariant(visual.legacyFrame.row < atlas.rows, `${contentId} legacy frame row bounds`);
      invariant(typeof visual.replacementTarget === "string" && visual.replacementTarget.length > 0, `${contentId} replacementTarget`);
    }
  }

  return manifest;
}

export async function loadMonsterMasterCorePack(fetchImpl = globalThis.fetch) {
  invariant(typeof fetchImpl === "function", "fetch implementation");
  const response = await fetchImpl(MONSTER_MASTER_CORE_PACK_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load Monster Master core pack (${response.status}).`);
  return validateMonsterMasterCorePack(await response.json());
}

export function resolveMonsterMasterUnitVisual(manifest, unit) {
  validateMonsterMasterCorePack(manifest);
  const direct = typeof unit?.contentId === "string" ? manifest.unitVisuals[unit.contentId] : null;
  if (direct) return { contentId: unit.contentId, ...direct };

  const fallbackContentId = ROLE_FALLBACK_CONTENT_IDS[unit?.role];
  const fallback = fallbackContentId ? manifest.unitVisuals[fallbackContentId] : null;
  invariant(fallback, `no visual for content ${unit?.contentId ?? "unknown"} or role ${unit?.role ?? "unknown"}`);
  return { contentId: fallbackContentId, ...fallback };
}

export function legacyFrameRectangle(manifest, visual) {
  invariant(visual?.legacyFrame, "legacy frame requested for a non-legacy visual");
  return {
    x: visual.legacyFrame.column * manifest.legacyAtlas.cellWidth,
    y: visual.legacyFrame.row * manifest.legacyAtlas.cellHeight,
    width: manifest.legacyAtlas.cellWidth,
    height: manifest.legacyAtlas.cellHeight,
  };
}

export function acceptedRuntimePaths(manifest) {
  validateMonsterMasterCorePack(manifest);
  return [...new Set(Object.values(manifest.unitVisuals)
    .map((visual) => visual.runtime?.path)
    .filter(Boolean))];
}
