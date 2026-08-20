const TUTORIAL_KEY = "scribbles-gameframe.cascade-tutorial:v1";
const ANALYTICS_KEY = "scribbles-gameframe.cascade-analytics:v1";

const tutorials = Object.freeze({
  match: Object.freeze({
    kicker: "FIRST MOVE",
    title: "Match 3 to make them pop.",
    copy: "Swap adjacent tiles to make a line of three or more. A swap only sticks when it creates a match.",
    tip: "Drag a tile into its neighbor, or click one tile and then an adjacent tile.",
    accent: "#44c9ee",
    visual: "match",
  }),
  stripe: Object.freeze({
    kicker: "NEW SPECIAL",
    title: "Four in a row makes a stripe.",
    copy: "Match four tiles in a straight line to leave behind a striped tile. Use that striped tile in a match to blast its full row or column.",
    tip: "The stripe direction tells you which way the blast travels.",
    accent: "#ff5eaa",
    visual: "stripe",
  }),
  bomb: Object.freeze({
    kicker: "NEW SPECIAL",
    title: "Crossed matches make bombs.",
    copy: "Make intersecting row-and-column matches — a T or L shape — to create a bomb. Trigger it in a match to clear the 3×3 area around it.",
    tip: "Bombs are strongest when you build them near crowded objectives.",
    accent: "#ffd34e",
    visual: "bomb",
  }),
  combo: Object.freeze({
    kicker: "POWER COMBO",
    title: "Specials can hit each other.",
    copy: "Swap two specials together instead of matching them normally. Stripe + stripe, bomb + stripe, bomb + bomb, and color combos all create upgraded attacks.",
    tip: "If two specials are adjacent, check the combo before spending either one alone.",
    accent: "#ff914d",
    visual: "combo",
  }),
  color: Object.freeze({
    kicker: "NEW SPECIAL",
    title: "Five in a row clears a color.",
    copy: "Match five tiles in a straight line to create a color clearer. Swap it with a normal tile to wipe every tile of that color from the board.",
    tip: "Swap two color clearers together and the whole board goes.",
    accent: "#a56af4",
    visual: "color",
  }),
  ice: Object.freeze({
    kicker: "NEW OBJECTIVE",
    title: "Break the ice.",
    copy: "Matches on frozen cells chip the ice underneath them. Clear the required ice before your moves run out.",
    tip: "Special blasts can crack several frozen cells in one move.",
    accent: "#44c9ee",
    visual: "ice",
  }),
  collect: Object.freeze({
    kicker: "NEW OBJECTIVE",
    title: "Collect the requested colors.",
    copy: "Clear the requested tile colors until their counters are satisfied. Matches, specials, and cascades all count toward the collection goal.",
    tip: "A big color clear can finish a collection target very quickly.",
    accent: "#69d877",
    visual: "collect",
  }),
  "layered-ice": Object.freeze({
    kicker: "TOUGHER BLOCKER",
    title: "Some ice takes two hits.",
    copy: "Layered ice has to be cracked twice before the cell is clear. Each match or special hit removes one layer.",
    tip: "Line up specials across thick ice so one move can hit several layers at once.",
    accent: "#44c9ee",
    visual: "layered-ice",
  }),
  hammer: Object.freeze({
    kicker: "BOOSTER",
    title: "The Hammer breaks one tile free.",
    copy: "Choose the Hammer, then choose one tile to smash it without spending a move. You earn another Hammer every 10 new best stars.",
    tip: "Save it for a blocked objective, a stubborn final tile, or a move that opens the board.",
    accent: "#ffd34e",
    visual: "hammer",
  }),
  weekly: Object.freeze({
    kicker: "BONUS MODE",
    title: "Weekly Blitz is 30 seconds flat.",
    copy: "Everyone gets the same seeded board for the week. Score as much as you can in 30 seconds and your best result goes to the weekly standings.",
    tip: "The timer starts only after you close this tip.",
    accent: "#44c9ee",
    visual: "weekly",
  }),
});

const queue = [];
const pendingIds = new Set();
let current = null;
let flushTimer = 0;
let scanTimer = 0;

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TUTORIAL_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return { enabled: true, seen: {} };
    return {
      enabled: parsed.enabled !== false,
      seen: parsed.seen && typeof parsed.seen === "object" ? { ...parsed.seen } : {},
    };
  } catch {
    return { enabled: true, seen: {} };
  }
}

let state = loadState();

