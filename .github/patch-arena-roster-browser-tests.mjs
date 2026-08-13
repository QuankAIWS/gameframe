import { readFile, writeFile } from "node:fs/promises";

async function patch(path, transform) {
  const text = await readFile(path, "utf8");
  const next = transform(text);
  if (next === text) throw new Error(`No change applied to ${path}`);
  await writeFile(path, next);
}

await patch("test/browser/monster-master-controls.spec.mjs", (text) =>
  text.replace('toContainText("Stone Bulwark")', 'toContainText("Rootmaw Brute")'));

await patch("test/browser/monster-master.spec.mjs", (text) => {
  let next = text
    .replaceAll('toContainText("Verdant Sage")', 'toContainText("Vanguard")')
    .replace('toContainText("Beta Verdant Sage")', 'toContainText("Beta Vanguard")')
    .replace('toContainText("Stone Bulwark")', 'toContainText("Rootmaw Brute")');

  const signature = 'function chooseDeterministicAction(view, { passiveCombat = false } = {}) {';
  if (!next.includes(signature)) throw new Error("Deterministic action signature anchor missing");
  next = next.replace(signature, 'function chooseDeterministicAction(view, { passiveCombat = false, preferSupportSetup = false } = {}) {');

  const attackAnchor = '  const enemyMasterAttack = actions.find((action) => (\n    action.type === "attack"\n    && view.observation.board.units.find((unit) => unit.id === action.targetUnitId)?.role === "master"\n  ));';
  if (!next.includes(attackAnchor)) throw new Error("Attack selection anchor missing");
  next = next.replace(attackAnchor, `  const supportAttack = preferSupportSetup ? actions.find((action) => (\n    action.type === "attack"\n    && view.observation.board.units.find((unit) => unit.id === action.targetUnitId)?.role !== "master"\n  )) : null;\n  if (supportAttack) return supportAttack;\n\n${attackAnchor}`);

  const mendSetup = 'const prepared = await prepareAuthoritativeState(request, (view) => view.observation.legalActions.some((action) => action.type === "use-ability"));';
  if (!next.includes(mendSetup)) throw new Error("Mend setup anchor missing");
  next = next.replace(mendSetup, 'const prepared = await prepareAuthoritativeState(request, (view) => view.observation.legalActions.some((action) => action.type === "use-ability"), { preferSupportSetup: true });');
  return next;
});
