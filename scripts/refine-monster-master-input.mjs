import { readFile, writeFile } from "node:fs/promises";

const path = "public/monster-master-app.js";
let source = await readFile(path, "utf8");

function replaceOnce(label, before, after) {
  if (!source.includes(before)) throw new Error(`Could not apply Monster Master input refinement: ${label}`);
  source = source.replace(before, after);
}

replaceOnce(
  "coordinate-first battlefield handler",
  `function handleCanvasClick(event) {\n  if (!current || requestPending) return;\n  const coordinate = canvasCoordinate(event);\n  if (!coordinate) return;\n  const clickedUnit = current.observation.board.units.find(\n    (unit) => unit.position.x === coordinate.x && unit.position.y === coordinate.y,\n  );\n  if (\n    current.observation.phase === "combat"\n    && clickedUnit?.id === current.observation.activeUnitId\n    && clickedUnit.ownerId === playerId\n  ) {\n    selectedUnitId = clickedUnit.id;\n    if (!actionMode) actionMode = current.observation.movementAvailable ? "move" : "attack";\n    previewAction = legalActions(actionMode)[0] ?? null;\n    status.textContent = statusText();\n    updateActionControls();\n    renderOptions();\n    drawScene();\n    return;\n  }\n  const action = actionAt(coordinate);\n  if (action) void submitAction(action);\n}\n`,
  `function handleBattlefieldCoordinate(coordinate) {\n  if (!current || requestPending || !coordinate) return;\n  const clickedUnit = current.observation.board.units.find(\n    (unit) => unit.position.x === coordinate.x && unit.position.y === coordinate.y,\n  );\n  if (\n    current.observation.phase === "combat"\n    && clickedUnit?.id === current.observation.activeUnitId\n    && clickedUnit.ownerId === playerId\n  ) {\n    selectedUnitId = clickedUnit.id;\n    if (!actionMode) actionMode = current.observation.movementAvailable ? "move" : "attack";\n    previewAction = legalActions(actionMode)[0] ?? null;\n    status.textContent = statusText();\n    updateActionControls();\n    renderOptions();\n    drawScene();\n    return;\n  }\n  const action = actionAt(coordinate);\n  if (action) void submitAction(action);\n}\n\nfunction handleCanvasClick(event) {\n  handleBattlefieldCoordinate(canvasCoordinate(event));\n}\n`,
);

replaceOnce(
  "Pixi coordinate event",
  `canvas.addEventListener("click", handleCanvasClick);\ncanvas.addEventListener("pointermove", handleCanvasMove);\n`,
  `canvas.addEventListener("click", handleCanvasClick);\nwindow.addEventListener("gameframe:monster-master-coordinate", (event) => {\n  const coordinate = event.detail?.coordinate;\n  if (\n    !coordinate\n    || !Number.isFinite(coordinate.x)\n    || !Number.isFinite(coordinate.y)\n  ) return;\n  handleBattlefieldCoordinate({ x: Math.round(coordinate.x), y: Math.round(coordinate.y) });\n});\ncanvas.addEventListener("pointermove", handleCanvasMove);\n`,
);

await writeFile(path, source, "utf8");
console.log("Applied direct Monster Master battlefield coordinate input.");
