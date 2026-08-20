const overlayStylesheetUrl = "/monster-master-overlay.css";
if (!document.querySelector(`link[href="${overlayStylesheetUrl}"]`)) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = overlayStylesheetUrl;
  document.head.append(stylesheet);
}

const ui = {
  match: document.querySelector("#monster-master-match"),
  roster: document.querySelector("#monster-master-roster-list"),
  intel: document.querySelector("#monster-master-intel-rail"),
  hud: document.querySelector("#monster-master-unit-hud"),
  hudLabel: document.querySelector("#monster-master-unit-hud .section-label"),
  hudName: document.querySelector("#monster-master-hud-name"),
  hudGlyph: document.querySelector("#monster-master-hud-glyph"),
  hudHealth: document.querySelector("#monster-master-hud-health"),
  hudHealthFill: document.querySelector("#monster-master-hud-health-fill"),
  hudInitiative: document.querySelector("#monster-master-hud-initiative"),
  hudPhase: document.querySelector("#monster-master-hud-phase"),
  hudMove: document.querySelector("#monster-master-hud-move"),
  hudPrimary: document.querySelector("#monster-master-hud-primary"),
  hudCommand: document.querySelector("#monster-master-hud-command"),
  actionDeck: document.querySelector(".monster-master-command-deck"),
  deploy: document.querySelector("#monster-master-select-deploy"),
  move: document.querySelector("#monster-master-select-move"),
  attack: document.querySelector("#monster-master-select-attack"),
  mend: document.querySelector("#monster-master-select-mend"),
  end: document.querySelector("#monster-master-end-activation"),
  status: document.querySelector("#monster-master-status"),
  cameraControls: document.querySelector(".tactical-controls"),
  rotationControls: document.querySelector(".monster-master-rotation-controls"),
};

const rolePresentation = {
  master: {
    label: "Warden Master",
    glyph: "W",
    moveLabel: "Advance",
    primaryLabel: "Arc Lance",
    primaryCaption: (unit) => `${unit.attackDamage} damage · range ${unit.attackRange}`,
    summary: "Command unit · ranged control and battlefield repair.",
    traits: [
      { id: "arc-lance", label: "Arc Lance", kind: "primary", copy: "Reliable ranged primary attack." },
      { id: "mend", label: "Mend", kind: "ability", copy: "Spend 1 command to restore up to 3 health." },
    ],
  },
  bulwark: {
    label: "Stone Bulwark",
    glyph: "B",
    moveLabel: "March",
    primaryLabel: "Stonebreaker",
    primaryCaption: (unit) => `${unit.attackDamage} damage · range ${unit.attackRange}`,
    summary: "Heavy front-line monster · high health and close pressure.",
    traits: [
      { id: "stonebreaker", label: "Stonebreaker", kind: "primary", copy: "Heavy adjacent strike." },
      { id: "heavy-frame", label: "Heavy Frame", kind: "trait", copy: "Durable 12-health body built to hold space." },
    ],
  },
  emberling: {
    label: "Emberling",
    glyph: "E",
    moveLabel: "Skitter",
    primaryLabel: "Cinder Volley",
    primaryCaption: (unit) => `${unit.attackDamage} damage · range ${unit.attackRange}`,
    summary: "Fast skirmisher · acts early and attacks from range.",
    traits: [
      { id: "cinder-volley", label: "Cinder Volley", kind: "primary", copy: "Mobile ranged primary attack." },
      { id: "quickstep", label: "Quickstep", kind: "trait", copy: "Movement 6 and initiative 9." },
    ],
  },
};

let latestView = null;
let inspectedUnitId = null;
let lastActiveUnitId = null;
let renderPending = false;
let cameraPending = false;

function isMonsterView(candidate) {
  return candidate?.gameId === "monster-master-duel"
    && candidate?.observation?.board?.map
    && Array.isArray(candidate?.observation?.legalActions);
}

function extractMonsterView(candidate) {
  if (isMonsterView(candidate)) return candidate;
  if (isMonsterView(candidate?.view)) return candidate.view;
  return null;
}

