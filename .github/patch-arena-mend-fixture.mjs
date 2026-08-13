import { readFile, writeFile } from "node:fs/promises";
const path = "test/browser/monster-master.spec.mjs";
let text = await readFile(path, "utf8");
const anchor = `function chooseDeterministicAction(view, { passiveCombat = false, preferSupportSetup = false } = {}) {
  if (view.observation.phase === "deployment") return chooseDeployment(view);
  const actions = view.observation.legalActions;
  if (passiveCombat) return actions.find((action) => action.type === "end-activation");

  const supportAttack = preferSupportSetup ? actions.find((action) => (
    action.type === "attack"
    && view.observation.board.units.find((unit) => unit.id === action.targetUnitId)?.role !== "master"
  )) : null;`;
const replacement = `function chooseDeterministicAction(view, { passiveCombat = false, preferSupportSetup = false } = {}) {
  if (view.observation.phase === "deployment") return chooseDeployment(view);
  const actions = view.observation.legalActions;
  if (passiveCombat) return actions.find((action) => action.type === "end-activation");

  const activeUnit = view.observation.board.units.find((unit) => unit.id === view.observation.activeUnitId);
  if (preferSupportSetup && activeUnit?.role === "master") {
    const damagedFriendly = view.observation.board.units
      .filter((unit) => unit.ownerId === activeUnit.ownerId && unit.id !== activeUnit.id && unit.health > 0 && unit.health < unit.maxHealth)
      .sort((left, right) => left.health / left.maxHealth - right.health / right.maxHealth || left.id.localeCompare(right.id))[0];
    if (damagedFriendly) {
      const supportMove = [...actions]
        .filter((action) => action.type === "move")
        .sort((left, right) => {
          const leftTarget = destination(left);
          const rightTarget = destination(right);
          const leftDistance = Math.max(Math.abs(leftTarget.x - damagedFriendly.position.x), Math.abs(leftTarget.y - damagedFriendly.position.y));
          const rightDistance = Math.max(Math.abs(rightTarget.x - damagedFriendly.position.x), Math.abs(rightTarget.y - damagedFriendly.position.y));
          return leftDistance - rightDistance || right.movementCost - left.movementCost;
        })[0];
      if (supportMove) return supportMove;
    }
    return actions.find((action) => action.type === "end-activation");
  }

  const supportAttack = preferSupportSetup ? actions.find((action) => (
    action.type === "attack"
    && view.observation.board.units.find((unit) => unit.id === action.targetUnitId)?.role !== "master"
  )) : null;`;
if (!text.includes(anchor)) throw new Error("Mend fixture anchor missing");
text = text.replace(anchor, replacement);
await writeFile(path, text);
