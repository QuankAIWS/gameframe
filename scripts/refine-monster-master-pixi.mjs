import { readFile, writeFile } from "node:fs/promises";

const path = "src/browser/monster-master-pixi-entry.js";
let source = await readFile(path, "utf8");

function replaceOnce(label, before, after) {
  if (!source.includes(before)) throw new Error(`Could not apply Pixi refinement: ${label}`);
  source = source.replace(before, after);
}

replaceOnce(
  "state signatures",
  `  view: null,\n  diagnostics: {},\n`,
  `  view: null,\n  viewSignature: "",\n  diagnostics: {},\n  diagnosticsSignature: "",\n`,
);

replaceOnce(
  "revision-aware capture",
  `function captureView(candidate) {\n  const view = isMonsterView(candidate) ? candidate : isMonsterView(candidate?.view) ? candidate.view : null;\n  if (!view) return;\n\n  const previousActive = state.view?.observation?.activeUnitId;\n  state.view = view;\n  const nextActive = view.observation.activeUnitId;\n  if (!previousActive || previousActive !== nextActive) {\n    const unit = units().find((candidateUnit) => candidateUnit.id === nextActive);\n    if (unit?.position?.x >= 0) {\n      state.camera.x = unit.position.x;\n      state.camera.y = unit.position.y;\n      saveCamera();\n    }\n  } else if (!state.terrainSignature) {\n    const sourceMap = view.observation.board.map;\n    state.camera.x = (sourceMap.width - 1) / 2;\n    state.camera.y = (sourceMap.height - 1) / 2;\n  }\n\n  scheduleRender();\n  window.dispatchEvent(new CustomEvent(VIEW_EVENT, { detail: { view } }));\n}\n`,
  `function captureView(candidate) {\n  const view = isMonsterView(candidate) ? candidate : isMonsterView(candidate?.view) ? candidate.view : null;\n  if (!view) return;\n\n  const signature = \`${"${view.matchId}:${view.revision}"}\`;\n  const changed = signature !== state.viewSignature;\n  const previousActive = state.view?.observation?.activeUnitId;\n  state.view = view;\n  if (!changed) return;\n  state.viewSignature = signature;\n\n  const nextActive = view.observation.activeUnitId;\n  if (!previousActive || previousActive !== nextActive) {\n    const unit = units().find((candidateUnit) => candidateUnit.id === nextActive);\n    if (unit?.position?.x >= 0) {\n      state.camera.x = unit.position.x;\n      state.camera.y = unit.position.y;\n      saveCamera();\n    }\n  } else if (!state.terrainSignature) {\n    const sourceMap = view.observation.board.map;\n    state.camera.x = (sourceMap.width - 1) / 2;\n    state.camera.y = (sourceMap.height - 1) / 2;\n  }\n\n  scheduleRender();\n  window.dispatchEvent(new CustomEvent(VIEW_EVENT, { detail: { view } }));\n}\n`,
);

replaceOnce(
  "diagnostic signature helper",
  `function diagnostics() {\n  try {\n    return JSON.parse(document.querySelector("#monster-master-details")?.textContent || "{}");\n  } catch {\n    return {};\n  }\n}\n`,
  `function diagnostics() {\n  try {\n    return JSON.parse(document.querySelector("#monster-master-details")?.textContent || "{}");\n  } catch {\n    return {};\n  }\n}\n\nfunction diagnosticsSignature(value) {\n  return \`${"${value.actionMode ?? \"\"}:${value.selectedUnitId ?? \"\"}"}\`;\n}\n`,
);

replaceOnce(
  "logical renderer resize",
  `  state.app = app;\n  app.canvas.id = "monster-master-pixi-canvas";\n`,
  `  state.app = app;\n  app.renderer.resize(Math.max(1, frame.clientWidth), Math.max(1, frame.clientHeight));\n  app.canvas.id = "monster-master-pixi-canvas";\n`,
);

replaceOnce(
  "deduplicated diagnostics observer",
  `  if (detailNode) {\n    new MutationObserver(() => {\n      state.diagnostics = diagnostics();\n      scheduleRender();\n    }).observe(detailNode, { childList: true, subtree: true, characterData: true });\n  }\n`,
  `  if (detailNode) {\n    new MutationObserver(() => {\n      const next = diagnostics();\n      const signature = diagnosticsSignature(next);\n      if (signature === state.diagnosticsSignature) return;\n      state.diagnostics = next;\n      state.diagnosticsSignature = signature;\n      scheduleRender();\n    }).observe(detailNode, { childList: true, subtree: true, characterData: true });\n  }\n`,
);

replaceOnce(
  "nonblocking initialization",
  `interceptState();\nawait initialize();\n\nwindow.gameFrameMonsterPixi = Object.freeze({\n  getView: () => state.view,\n`,
  `interceptState();\nconst ready = initialize().then(() => true).catch((error) => {\n  console.error("Monster Master Pixi initialization failed.", error);\n  document.body.classList.add("monster-master-pixi-failed");\n  return false;\n});\n\nwindow.gameFrameMonsterPixi = Object.freeze({\n  ready,\n  getView: () => state.view,\n`,
);

await writeFile(path, source, "utf8");
console.log("Applied Monster Master Pixi runtime refinements.");
// Triggered against the latest migration head; remove this one-time script after validation.
