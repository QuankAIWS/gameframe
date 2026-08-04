const body = document.body;
const match = document.querySelector("#monster-master-match");
const lobby = document.querySelector("#monster-master-lobby");
const rosterRail = document.querySelector("#monster-master-roster-rail");
const intelRail = document.querySelector("#monster-master-intel-rail");
const openRoster = document.querySelector("#monster-master-open-roster");
const openIntel = document.querySelector("#monster-master-open-intel");
const closeRoster = document.querySelector("#monster-master-close-roster");
const closeIntel = document.querySelector("#monster-master-close-intel");
const drawerBackdrop = document.querySelector("#monster-master-drawer-backdrop");
const utilityMenu = document.querySelector("#monster-master-utility-menu");
const combatNav = document.querySelector(".combat-nav");

function ensureSetupButton() {
  let button = document.querySelector("#monster-master-new-match");
  if (button || !combatNav) return button;
  button = document.createElement("button");
  button.id = "monster-master-new-match";
  button.className = "monster-master-nav-setup";
  button.type = "button";
  button.textContent = "Setup";
  button.setAttribute("aria-label", "Return to Monster Master setup");
  combatNav.append(button);
  return button;
}

const setupButton = ensureSetupButton();

const hud = {
  root: document.querySelector("#monster-master-unit-hud"),
  glyph: document.querySelector("#monster-master-hud-glyph"),
  name: document.querySelector("#monster-master-hud-name"),
  health: document.querySelector("#monster-master-hud-health"),
  healthFill: document.querySelector("#monster-master-hud-health-fill"),
  initiative: document.querySelector("#monster-master-hud-initiative"),
  command: document.querySelector("#monster-master-hud-command"),
  move: document.querySelector("#monster-master-hud-move"),
  primary: document.querySelector("#monster-master-hud-primary"),
  phase: document.querySelector("#monster-master-hud-phase"),
};

const source = {
  activeUnit: document.querySelector("#monster-master-active-unit"),
  roster: document.querySelector("#monster-master-roster-list"),
  phase: document.querySelector("#monster-master-phase"),
  round: document.querySelector("#monster-master-round"),
  move: document.querySelector("#monster-master-move-budget"),
  primary: document.querySelector("#monster-master-primary-budget"),
  alphaCommand: document.querySelector("#monster-master-alpha-command"),
  betaCommand: document.querySelector("#monster-master-beta-command"),
  options: document.querySelector("#monster-master-options"),
  alphaCard: document.querySelector("#monster-master-player-alpha"),
  betaCard: document.querySelector("#monster-master-player-beta"),
};

const actionShortcuts = new Map([
  ["1", document.querySelector("#monster-master-select-deploy")],
  ["2", document.querySelector("#monster-master-select-move")],
  ["3", document.querySelector("#monster-master-select-attack")],
  ["4", document.querySelector("#monster-master-select-mend")],
  ["5", document.querySelector("#monster-master-end-activation")],
]);

const trainerCopyRoots = [lobby, match].filter(Boolean);
let syncPending = false;

function trainerCopy(value) {
  return value
    .replaceAll("Warden Master", "Verdant Sage")
    .replace(/\bWarden\b/g, "Sage");
}

function applyTrainerCopy() {
  for (const root of trainerCopyRoots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const next = trainerCopy(node.nodeValue ?? "");
      if (next !== node.nodeValue) node.nodeValue = next;
      node = walker.nextNode();
    }
    for (const element of root.querySelectorAll("[aria-label], [title]")) {
      for (const attribute of ["aria-label", "title"]) {
        const value = element.getAttribute(attribute);
        if (!value) continue;
        const next = trainerCopy(value);
        if (next !== value) element.setAttribute(attribute, next);
      }
    }
  }
  if (hud.root?.dataset.role === "master" && hud.glyph?.textContent === "W") {
    hud.glyph.textContent = "S";
  }
}

