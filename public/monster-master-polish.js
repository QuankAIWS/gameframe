const polishStylesheetUrl = "/monster-master-polish.css";
if (!document.querySelector(`link[href="${polishStylesheetUrl}"]`)) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = polishStylesheetUrl;
  document.head.append(stylesheet);
}

const creatureAtlasUrl = "/assets/monster-master/creature-atlas-v1.svg";
const body = document.body;
const match = document.querySelector("#monster-master-match");
const status = document.querySelector("#monster-master-status");
const roster = document.querySelector("#monster-master-roster-list");
const hud = document.querySelector("#monster-master-unit-hud");
const healthMeter = document.querySelector(".monster-master-health-track");
const actionButtons = [...document.querySelectorAll(".monster-master-command-deck .combat-action-button")];

let syncPending = false;

function roleFromText(text) {
  const value = text.toLowerCase();
  if (value.includes("warden") || value.includes("master")) return "master";
  if (value.includes("bulwark")) return "bulwark";
  if (value.includes("emberling")) return "emberling";
  return "unknown";
}

function ownerFromText(text) {
  if (text.startsWith("Alpha ")) return "alpha";
  if (text.startsWith("Beta ")) return "beta";
  return "none";
}

function decorateRoster() {
  if (!roster) return;
  for (const item of roster.querySelectorAll(".combat-roster-unit")) {
    const label = item.querySelector("strong")?.textContent?.trim() ?? "";
    const role = roleFromText(label);
    const owner = ownerFromText(label);
    item.dataset.role = role;
    item.dataset.owner = owner;

    let portrait = item.querySelector(".monster-master-roster-portrait");
    if (!portrait) {
      portrait = document.createElement("span");
      portrait.className = "monster-master-roster-portrait";
      portrait.setAttribute("aria-hidden", "true");
      item.prepend(portrait);
    }
    portrait.dataset.role = role;
    portrait.style.setProperty("--monster-creature-atlas", `url("${creatureAtlasUrl}")`);
  }
}

function statusState() {
  const text = status?.textContent?.toLowerCase() ?? "";
  if (text.includes("won") || text.includes("victory")) return "victory";
  if (text.includes("draw")) return "draw";
  if (text.includes("deploy")) return "deployment";
  if (text.includes("loading") || text.includes("preparing")) return "loading";
  if (text.includes("opponent") || text.includes("gameframe-bot") || text.includes("resolving")) return "waiting";
  return match && !match.hidden ? "combat" : "lobby";
}

function selectedAction() {
  return actionButtons.find((button) => button.getAttribute("aria-pressed") === "true")?.id
    ?.replace("monster-master-select-", "") ?? "none";
}

function healthState() {
  const current = Number(healthMeter?.getAttribute("aria-valuenow") ?? 0);
  const maximum = Number(healthMeter?.getAttribute("aria-valuemax") ?? 0);
  if (!maximum) return "unknown";
  const ratio = current / maximum;
  if (ratio <= 0.25) return "critical";
  if (ratio <= 0.5) return "wounded";
  return "healthy";
}

function syncPresentation() {
  syncPending = false;
  decorateRoster();
  body.dataset.monsterMasterState = statusState();
  body.dataset.monsterMasterAction = selectedAction();
  if (hud) hud.dataset.healthState = healthState();

  for (const button of actionButtons) {
    const action = button.id.replace("monster-master-select-", "").replace("monster-master-", "");
    button.dataset.action = action;
  }
}

function scheduleSync() {
  if (syncPending) return;
  syncPending = true;
  requestAnimationFrame(syncPresentation);
}

const watched = [match, status, roster, hud, healthMeter, ...actionButtons].filter(Boolean);
const observer = new MutationObserver(scheduleSync);
for (const node of watched) {
  observer.observe(node, {
    attributes: true,
    attributeFilter: ["hidden", "class", "aria-pressed", "aria-valuenow", "aria-valuemax", "disabled"],
    childList: true,
    subtree: true,
    characterData: true,
  });
}

window.addEventListener("gameframe:monster-camera-rotated", scheduleSync);
window.addEventListener("gameframe:monster-animation", scheduleSync);
window.gameFrameMonsterPolish = Object.freeze({ sync: syncPresentation, decorateRoster });

syncPresentation();
