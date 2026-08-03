import { readFile, writeFile } from "node:fs/promises";

const path = "src/browser/monster-master-pixi-entry.js";
let source = await readFile(path, "utf8");

function replaceOnce(label, before, after) {
  if (!source.includes(before)) throw new Error(`Could not apply Pixi camera refinement: ${label}`);
  source = source.replace(before, after);
}

replaceOnce(
  "logical camera dimensions",
  `function applyCamera() {\n  if (!state.layers || !state.app) return;\n  const renderer = state.app.renderer;\n  const center = cameraPoint();\n  state.layers.world.scale.set(state.camera.zoom);\n  state.layers.world.x = renderer.width / 2 - center.x * state.camera.zoom;\n  state.layers.world.y = renderer.height * 0.48 - center.y * state.camera.zoom;\n}\n`,
  `function applyCamera() {\n  if (!state.layers || !state.app || !state.frame) return;\n  const width = Math.max(1, state.frame.clientWidth);\n  const height = Math.max(1, state.frame.clientHeight);\n  const center = cameraPoint();\n  state.layers.world.scale.set(state.camera.zoom);\n  state.layers.world.x = width / 2 - center.x * state.camera.zoom;\n  state.layers.world.y = height * 0.48 - center.y * state.camera.zoom;\n}\n`,
);

replaceOnce(
  "logical resize observer",
  `  state.resizeObserver = new ResizeObserver(() => scheduleRender());\n  state.resizeObserver.observe(frame);\n`,
  `  state.resizeObserver = new ResizeObserver(() => {\n    if (state.app) {\n      state.app.renderer.resize(Math.max(1, frame.clientWidth), Math.max(1, frame.clientHeight));\n    }\n    scheduleRender();\n  });\n  state.resizeObserver.observe(frame);\n`,
);

await writeFile(path, source, "utf8");
console.log("Normalized Monster Master Pixi camera transforms to CSS pixels.");
