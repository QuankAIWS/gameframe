import { readFile, writeFile } from "node:fs/promises";

async function edit(path, transform) {
  const original = await readFile(path, "utf8");
  const updated = transform(original);
  if (updated === original) {
    console.log(`${path}: already refined`);
    return;
  }
  await writeFile(path, updated, "utf8");
  console.log(`${path}: refined`);
}

function replaceOnce(source, label, before, after) {
  if (!source.includes(before)) throw new Error(`Could not apply state-channel refinement: ${label}`);
  return source.replace(before, after);
}

await edit("public/monster-master-app.js", (input) => {
  if (input.includes("window.gameFrameMonsterController = Object.freeze")) return input;
  let source = input;
  source = replaceOnce(
    source,
    "controller event constant",
    `const recentMatchStorageKey = "scribbles-gameframe.recent-monster-master-match";\n`,
    `const recentMatchStorageKey = "scribbles-gameframe.recent-monster-master-match";\nconst monsterMasterViewEvent = "gameframe:monster-master-pixi-view";\n`,
  );
  source = replaceOnce(
    source,
    "publish authoritative view",
    `  updateUrl(view.matchId);\n  startProjection(view.matchId);\n}\n`,
    `  updateUrl(view.matchId);\n  startProjection(view.matchId);\n  window.dispatchEvent(new CustomEvent(monsterMasterViewEvent, { detail: { view } }));\n}\n`,
  );
  source = replaceOnce(
    source,
    "controller facade",
    `function handleCanvasClick(event) {\n  handleBattlefieldCoordinate(canvasCoordinate(event));\n}\n`,
    `window.gameFrameMonsterController = Object.freeze({\n  getView: () => current,\n  handleCoordinate: (coordinate) => handleBattlefieldCoordinate(coordinate),\n});\n\nfunction handleCanvasClick(event) {\n  handleBattlefieldCoordinate(canvasCoordinate(event));\n}\n`,
  );
  return source;
});

await edit("src/browser/monster-master-pixi-entry.js", (input) => {
  if (input.includes("function subscribeToController()")) return input;
  let source = input;
  const start = source.indexOf("function interceptState() {");
  const end = source.indexOf("\nasync function initialize()", start);
  if (start < 0 || end < 0) throw new Error("Could not locate Pixi network interception block.");
  source = `${source.slice(0, start)}function subscribeToController() {\n  window.addEventListener(VIEW_EVENT, (event) => captureView(event.detail?.view));\n  const current = window.gameFrameMonsterController?.getView?.();\n  if (current) captureView(current);\n}\n${source.slice(end + 1)}`;
  source = replaceOnce(
    source,
    "controller subscription",
    `interceptState();\nconst ready = initialize().then(() => true).catch((error) => {\n`,
    `subscribeToController();\nconst ready = initialize().then(() => {\n  const current = window.gameFrameMonsterController?.getView?.();\n  if (current) captureView(current);\n  return true;\n}).catch((error) => {\n`,
  );
  return source;
});

await edit("public/auth-launcher.js", (input) => {
  if (input.includes("await import(entry);\n  await import(\"./monster-master-pixi-bundle.js\");")) return input;
  return replaceOnce(
    input,
    "Monster Master startup order",
    `if (entry === "/app.js") {\n  await import("./game-hub.js");\n  await import("./tic-tac-toe-noir.js");\n}\n\nif (entry === "/monster-master-app.js") {\n  await import("./monster-master-pixi-bridge.js");\n  await import("./monster-master-pixi-bundle.js");\n  await import("./monster-master-correction.js");\n  await import("./monster-master-overlay.js");\n  await import("./monster-master-overlay-guard.js");\n}\nawait import(entry);\n`,
    `if (entry === "/app.js") {\n  await import("./game-hub.js");\n  await import("./tic-tac-toe-noir.js");\n  await import(entry);\n} else if (entry === "/monster-master-app.js") {\n  await import("./monster-master-pixi-bridge.js");\n  await import("./monster-master-correction.js");\n  await import("./monster-master-overlay.js");\n  await import("./monster-master-overlay-guard.js");\n  await import(entry);\n  await import("./monster-master-pixi-bundle.js");\n} else {\n  await import(entry);\n}\n`,
  );
});

await edit("public/monster-master-pixi-bridge.js", (input) => {
  if (input.includes("controller?.handleCoordinate")) return input;
  return replaceOnce(
    input,
    "direct controller dispatch",
    `function dispatchCoordinate(coordinate) {\n  if (!coordinate || !Number.isFinite(coordinate.x) || !Number.isFinite(coordinate.y)) return false;\n  window.dispatchEvent(new CustomEvent(coordinateEvent, {\n    detail: { coordinate: { x: Math.round(coordinate.x), y: Math.round(coordinate.y) } },\n  }));\n  return true;\n}\n`,
    `function dispatchCoordinate(coordinate) {\n  if (!coordinate || !Number.isFinite(coordinate.x) || !Number.isFinite(coordinate.y)) return false;\n  const normalized = { x: Math.round(coordinate.x), y: Math.round(coordinate.y) };\n  const controller = window.gameFrameMonsterController;\n  if (controller?.handleCoordinate) {\n    controller.handleCoordinate(normalized);\n    return true;\n  }\n  window.dispatchEvent(new CustomEvent(coordinateEvent, { detail: { coordinate: normalized } }));\n  return true;\n}\n`,
  );
});