function playerIds(view = latestView) {
  return view?.playerIds ?? view?.observation?.playerIds ?? [];
}

function allUnits(view = latestView) {
  if (!view) return [];
  const deployed = view.observation.board.units ?? [];
  const roster = Object.values(view.observation.rosters ?? {}).flat();
  const byId = new Map(roster.map((unit) => [unit.id, unit]));
  for (const unit of deployed) byId.set(unit.id, unit);
  return [...byId.values()];
}

function unitById(unitId, view = latestView) {
  return allUnits(view).find((unit) => unit.id === unitId) ?? null;
}

function activeUnit(view = latestView) {
  return unitById(view?.observation?.activeUnitId, view);
}

function deploymentSelectedUnitId(view = latestView) {
  if (view?.observation?.phase !== "deployment") return null;
  try {
    const diagnostics = JSON.parse(document.querySelector("#monster-master-details")?.textContent || "{}");
    if (diagnostics.selectedUnitId) return diagnostics.selectedUnitId;
  } catch { /* Diagnostics are optional presentation data. */ }
  return view.observation.legalActions.find((action) => action.type === "deploy-unit")?.unitId ?? null;
}

function friendlyPlayerId(view = latestView) {
  return view?.observation?.yourPlayerId ?? window.gameFrameIdentity?.playerId ?? null;
}

function roleFor(unit) {
  return rolePresentation[unit?.role] ?? rolePresentation.master;
}

function identityFor(unit) {
  const mechanics = roleFor(unit);
  const catalog = window.gameFrameMonsterIllustratedAssets?.presentationFor?.(unit);
  if (!catalog) return mechanics;
  return {
    ...mechanics,
    label: catalog.label ?? mechanics.label,
    glyph: catalog.glyph ?? mechanics.glyph,
    summary: catalog.summary ?? mechanics.summary,
  };
}

function traitCopyFor(trait, unit) {
  if (trait.id === "heavy-frame" && unit?.role === "bulwark") {
    return `Durable ${unit.maxHealth}-health body built to hold space.`;
  }
  if (trait.id === "quickstep" && unit?.role === "emberling") {
    return `Movement ${unit.movement} and initiative ${unit.initiative}.`;
  }
  return trait.copy;
}

function abilityAvailable(unit, abilityId) {
  return Boolean(unit?.abilityIds?.includes(abilityId));
}