function saveState() {
  localStorage.setItem(TUTORIAL_KEY, JSON.stringify({ enabled: state.enabled, seen: state.seen }));
}

function track(type, detail = {}) {
  try {
    const events = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || "[]");
    events.push({ at: new Date().toISOString(), type, mode: "tutorial", ...detail });
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(events.slice(-500)));
  } catch {
    // Tutorial telemetry must never interfere with play.
  }
}

function hasSeen(id) {
  return Boolean(state.seen[id]);
}

function updateToggle() {
  const button = document.querySelector("#cascade-tutorial-toggle");
  if (!button) return;
  button.textContent = state.enabled ? "💡 Tutorial tips on" : "💡 Tutorial tips off";
  button.setAttribute("aria-pressed", String(state.enabled));
  button.title = state.enabled ? "Turn off future first-time tutorial tips." : "Turn tutorial tips back on.";
}

function setEnabled(enabled, source = "settings") {
  state.enabled = Boolean(enabled);
  saveState();
  if (!state.enabled) {
    queue.length = 0;
    pendingIds.clear();
  }
  updateToggle();
  track(state.enabled ? "tutorial_tips_enabled" : "tutorial_tips_disabled", { source });
}

function installToggle() {
  if (document.querySelector("#cascade-tutorial-toggle")) return;
  const controls = document.querySelector("#cascade-feedback-card .cascade-feedback-controls");
  if (!controls) {
    window.setTimeout(installToggle, 50);
    return;
  }
  const button = document.createElement("button");
  button.type = "button";
  button.id = "cascade-tutorial-toggle";
  button.addEventListener("click", () => setEnabled(!state.enabled));
  controls.append(button);
  updateToggle();
}

function tileMarkup(kind, { special = "", ice = 0, extraClass = "" } = {}) {
  const tileKind = Math.max(0, Math.min(5, Math.floor(Number(kind) || 0)));
  const layers = Math.max(0, Math.min(2, Math.floor(Number(ice) || 0)));
  const classes = ["cascade-tile", "cascade-tutorial-game-tile"];
  if (special) classes.push("has-special");
  if (layers) classes.push("has-ice", layers > 1 ? "ice-2" : "ice-1");
  if (extraClass) classes.push(extraClass);
  return `<i class="${classes.join(" ")}" data-kind="${tileKind}"${special ? ` data-special="${special}"` : ""}${layers ? ` data-ice="${layers}"` : ""} aria-hidden="true">${special ? '<span class="cascade-special-mark" aria-hidden="true"></span>' : ""}</i>`;
}

function rowMarkup(kind, count, options = {}) {
  return Array.from({ length: count }, () => tileMarkup(kind, options)).join("");
}

function levelData() {
  try {
    return window.cascadeResearch?.exportLevel?.()?.level || null;
  } catch {
    return null;
  }
}

function collectMarkup() {
  const goals = Array.isArray(levelData()?.objective?.collect) ? levelData().objective.collect : [];
  const previewGoals = (goals.length ? goals : [{ kind: 3, count: 12 }, { kind: 0, count: 8 }]).slice(0, 2);
  return `<div class="cascade-tutorial-collect-grid">${previewGoals.map((goal) => `
    <div class="cascade-tutorial-collect-item">
      ${tileMarkup(goal.kind)}
      <strong>${Math.max(1, Math.floor(Number(goal.count) || 1))}</strong>
    </div>`).join("")}</div>`;
}

