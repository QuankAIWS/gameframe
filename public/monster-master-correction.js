const correctionStylesheetUrl = "/monster-master-correction.css";
let correctionStylesheet = document.querySelector(`link[href="${correctionStylesheetUrl}"]`);
if (!correctionStylesheet) {
  correctionStylesheet = document.createElement("link");
  correctionStylesheet.rel = "stylesheet";
  correctionStylesheet.href = correctionStylesheetUrl;
  document.head.append(correctionStylesheet);
}

const roster = document.querySelector("#monster-master-roster-list");
const rosterTitle = document.querySelector("#monster-master-roster-title");
const openRoster = document.querySelector("#monster-master-open-roster");
const rosterRail = document.querySelector("#monster-master-roster-rail");
const alphaCommand = document.querySelector("#monster-master-alpha-command");
const betaCommand = document.querySelector("#monster-master-beta-command");
const creatureAtlasUrl = "/assets/monster-master/creature-atlas-v1.svg";

let latestView = null;
let renderPending = false;
let renderingTurnOrder = false;

function isMonsterView(candidate) {
  return candidate?.gameId === "monster-master-duel"
    && candidate?.observation?.board?.map
    && Array.isArray(candidate?.observation?.playerIds);
}

function extractMonsterView(candidate) {
  if (isMonsterView(candidate)) return candidate;
  if (isMonsterView(candidate?.view)) return candidate.view;
  return null;
}

function friendlySeat(view) {
  const yourPlayerId = view?.observation?.yourPlayerId ?? window.gameFrameIdentity?.playerId;
  const index = view?.playerIds?.indexOf(yourPlayerId) ?? -1;
  return index === 1 ? "beta" : "alpha";
}

function setCommandLabels(seat) {
  const alphaLabel = alphaCommand?.closest("div")?.querySelector("dt");
  const betaLabel = betaCommand?.closest("div")?.querySelector("dt");
  if (alphaLabel) alphaLabel.textContent = seat === "alpha" ? "Your command" : "Enemy command";
  if (betaLabel) betaLabel.textContent = seat === "beta" ? "Your command" : "Enemy command";
}

function capture(candidate) {
  const view = extractMonsterView(candidate);
  if (!view) return;
  latestView = view;
  const seat = friendlySeat(view);
  document.body.dataset.monsterFriendlySeat = seat;
  setCommandLabels(seat);
  scheduleTurnOrder();
}

function roleLabel(role) {
  if (role === "master") return "Warden Master";
  if (role === "bulwark") return "Stone Bulwark";
  if (role === "emberling") return "Emberling";
  return "Unknown unit";
}

function roleFromUnit(unit) {
  if (unit?.role) return unit.role;
  const contentId = String(unit?.contentId ?? "");
  if (contentId.includes("bulwark")) return "bulwark";
  if (contentId.includes("emberling")) return "emberling";
  return "master";
}

function turnOrder(view) {
  const observation = view.observation;
  const defeated = new Set(observation.defeatedUnitIds ?? []);
  const units = Object.values(observation.rosters ?? {})
    .flat()
    .filter((unit) => !defeated.has(unit.id))
    .sort((left, right) => right.initiative - left.initiative || left.id.localeCompare(right.id));

  if (observation.phase !== "combat" || !observation.activeUnitId) return units;
  const activeIndex = units.findIndex((unit) => unit.id === observation.activeUnitId);
  if (activeIndex < 0) return units;
  return [...units.slice(activeIndex), ...units.slice(0, activeIndex)];
}

function unitState(view, unit) {
  return view.observation.board.units.find((candidate) => candidate.id === unit.id) ?? unit;
}

function portrait(role) {
  const node = document.createElement("span");
  node.className = "monster-master-roster-portrait monster-master-turn-portrait";
  node.dataset.role = role;
  node.setAttribute("aria-hidden", "true");
  node.style.setProperty("--monster-creature-atlas", `url("${creatureAtlasUrl}")`);
  return node;
}

function renderTurnOrder() {
  renderPending = false;
  if (!latestView || !roster || renderingTurnOrder) return;

  const ordered = turnOrder(latestView);
  const seat = friendlySeat(latestView);
  const yourPlayerId = latestView.observation.yourPlayerId ?? window.gameFrameIdentity?.playerId;
  const signature = ordered.map((unit) => {
    const state = unitState(latestView, unit);
    return `${unit.id}:${state.health}:${unit.initiative}`;
  }).join("|") + `:${latestView.observation.phase}:${latestView.observation.activeUnitId}:${seat}`;

  if (roster.dataset.turnOrderSignature === signature && roster.querySelector("[data-turn-unit-id]")) return;
  renderingTurnOrder = true;
  roster.dataset.turnOrderSignature = signature;
  roster.replaceChildren();

  ordered.forEach((unit, index) => {
    const state = unitState(latestView, unit);
    const role = roleFromUnit(unit);
    const friendly = unit.ownerId === yourPlayerId;
    const item = document.createElement("div");
    item.className = `combat-roster-unit monster-master-turn-unit ${friendly ? "is-friendly" : "is-enemy"}`;
    item.classList.toggle("is-active", unit.id === latestView.observation.activeUnitId);
    item.classList.toggle("is-next", latestView.observation.phase === "combat" && index === 1);
    item.dataset.turnUnitId = unit.id;
    item.dataset.role = role;
    item.dataset.owner = friendly ? "friendly" : "enemy";

    const slot = document.createElement("span");
    slot.className = "monster-master-turn-slot";
    slot.textContent = latestView.observation.phase !== "combat"
      ? String(index + 1)
      : index === 0
        ? "NOW"
        : index === 1
          ? "NEXT"
          : String(index + 1);

    const copy = document.createElement("span");
    copy.className = "monster-master-turn-copy";
    const name = document.createElement("strong");
    name.textContent = roleLabel(role);
    const meta = document.createElement("small");
    const health = Number.isFinite(state.health) ? `${state.health}/${state.maxHealth}` : "undeployed";
    meta.textContent = `${friendly ? "BLUE · YOU" : "RED · ENEMY"}  •  HP ${health}  •  INIT ${unit.initiative}`;
    copy.append(name, meta);

    item.append(slot, portrait(role), copy);
    roster.append(item);
  });

  renderingTurnOrder = false;
}

function scheduleTurnOrder() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(renderTurnOrder);
}

function simplifyPlayerNavigation() {
  for (const link of document.querySelectorAll('.combat-nav a[href="/combat.html"], .combat-nav a[href="/tactical.html"]')) {
    link.remove();
  }
  const gamesLink = document.querySelector('.combat-nav a[href="/"]');
  if (gamesLink) gamesLink.textContent = "Games";
  if (rosterTitle) rosterTitle.textContent = "Turn order";
  if (openRoster) openRoster.textContent = "Turns";
  if (rosterRail) rosterRail.setAttribute("aria-label", "Current and upcoming unit turns");
}

const monsterViewEvent = "gameframe:monster-master-pixi-view";
window.addEventListener(monsterViewEvent, (event) => capture(event.detail?.view));
queueMicrotask(() => {
  const current = window.gameFrameMonsterController?.getView?.();
  if (current) capture(current);
});

const rosterObserver = new MutationObserver(() => {
  if (!renderingTurnOrder) scheduleTurnOrder();
});
if (roster) rosterObserver.observe(roster, { childList: true, subtree: true, characterData: true });

simplifyPlayerNavigation();
window.gameFrameMonsterCorrection = Object.freeze({ capture, renderTurnOrder, simplifyPlayerNavigation });