function setText(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function setButtonCopy(button, label, caption) {
  if (!button) return;
  setText(button.querySelector(".monster-master-action-label"), label);
  setText(button.querySelector(".monster-master-action-caption"), caption);
  button.setAttribute("aria-label", label);
}

function setControlVisibility(button, visible) {
  if (!button) return;
  button.hidden = !visible;
  button.setAttribute("aria-hidden", String(!visible));
  if (!visible) button.setAttribute("tabindex", "-1");
  else button.removeAttribute("tabindex");
}

function activeLegalActions(type, view = latestView) {
  return view?.observation?.legalActions?.filter((action) => action.type === type) ?? [];
}

function renderActionDeck() {
  if (!latestView || !ui.actionDeck) return;
  const observation = latestView.observation;
  const unit = activeUnit();
  const presentation = roleFor(unit);
  const deployment = observation.phase === "deployment";
  const combat = observation.phase === "combat";
  const ownedTurn = observation.activePlayerId === friendlyPlayerId();

  ui.actionDeck.dataset.phase = observation.phase;
  ui.actionDeck.dataset.activeRole = unit?.role ?? "none";
  ui.actionDeck.dataset.ownedTurn = String(ownedTurn);

  setControlVisibility(ui.deploy, deployment);
  setControlVisibility(ui.move, combat && Boolean(unit));
  setControlVisibility(ui.attack, combat && Boolean(unit));
  setControlVisibility(ui.mend, combat && abilityAvailable(unit, "mend"));
  setControlVisibility(ui.end, combat && Boolean(unit));

  setButtonCopy(ui.deploy, "Deploy", "Place selected roster unit");
  setButtonCopy(ui.move, presentation.moveLabel, unit ? `Move up to ${unit.movement}` : "Reposition");
  setButtonCopy(ui.attack, presentation.primaryLabel, unit ? presentation.primaryCaption(unit) : "Primary attack");
  setButtonCopy(ui.mend, "Mend", "1 command · heal up to 3");
  setButtonCopy(ui.end, "End", "Pass initiative");

  const attackActions = activeLegalActions("attack");
  const mendActions = activeLegalActions("use-ability").filter((action) => action.abilityId === "mend");
  if (ui.attack) ui.attack.dataset.legalTargets = String(attackActions.length);
  if (ui.mend) ui.mend.dataset.legalTargets = String(mendActions.length);
}

function ensureInspectionControls() {
  if (!ui.hud) return null;
  let controls = ui.hud.querySelector(".monster-master-inspection-controls");
  if (controls) return controls;
  controls = document.createElement("div");
  controls.className = "monster-master-inspection-controls";
  controls.innerHTML = `
    <p id="monster-master-unit-summary"></p>
    <button id="monster-master-return-active" type="button">Return to active unit</button>
  `;
  ui.hud.append(controls);
  controls.querySelector("#monster-master-return-active")?.addEventListener("click", () => {
    inspectedUnitId = latestView?.observation?.activeUnitId ?? null;
    scheduleRender();
  });
  return controls;
}

function ensureAbilityList() {
  if (!ui.intel) return null;
  let section = ui.intel.querySelector("#monster-master-ability-kit");
  if (section) return section;
  section = document.createElement("section");
  section.id = "monster-master-ability-kit";
  section.className = "monster-master-ability-kit";
  section.innerHTML = `
    <div class="monster-master-overlay-heading">
      <small>ABILITY KIT</small>
      <strong id="monster-master-ability-owner">—</strong>
    </div>
    <div id="monster-master-ability-list"></div>
  `;
  const resources = ui.intel.querySelector(".monster-master-resource-grid");
  resources?.insertAdjacentElement("afterend", section);
  return section;
}

function abilityActionButton(trait, inspectedIsActive, unit) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `monster-master-ability-chip is-${trait.kind}`;
  button.dataset.abilityId = trait.id;
  const label = document.createElement("strong");
  label.textContent = trait.label;
  const copy = document.createElement("span");
  copy.textContent = traitCopyFor(trait, unit);
  button.append(label, copy);

  const target = trait.id === "mend"
    ? ui.mend
    : trait.kind === "primary"
      ? ui.attack
      : null;
  if (!target || !inspectedIsActive) {
    button.disabled = true;
    button.dataset.informational = "true";
  } else {
    button.disabled = target.disabled;
    button.addEventListener("click", () => target.click());
  }
  return button;
}