function setText(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function matchActive() {
  return Boolean(match) && !match.hidden;
}

function closeDrawers() {
  body.classList.remove("monster-master-roster-open", "monster-master-intel-open");
  openRoster?.setAttribute("aria-expanded", "false");
  openIntel?.setAttribute("aria-expanded", "false");
}

function openDrawer(which) {
  closeDrawers();
  const roster = which === "roster";
  body.classList.toggle("monster-master-roster-open", roster);
  body.classList.toggle("monster-master-intel-open", !roster);
  openRoster?.setAttribute("aria-expanded", String(roster));
  openIntel?.setAttribute("aria-expanded", String(!roster));
  (roster ? rosterRail : intelRail)?.focus({ preventScroll: true });
}

function updateShellState() {
  const active = matchActive();
  body.classList.toggle("monster-master-match-active", active);
  if (!active) {
    closeDrawers();
    utilityMenu?.removeAttribute("open");
  }
}

function roleFromName(name) {
  const normalized = name.toLowerCase();
  if (normalized.includes("bulwark")) return "bulwark";
  if (normalized.includes("emberling")) return "emberling";
  if (normalized.includes("sage") || normalized.includes("master")) return "master";
  return "unknown";
}

function rosterState(activeName) {
  if (!source.roster || !activeName || activeName === "—") return null;
  for (const item of source.roster.querySelectorAll(".combat-roster-unit")) {
    if (item.querySelector("strong")?.textContent?.trim() !== activeName) continue;
    return {
      health: item.querySelector(".combat-roster-health")?.textContent?.trim() ?? "—",
      defeated: item.classList.contains("is-defeated"),
    };
  }
  return null;
}

function syncHud() {
  syncPending = false;
  updateShellState();
  applyTrainerCopy();
  if (window.gameFrameMonsterRendererMode === "pixi") return;
  if (!hud.root) return;

  const phase = source.phase?.textContent?.trim() || "—";
  const deploymentChoice = phase === "Deployment"
    ? source.options?.querySelector('button[data-action-kind="deploy-unit"][data-preview="true"]')
    : null;
  const deploymentRole = deploymentChoice?.textContent?.split("·")[0]?.trim();
  const deploymentTeam = source.betaCard?.classList.contains("is-active") ? "Beta" : "Alpha";
  const name = deploymentRole
    ? `${deploymentTeam} ${deploymentRole}`
    : source.activeUnit?.textContent?.trim() || "—";
  const role = roleFromName(name);
  const roster = rosterState(name);
  const healthText = roster?.health ?? (name === "—" ? "—" : "Awaiting deployment");
  const healthMatch = healthText.match(/(\d+)\/(\d+)/);
  const initiativeMatch = healthText.match(/I(\d+)/i);
  const currentHealth = Number(healthMatch?.[1] ?? 0);
  const maxHealth = Number(healthMatch?.[2] ?? 0);
  const healthPercent = maxHealth > 0 ? Math.max(0, Math.min(100, currentHealth / maxHealth * 100)) : 0;
  const owner = name.startsWith("Beta ") ? "beta" : name.startsWith("Alpha ") ? "alpha" : null;
  const command = owner === "alpha"
    ? source.alphaCommand?.textContent?.trim()
    : owner === "beta"
      ? source.betaCommand?.textContent?.trim()
      : "—";
  const glyph = role === "master" ? "S" : role === "bulwark" ? "B" : role === "emberling" ? "E" : "—";
  const round = source.round?.textContent?.trim() || "—";

  hud.root.dataset.role = role;
  hud.root.dataset.owner = owner ?? "none";
  hud.root.dataset.defeated = String(Boolean(roster?.defeated));
  setText(hud.glyph, glyph);
  setText(hud.name, name);
  setText(hud.health, healthText.replace(/\s*·\s*I\d+/i, ""));
  setText(hud.initiative, initiativeMatch ? `Initiative ${initiativeMatch[1]}` : "Initiative —");
  setText(hud.command, command ?? "—");
  setText(hud.move, source.move?.textContent?.trim() || "—");
  setText(hud.primary, source.primary?.textContent?.trim() || "—");
  setText(hud.phase, phase === "Combat" && round !== "—" ? `Round ${round}` : phase);

  if (hud.healthFill) hud.healthFill.style.width = `${healthPercent}%`;
  const meter = hud.healthFill?.closest("[role='meter']");
  if (meter) {
    meter.setAttribute("aria-valuenow", String(currentHealth));
    meter.setAttribute("aria-valuemax", String(maxHealth || 1));
    meter.setAttribute("aria-valuetext", healthText);
  }
}

function scheduleSync() {
  updateShellState();
  applyTrainerCopy();
  if (window.gameFrameMonsterRendererMode === "pixi") return;
  if (syncPending) return;
  syncPending = true;
  requestAnimationFrame(syncHud);
}

openRoster?.addEventListener("click", () => openDrawer("roster"));
openIntel?.addEventListener("click", () => openDrawer("intel"));
closeRoster?.addEventListener("click", closeDrawers);
closeIntel?.addEventListener("click", closeDrawers);
drawerBackdrop?.addEventListener("click", closeDrawers);
setupButton?.addEventListener("click", () => queueMicrotask(updateShellState));

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeDrawers();
    utilityMenu?.removeAttribute("open");
    return;
  }
  if (!matchActive() || event.altKey || event.ctrlKey || event.metaKey) return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) return;
  const button = actionShortcuts.get(event.key);
  if (!button || button.disabled) return;
  event.preventDefault();
  button.click();
  button.focus({ preventScroll: true });
});

const watched = [
  match,
  lobby,
  source.activeUnit,
  source.roster,
  source.phase,
  source.round,
  source.move,
  source.primary,
  source.alphaCommand,
  source.betaCommand,
  source.options,
  source.alphaCard,
  source.betaCard,
  ...actionShortcuts.values(),
].filter(Boolean);

const observer = new MutationObserver(scheduleSync);
for (const node of watched) {
  observer.observe(node, {
    attributes: true,
    attributeFilter: ["hidden", "disabled", "aria-pressed", "class"],
    childList: true,
    subtree: true,
    characterData: true,
  });
}

window.addEventListener("resize", () => {
  if (window.innerWidth > 900) closeDrawers();
});

window.gameFrameMonsterShell = Object.freeze({
  sync: syncHud,
  closeDrawers,
  openDrawer,
  isMatchActive: matchActive,
  applyTrainerCopy,
});

syncHud();
