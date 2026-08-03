import { readFile, writeFile } from "node:fs/promises";

async function edit(path, transform) {
  const original = await readFile(path, "utf8");
  const updated = transform(original);
  if (updated === original) {
    console.log(`${path}: already optimized`);
    return;
  }
  await writeFile(path, updated, "utf8");
  console.log(`${path}: optimized`);
}

function replaceOnce(source, label, before, after) {
  if (!source.includes(before)) throw new Error(`Could not apply Pixi performance refinement: ${label}`);
  return source.replace(before, after);
}

await edit("public/monster-master-app.js", (input) => {
  if (input.includes("function renderDiagnostics(layout = null)")) return input;
  return replaceOnce(
    input,
    "disable hidden legacy battlefield drawing",
    `function drawScene() {\n  if (!current) return;\n  const layout = layoutCanvas(current.observation.board.map);\n  lastCanvasLayout = layout;\n  drawGrid(current, layout);\n  drawPreview(layout);\n  drawUnits(current, layout);\n  drawCoordinates(layout);\n  details.textContent = JSON.stringify({\n    gameId,\n    matchId: current.matchId,\n    playerId,\n    revision: current.revision,\n    phase: current.observation.phase,\n    round: current.observation.round,\n    activePlayerId: activePlayerId(),\n    activeUnitId: current.observation.activeUnitId,\n    selectedUnitId,\n    actionMode,\n    commandByPlayer: current.observation.commandByPlayer,\n    legalActionCount: current.observation.legalActions.length,\n    undeployedUnitIds: current.observation.undeployedUnitIds,\n    defeatedUnitIds: current.observation.defeatedUnitIds,\n    viewport: { centerX: viewport.centerX, centerY: viewport.centerY, zoom: viewport.zoom, bounds: layout.bounds },\n  }, null, 2);\n}\n`,
    `function renderDiagnostics(layout = null) {\n  const pixiCamera = window.gameFrameMonsterPixi?.getCamera?.();\n  const camera = pixiCamera\n    ? {\n        centerX: pixiCamera.x,\n        centerY: pixiCamera.y,\n        zoom: pixiCamera.zoom,\n        quarter: pixiCamera.quarter,\n        bounds: null,\n      }\n    : {\n        centerX: viewport.centerX,\n        centerY: viewport.centerY,\n        zoom: viewport.zoom,\n        bounds: layout?.bounds ?? null,\n      };\n  details.textContent = JSON.stringify({\n    gameId,\n    matchId: current.matchId,\n    playerId,\n    revision: current.revision,\n    phase: current.observation.phase,\n    round: current.observation.round,\n    activePlayerId: activePlayerId(),\n    activeUnitId: current.observation.activeUnitId,\n    selectedUnitId,\n    actionMode,\n    commandByPlayer: current.observation.commandByPlayer,\n    legalActionCount: current.observation.legalActions.length,\n    undeployedUnitIds: current.observation.undeployedUnitIds,\n    defeatedUnitIds: current.observation.defeatedUnitIds,\n    viewport: camera,\n  }, null, 2);\n}\n\nfunction drawScene() {\n  if (!current) return;\n  if (window.gameFrameMonsterRendererMode === "pixi") {\n    renderDiagnostics();\n    return;\n  }\n  window.gameFrameMonsterLegacyDrawCount = (window.gameFrameMonsterLegacyDrawCount ?? 0) + 1;\n  const layout = layoutCanvas(current.observation.board.map);\n  lastCanvasLayout = layout;\n  drawGrid(current, layout);\n  drawPreview(layout);\n  drawUnits(current, layout);\n  drawCoordinates(layout);\n  renderDiagnostics(layout);\n}\n`,
  );
});

await edit("public/monster-master-shell.js", (input) => {
  if (input.includes('if (window.gameFrameMonsterRendererMode === "pixi") return;')) return input;
  let source = replaceOnce(
    input,
    "stop legacy HUD writes",
    `function syncHud() {\n  syncPending = false;\n  updateShellState();\n  if (!hud.root) return;\n`,
    `function syncHud() {\n  syncPending = false;\n  updateShellState();\n  if (window.gameFrameMonsterRendererMode === "pixi") return;\n  if (!hud.root) return;\n`,
  );
  source = replaceOnce(
    source,
    "avoid redundant HUD animation frames",
    `function scheduleSync() {\n  if (syncPending) return;\n  syncPending = true;\n  requestAnimationFrame(syncHud);\n}\n`,
    `function scheduleSync() {\n  if (window.gameFrameMonsterRendererMode === "pixi") {\n    updateShellState();\n    return;\n  }\n  if (syncPending) return;\n  syncPending = true;\n  requestAnimationFrame(syncHud);\n}\n`,
  );
  return source;
});

await edit("public/monster-master-correction.js", (input) => {
  if (input.includes("const monsterViewEvent = \"gameframe:monster-master-pixi-view\"")) return input;
  let source = input;
  const colorStart = source.indexOf("function canonicalColor(value) {");
  const networkStart = source.indexOf("const nativeFetch = window.fetch.bind(window);");
  if (colorStart < 0 || networkStart < 0 || networkStart <= colorStart) {
    throw new Error("Could not locate correction Canvas/network compatibility blocks.");
  }
  source = `${source.slice(0, colorStart)}${source.slice(networkStart)}`;
  const fetchStart = source.indexOf("const nativeFetch = window.fetch.bind(window);");
  const observerStart = source.indexOf("const rosterObserver = new MutationObserver", fetchStart);
  if (fetchStart < 0 || observerStart < 0) throw new Error("Could not locate correction network observers.");
  const subscription = `const monsterViewEvent = "gameframe:monster-master-pixi-view";\nwindow.addEventListener(monsterViewEvent, (event) => capture(event.detail?.view));\nqueueMicrotask(() => {\n  const current = window.gameFrameMonsterController?.getView?.();\n  if (current) capture(current);\n});\n\n`;
  source = `${source.slice(0, fetchStart)}${subscription}${source.slice(observerStart)}`;
  source = source.replace(
    `  scheduleTurnOrder();\n  requestAnimationFrame(() => window.gameFrameMonsterProjection?.render?.());\n`,
    `  scheduleTurnOrder();\n`,
  );
  return source;
});

await edit("public/monster-master-overlay.js", (input) => {
  if (input.includes("const monsterViewEvent = \"gameframe:monster-master-pixi-view\"")) return input;
  const networkStart = input.indexOf("const nativeFetch = window.fetch.bind(window);");
  const rosterObserverStart = input.indexOf("const rosterObserver = new MutationObserver", networkStart);
  if (networkStart < 0 || rosterObserverStart < 0) {
    throw new Error("Could not locate overlay network observers.");
  }
  const subscription = `const monsterViewEvent = "gameframe:monster-master-pixi-view";\nwindow.addEventListener(monsterViewEvent, (event) => capture(event.detail?.view));\nqueueMicrotask(() => {\n  const current = window.gameFrameMonsterController?.getView?.();\n  if (current) capture(current);\n});\n\n`;
  return `${input.slice(0, networkStart)}${subscription}${input.slice(rosterObserverStart)}`;
});

await edit("public/monster-master-pixi-bridge.js", (input) => {
  if (input.startsWith('window.gameFrameMonsterRendererMode = "pixi";')) return input;
  return `window.gameFrameMonsterRendererMode = "pixi";\n${input}`;
});

console.log("Monster Master Pixi performance consolidation complete.");