function renderUnitCard() {
  if (!latestView || !ui.hud) return;
  const activeId = latestView.observation.activeUnitId;
  const deploymentId = deploymentSelectedUnitId();
  const referenceId = activeId ?? deploymentId;
  const unit = unitById(inspectedUnitId ?? referenceId) ?? activeUnit();
  const mechanics = roleFor(unit);
  const identity = identityFor(unit);
  const friendly = unit?.ownerId === friendlyPlayerId();
  const inspectedIsActive = Boolean(unit && unit.id === referenceId);
  const command = unit ? latestView.observation.commandByPlayer?.[unit.ownerId] ?? 0 : 0;
  const phase = latestView.observation.phase === "combat"
    ? `Round ${latestView.observation.round}`
    : "Deployment";
  const health = unit ? `${unit.health}/${unit.maxHealth}` : "—";
  const healthPercent = unit?.maxHealth ? Math.max(0, Math.min(100, unit.health / unit.maxHealth * 100)) : 0;

  ui.hud.dataset.role = unit?.role ?? "unknown";
  ui.hud.dataset.owner = unit ? (friendly ? "friendly" : "enemy") : "none";
  if (unit?.contentId) ui.hud.dataset.contentId = unit.contentId;
  else delete ui.hud.dataset.contentId;
  ui.hud.dataset.inspected = String(!inspectedIsActive);
  setText(ui.hudLabel, activeId ? "ACTIVE UNIT" : "DEPLOYING UNIT");
  setText(ui.hudGlyph, identity.glyph);
  setText(ui.hudName, unit ? identity.label : "No active unit");
  setText(ui.hudHealth, health);
  setText(ui.hudInitiative, unit ? `Initiative ${unit.initiative}` : "Initiative —");
  setText(ui.hudPhase, phase);
  setText(ui.hudMove, unit ? `${unit.movement}` : "—");
  setText(ui.hudPrimary, unit ? `${unit.attackDamage} / R${unit.attackRange}` : "—");
  setText(ui.hudCommand, unit ? String(command) : "—");
  if (ui.hudHealthFill) ui.hudHealthFill.style.width = `${healthPercent}%`;

  const meter = ui.hudHealthFill?.closest("[role='meter']");
  if (meter) {
    meter.setAttribute("aria-valuenow", String(unit?.health ?? 0));
    meter.setAttribute("aria-valuemax", String(unit?.maxHealth ?? 1));
    meter.setAttribute("aria-valuetext", health);
  }

  const inspection = ensureInspectionControls();
  setText(inspection?.querySelector("#monster-master-unit-summary"), identity.summary);
  const returnButton = inspection?.querySelector("#monster-master-return-active");
  if (returnButton) {
    returnButton.hidden = inspectedIsActive || !referenceId;
    returnButton.textContent = activeId ? "Return to active unit" : "Return to selected unit";
  }

  const kit = ensureAbilityList();
  setText(kit?.querySelector("#monster-master-ability-owner"), unit ? identity.label : "—");
  const list = kit?.querySelector("#monster-master-ability-list");
  if (list) {
    list.replaceChildren();
    const visibleTraits = mechanics.traits.filter((trait) => trait.id !== "mend" || abilityAvailable(unit, "mend"));
    for (const trait of visibleTraits) list.append(abilityActionButton(trait, inspectedIsActive, unit));
  }

  document.querySelectorAll("[data-turn-unit-id]").forEach((item) => {
    item.classList.toggle("is-inspected", item.dataset.turnUnitId === unit?.id);
    item.setAttribute("aria-pressed", String(item.dataset.turnUnitId === unit?.id));
  });
}

function decorateRoster() {
  ui.roster?.querySelectorAll("[data-turn-unit-id]").forEach((item) => {
    if (item.dataset.overlayReady === "true") return;
    item.dataset.overlayReady = "true";
    item.setAttribute("role", "button");
    item.setAttribute("tabindex", "0");
  });
}

function inspectRosterTarget(target) {
  const item = target instanceof Element ? target.closest("[data-turn-unit-id]") : null;
  if (!item?.dataset.turnUnitId) return;
  inspectedUnitId = item.dataset.turnUnitId;
  scheduleRender();
}

function cameraButton(selector, area, title) {
  const button = document.querySelector(selector);
  if (!button) return null;
  button.dataset.cameraArea = area;
  button.title = title;
  return button;
}