function visualMarkup(kind) {
  if (kind === "match") {
    return `<div class="cascade-tutorial-board-sample is-match-sample">${rowMarkup(1, 3)}</div><b class="cascade-tutorial-preview-caption">MATCH 3</b>`;
  }
  if (kind === "stripe") {
    return `<div class="cascade-tutorial-equation"><div class="cascade-tutorial-board-sample is-four-row">${rowMarkup(0, 4)}</div><span class="cascade-tutorial-arrow">→</span>${tileMarkup(0, { special: "stripe-h", extraClass: "is-tutorial-result" })}</div>`;
  }
  if (kind === "bomb") {
    return `<div class="cascade-tutorial-equation"><div class="cascade-tutorial-bomb-source">${["top", "left", "center", "right", "bottom"].map((position) => tileMarkup(2, { extraClass: `is-${position}` })).join("")}</div><span class="cascade-tutorial-arrow">→</span>${tileMarkup(2, { special: "bomb", extraClass: "is-tutorial-result" })}</div>`;
  }
  if (kind === "combo") {
    return `<div class="cascade-tutorial-combo-scene"><div class="cascade-tutorial-combo-pair">${tileMarkup(0, { special: "stripe-v" })}${tileMarkup(2, { special: "bomb" })}</div><b class="cascade-tutorial-preview-caption">SWAP SPECIALS TOGETHER</b></div>`;
  }
  if (kind === "color") {
    return `<div class="cascade-tutorial-equation"><div class="cascade-tutorial-board-sample is-five-row">${rowMarkup(4, 5)}</div><span class="cascade-tutorial-arrow">→</span>${tileMarkup(4, { special: "color", extraClass: "is-tutorial-result" })}</div>`;
  }
  if (kind === "ice") {
    return `<div class="cascade-tutorial-objective-scene">${tileMarkup(4, { ice: 1 })}<b class="cascade-tutorial-preview-caption">1 HIT TO BREAK</b></div>`;
  }
  if (kind === "collect") return collectMarkup();
  if (kind === "layered-ice") {
    return `<div class="cascade-tutorial-objective-scene">${tileMarkup(1, { ice: 2 })}<b class="cascade-tutorial-preview-caption">2 HITS TO BREAK</b></div>`;
  }
  if (kind === "hammer") {
    return `<div class="cascade-tutorial-hammer-scene"><div class="cascade-card cascade-tutorial-hammer-card"><small>BOOSTER</small><button type="button" tabindex="-1">Hammer <b>2</b></button></div><span class="cascade-tutorial-arrow">→</span>${tileMarkup(1, { extraClass: "is-selected" })}</div>`;
  }
  if (kind === "weekly") {
    return `<div class="cascade-card cascade-weekly-card cascade-tutorial-weekly-card"><small>WEEKLY BLITZ</small><strong>—</strong><span>Same board seed for everyone.</span><button type="button" tabindex="-1">Play weekly <b>30s</b></button></div>`;
  }
  return tileMarkup(0);
}