function setupCameraDock() {
  cameraPending = false;
  const controls = document.querySelector(".tactical-controls");
  const rotation = document.querySelector(".monster-master-rotation-controls");
  const grid = document.querySelector(".monster-master-game-grid");
  if (!controls || !grid) return;

  let dock = grid.querySelector("#monster-master-camera-dock");
  if (!dock) {
    dock = document.createElement("aside");
    dock.id = "monster-master-camera-dock";
    dock.className = "monster-master-camera-dock";
    dock.setAttribute("aria-label", "Battlefield camera");
    dock.innerHTML = `
      <div class="monster-master-camera-title"><small>CAMERA</small><strong>Battlefield view</strong></div>
      <div class="monster-master-camera-dpad" aria-label="Pan and focus controls"></div>
      <div class="monster-master-camera-zoom" aria-label="Zoom controls"></div>
    `;
    grid.append(dock);
  }

  const dpad = dock.querySelector(".monster-master-camera-dpad");
  const zoom = dock.querySelector(".monster-master-camera-zoom");
  const north = cameraButton('[data-monster-master-pan-x="0"][data-monster-master-pan-y="-3"]', "north", "Pan north");
  const west = cameraButton('[data-monster-master-pan-x="-3"][data-monster-master-pan-y="0"]', "west", "Pan west");
  const active = cameraButton("#monster-master-center-active", "active", "Center active unit");
  const east = cameraButton('[data-monster-master-pan-x="3"][data-monster-master-pan-y="0"]', "east", "Pan east");
  const south = cameraButton('[data-monster-master-pan-x="0"][data-monster-master-pan-y="3"]', "south", "Pan south");
  for (const button of [north, west, active, east, south].filter(Boolean)) dpad?.append(button);

  const zoomOut = cameraButton("#monster-master-zoom-out", "zoom-out", "Zoom out");
  const center = cameraButton("#monster-master-center-field", "center", "Center battlefield");
  const zoomIn = cameraButton("#monster-master-zoom-in", "zoom-in", "Zoom in");
  for (const button of [zoomOut, center, zoomIn].filter(Boolean)) zoom?.append(button);

  controls.classList.add("monster-master-camera-controls-mounted");
  controls.replaceChildren(...[dpad, zoom].filter(Boolean));
  dock.append(controls);
  if (rotation) dock.append(rotation);
}

function scheduleCameraSetup() {
  if (cameraPending) return;
  cameraPending = true;
  requestAnimationFrame(setupCameraDock);
}

function renderOverlay() {
  renderPending = false;
  if (!latestView) return;
  decorateRoster();
  renderActionDeck();
  renderUnitCard();
  setupCameraDock();
  document.body.classList.add("monster-master-overlay-ready");
}

function scheduleRender() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => requestAnimationFrame(renderOverlay));
}

function capture(candidate) {
  const view = extractMonsterView(candidate);
  if (!view) return;
  latestView = view;
  const activeId = view.observation.activeUnitId ?? null;
  if (activeId !== lastActiveUnitId) {
    inspectedUnitId = activeId;
    lastActiveUnitId = activeId;
  }
  scheduleRender();
}

ui.roster?.addEventListener("click", (event) => inspectRosterTarget(event.target));
ui.roster?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const item = event.target instanceof Element ? event.target.closest("[data-turn-unit-id]") : null;
  if (!item) return;
  event.preventDefault();
  inspectRosterTarget(item);
});

const monsterViewEvent = "gameframe:monster-master-pixi-view";
window.addEventListener(monsterViewEvent, (event) => capture(event.detail?.view));
queueMicrotask(() => {
  const current = window.gameFrameMonsterController?.getView?.();
  if (current) capture(current);
});

const rosterObserver = new MutationObserver(scheduleRender);
if (ui.roster) rosterObserver.observe(ui.roster, { childList: true, subtree: true });

const sourceObserver = new MutationObserver(scheduleRender);
for (const node of [
  document.querySelector("#monster-master-active-unit"),
  document.querySelector("#monster-master-phase"),
  document.querySelector("#monster-master-options"),
  document.querySelector("#monster-master-move-budget"),
  document.querySelector("#monster-master-primary-budget"),
  document.querySelector("#monster-master-alpha-command"),
  document.querySelector("#monster-master-beta-command"),
  ui.deploy,
  ui.move,
  ui.attack,
  ui.mend,
  ui.end,
].filter(Boolean)) {
  sourceObserver.observe(node, {
    attributes: true,
    attributeFilter: ["disabled", "hidden", "aria-pressed"],
    childList: true,
    subtree: true,
    characterData: true,
  });
}

window.gameFrameMonsterOverlay = Object.freeze({
  capture,
  render: renderOverlay,
  inspect(unitId) {
    inspectedUnitId = unitId;
    scheduleRender();
  },
  getView: () => latestView,
});

scheduleCameraSetup();