function ensureDialog() {
  let dialog = document.querySelector("#cascade-tutorial-dialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "cascade-tutorial-dialog";
  dialog.className = "cascade-dialog cascade-tutorial-dialog";
  dialog.setAttribute("aria-labelledby", "cascade-tutorial-title");
  dialog.innerHTML = `
    <section class="cascade-tutorial-card">
      <div class="cascade-tutorial-preview" aria-hidden="true">
        <div class="cascade-tutorial-visual"></div>
      </div>
      <div class="cascade-tutorial-copy">
        <small data-tutorial-kicker>NEW</small>
        <h2 id="cascade-tutorial-title" data-tutorial-title>Tutorial tip</h2>
        <p data-tutorial-copy></p>
        <div class="cascade-tutorial-note" data-tutorial-note></div>
      </div>
      <div class="cascade-tutorial-actions">
        <label class="cascade-tutorial-disable">
          <input type="checkbox" data-tutorial-disable>
          <span>Turn off tutorial tips</span>
        </label>
        <button type="button" class="cascade-tutorial-continue" data-tutorial-continue>Got it</button>
      </div>
    </section>
  `;
  dialog.addEventListener("cancel", (event) => event.preventDefault());
  dialog.querySelector("[data-tutorial-continue]").addEventListener("click", finishCurrentTip);
  document.body.append(dialog);
  return dialog;
}

function anotherDialogIsOpen() {
  return [...document.querySelectorAll("dialog[open]")]
    .some((dialog) => dialog.id !== "cascade-tutorial-dialog");
}

function scheduleFlush(delay = 0) {
  window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(flushQueue, delay);
}

function flushQueue() {
  flushTimer = 0;
  if (current || !state.enabled || !queue.length) return;
  if (anotherDialogIsOpen()) {
    scheduleFlush(250);
    return;
  }
  const item = queue.shift();
  pendingIds.delete(item.id);
  if (hasSeen(item.id)) {
    scheduleFlush();
    return;
  }
  showTip(item);
}

function requestTip(id, { after = null, immediate = false } = {}) {
  if (!tutorials[id] || !state.enabled || hasSeen(id) || pendingIds.has(id)) return false;
  pendingIds.add(id);
  queue.push({ id, after });
  scheduleFlush(immediate ? 0 : 120);
  return true;
}

function showTip(item) {
  const definition = tutorials[item.id];
  if (!definition || !state.enabled) return;
  const dialog = ensureDialog();
  current = item;
  state.seen[item.id] = true;
  saveState();
  dialog.style.setProperty("--tutorial-accent", definition.accent);
  dialog.dataset.tutorial = item.id;
  dialog.querySelector("[data-tutorial-kicker]").textContent = definition.kicker;
  dialog.querySelector("[data-tutorial-title]").textContent = definition.title;
  dialog.querySelector("[data-tutorial-copy]").textContent = definition.copy;
  dialog.querySelector("[data-tutorial-note]").textContent = definition.tip;
  const visual = dialog.querySelector(".cascade-tutorial-visual");
  visual.className = `cascade-tutorial-visual is-${definition.visual}`;
  visual.innerHTML = visualMarkup(definition.visual);
  dialog.querySelector("[data-tutorial-disable]").checked = false;
  if (!dialog.open) dialog.showModal();
  track("tutorial_tip_shown", { tip: item.id });
}

function finishCurrentTip() {
  const dialog = ensureDialog();
  const item = current;
  if (!item) return;
  const disable = dialog.querySelector("[data-tutorial-disable]").checked;
  current = null;
  if (dialog.open) dialog.close();
  track("tutorial_tip_dismissed", { tip: item.id, disabledFutureTips: disable });
  if (disable) setEnabled(false, "tip-checkbox");
  const after = item.after;
  if (typeof after === "function") window.setTimeout(after, 0);
  if (state.enabled) scheduleFlush(80);
}

function scanMechanics() {
  const board = document.querySelector("#board");
  const levelNumber = Math.max(0, Number(document.querySelector("#level-number")?.textContent) || 0);
  const level = levelData();

  if (levelNumber === 1) requestTip("match");

  // Specials and objectives are taught when the player actually encounters them.
  // This keeps every special available from level one without front-loading rules
  // the player has not yet discovered through play.
  if (board?.querySelector('[data-special="stripe-h"], [data-special="stripe-v"]')) requestTip("stripe");
  if (board?.querySelector('[data-special="bomb"]')) requestTip("bomb");
  if (board?.querySelector('[data-special="color"]')) requestTip("color");
  if (board?.querySelector('[data-ice="1"]')) requestTip("ice");
  if (board?.querySelector('[data-ice="2"]')) requestTip("layered-ice");

  if (Array.isArray(level?.objective?.collect) && level.objective.collect.length) requestTip("collect");
  if (Number(level?.objective?.ice?.layers) >= 2) requestTip("layered-ice");
  else if (level?.objective?.ice) requestTip("ice");

  const combo = document.querySelector("#combo-label");
  const comboText = combo?.textContent?.trim() || "";
  if (combo?.classList.contains("is-wild") && comboText && comboText !== "SPECIAL MADE") requestTip("combo");
}

function scheduleMechanicScan() {
  window.clearTimeout(scanTimer);
  scanTimer = window.setTimeout(() => {
    scanTimer = 0;
    scanMechanics();
  }, 360);
}

function interceptFirstAction(event) {
  if (!state.enabled || current) return;
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  const hammer = target.closest("#booster-hammer");
  if (hammer && !hasSeen("hammer")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    requestTip("hammer", { immediate: true, after: () => hammer.click() });
    return;
  }

  const weekly = target.closest("[data-weekly-start]");
  if (weekly && !hasSeen("weekly")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    requestTip("weekly", { immediate: true, after: () => weekly.click() });
  }
}

installToggle();
document.addEventListener("click", interceptFirstAction, true);

const board = document.querySelector("#board");
if (board) {
  new MutationObserver(scheduleMechanicScan).observe(board, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["data-special", "data-ice", "class"],
  });
}

const levelNumber = document.querySelector("#level-number");
if (levelNumber) {
  new MutationObserver(scheduleMechanicScan).observe(levelNumber, {
    subtree: true,
    childList: true,
    characterData: true,
  });
}

const comboLabel = document.querySelector("#combo-label");
if (comboLabel) {
  new MutationObserver(scheduleMechanicScan).observe(comboLabel, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class"],
  });
}

scheduleMechanicScan();

window.cascadeTutorial = Object.freeze({
  isEnabled: () => state.enabled,
  hasSeen,
  setEnabled,
  show(id) {
    if (!tutorials[id]) return false;
    delete state.seen[id];
    saveState();
    return requestTip(id, { immediate: true });
  },
  reset() {
    state = { enabled: true, seen: {} };
    saveState();
    updateToggle();
    scheduleMechanicScan();
  },
});
