const SOUND_KEY = "scribbles-gameframe.cascade-sound:v1";
const EFFECTS_KEY = "scribbles-gameframe.cascade-effects:v1";
const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
const palette = ["#ff5eaa", "#44c9ee", "#ffd34e", "#69d877", "#a56af4", "#ff914d"];

let soundEnabled = localStorage.getItem(SOUND_KEY) !== "off";
let effectsMode = localStorage.getItem(EFFECTS_KEY) === "reduced" ? "reduced" : "full";
let audioContext = null;
let resultWasOpen = false;
let boardEffectsQueued = false;
let boardScanQueued = false;
let lastComboText = "";
let hypeToken = 0;
let specialSnapshot = new Map();
const pendingClears = new Set();
const pendingSpecialTriggers = new Set();
const clearSeen = new WeakSet();
const specialTriggerSeen = new WeakSet();

function effectiveEffectsMode() {
  return reducedMotion ? "reduced" : effectsMode;
}

function applyEffectsMode() {
  document.body.dataset.cascadeEffects = effectiveEffectsMode();
  const button = document.querySelector("#cascade-effects-toggle");
  if (button) updateEffectsButton(button);
}

function installJuiceStyles() {
  if (document.querySelector('link[href="/cascade-juice.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/cascade-juice.css";
  document.head.append(link);
}

function getAudioContext() {
  if (!soundEnabled) return null;
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    try {
      audioContext = new AudioContextClass();
    } catch {
      return null;
    }
  }
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  return audioContext;
}

function tone(frequency, duration = .08, volume = .035, type = "sine", delay = 0) {
  const context = getAudioContext();
  if (!context) return;
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), start + .008);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + .02);
}

function playUiClick() {
  tone(310, .045, .018, "triangle");
}

function playTileTap() {
  tone(380, .04, .014, "sine");
}

function currentCascade() {
  const text = document.querySelector("#combo-label")?.textContent || "";
  const match = text.match(/×(\d+)/);
  return match ? Math.max(1, Number(match[1]) || 1) : 1;
}

function playClear(count) {
  const cascade = currentCascade();
  const base = 430 + Math.min(5, cascade) * 72;
  tone(base, .075, .026, "sine");
  tone(base * 1.25, .09, .019, "triangle", .022);
  if (count >= 8) tone(base * 1.5, .14, .022, "sine", .045);
  if (cascade >= 3) tone(base * 1.75, .12, .02, "triangle", .07);
}

function playHammer() {
  tone(150, .1, .045, "square");
  tone(340, .09, .022, "triangle", .045);
}

function playSpecialTrigger(type) {
  if (type === "color") {
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => tone(frequency, .13, .024, index % 2 ? "triangle" : "sine", index * .035));
    return;
  }
  if (type === "bomb") {
    tone(145, .14, .04, "square");
    tone(310, .12, .026, "triangle", .025);
    tone(620, .13, .021, "sine", .055);
    return;
  }
  tone(520, .09, .025, "triangle");
  tone(920, .1, .021, "sine", .035);
}

function playWin() {
  [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
    tone(frequency, .18, .032, "triangle", index * .085);
  });
}

function playFinalWin() {
  playWin();
  [659.25, 783.99, 987.77, 1318.51].forEach((frequency, index) => {
    tone(frequency, .22, .026, "sine", .34 + index * .09);
  });
}

function playSoftFail() {
  tone(330, .12, .025, "triangle");
  tone(247, .16, .022, "triangle", .095);
}

function ensureJuiceLayer() {
  let layer = document.querySelector(".cascade-juice-layer");
  if (layer) return layer;
  layer = document.createElement("div");
  layer.className = "cascade-juice-layer";
  layer.setAttribute("aria-hidden", "true");
  document.body.append(layer);
  return layer;
}

function ensureHypeLayer() {
  const wrap = document.querySelector(".cascade-board-wrap");
  if (!wrap) return null;
  let layer = wrap.querySelector(".cascade-hype-layer");
  if (layer) return layer;
  layer = document.createElement("div");
  layer.className = "cascade-hype-layer";
  layer.setAttribute("aria-hidden", "true");
  wrap.append(layer);
  return layer;
}

function tileColor(tile) {
  const kind = Number(tile?.dataset?.kind);
  return palette[Number.isInteger(kind) ? ((kind % palette.length) + palette.length) % palette.length : 0];
}

function centerOf(element) {
  const rect = element?.getBoundingClientRect?.();
  if (!rect) return null;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, rect };
}

function spawnPopBurst(tile, intensity = 1) {
  if (reducedMotion) return;
  const center = centerOf(tile);
  if (!center) return;
  const layer = ensureJuiceLayer();
  const color = tileColor(tile);
  const burst = document.createElement("div");
  burst.className = "cascade-pop-burst";
  burst.dataset.intensity = String(Math.max(1, Math.min(3, intensity)));
  burst.style.setProperty("--juice-x", `${center.x}px`);
  burst.style.setProperty("--juice-y", `${center.y}px`);
  burst.style.setProperty("--juice-color", color);

  const ring = document.createElement("span");
  ring.className = "cascade-pop-ring";
  burst.append(ring);

  const reduced = effectiveEffectsMode() === "reduced";
  const count = reduced ? 5 : intensity >= 3 ? 16 : intensity === 2 ? 11 : 7;
  for (let index = 0; index < count; index += 1) {
    const spark = document.createElement("i");
    spark.className = "cascade-pop-spark";
    spark.style.setProperty("--spark-angle", `${(360 / count) * index + (Math.random() * 14 - 7)}deg`);
    spark.style.setProperty("--spark-distance", `${26 + intensity * 14 + Math.random() * (18 + intensity * 8)}px`);
    spark.style.setProperty("--spark-size", `${4 + Math.random() * (intensity >= 2 ? 7 : 4)}px`);
    spark.style.setProperty("--spark-delay", `${Math.random() * 38}ms`);
    spark.style.setProperty("--spark-duration", `${430 + Math.random() * 170}ms`);
    burst.append(spark);
  }
  layer.append(burst);
  window.setTimeout(() => burst.remove(), 760);
}

function spawnSpecialBirth(tile, type) {
  if (!tile || reducedMotion) return;
  const center = centerOf(tile);
  if (!center) return;
  tile.classList.add("is-special-born");
  window.setTimeout(() => tile.classList.remove("is-special-born"), 720);

  const layer = ensureJuiceLayer();
  const birth = document.createElement("div");
  birth.className = "cascade-special-birth";
  birth.dataset.special = type;
  birth.style.setProperty("--juice-x", `${center.x}px`);
  birth.style.setProperty("--juice-y", `${center.y}px`);
  birth.style.setProperty("--juice-color", type === "color" ? "#ff5eaa" : tileColor(tile));
  const ring = document.createElement("span");
  ring.className = "cascade-birth-ring";
  birth.append(ring);
  const count = effectiveEffectsMode() === "reduced" ? 4 : type === "color" ? 14 : 10;
  for (let index = 0; index < count; index += 1) {
    const spark = document.createElement("i");
    spark.className = "cascade-birth-spark cascade-pop-spark";
    spark.style.setProperty("--spark-angle", `${(360 / count) * index}deg`);
    spark.style.setProperty("--spark-distance", `${48 + Math.random() * 38}px`);
    spark.style.setProperty("--spark-size", `${5 + Math.random() * 6}px`);
    spark.style.setProperty("--spark-delay", `${Math.random() * 60}ms`);
    birth.append(spark);
  }
  layer.append(birth);
  window.setTimeout(() => birth.remove(), 900);
}

function impact(level = 1) {
  if (effectiveEffectsMode() !== "full") return;
  const wrap = document.querySelector(".cascade-board-wrap");
  if (!wrap) return;
  const className = level >= 3 ? "is-juice-impact-big" : level === 2 ? "is-juice-impact-medium" : "is-juice-impact-small";
  wrap.classList.remove("is-juice-impact-small", "is-juice-impact-medium", "is-juice-impact-big");
  void wrap.offsetWidth;
  wrap.classList.add(className);
  window.setTimeout(() => wrap.classList.remove(className), level >= 3 ? 280 : 230);
}

function spawnStripeBeam(tile, type) {
  if (reducedMotion) return;
  const board = document.querySelector("#board");
  const center = centerOf(tile);
  const boardRect = board?.getBoundingClientRect();
  if (!center || !boardRect) return;
  const beam = document.createElement("div");
  const horizontal = type === "stripe-h";
  beam.className = `cascade-stripe-beam ${horizontal ? "is-horizontal" : "is-vertical"}`;
  beam.style.setProperty("--juice-color", tileColor(tile));
  if (horizontal) {
    beam.style.left = `${boardRect.left}px`;
    beam.style.top = `${center.y - Math.max(4, center.rect.height * .08)}px`;
    beam.style.width = `${boardRect.width}px`;
    beam.style.height = `${Math.max(8, center.rect.height * .16)}px`;
  } else {
    beam.style.left = `${center.x - Math.max(4, center.rect.width * .08)}px`;
    beam.style.top = `${boardRect.top}px`;
    beam.style.width = `${Math.max(8, center.rect.width * .16)}px`;
    beam.style.height = `${boardRect.height}px`;
  }
  ensureJuiceLayer().append(beam);
  window.setTimeout(() => beam.remove(), 560);
  impact(1);
}

function spawnBombImpact(tile) {
  if (reducedMotion) return;
  const center = centerOf(tile);
  if (!center) return;
  const effect = document.createElement("div");
  effect.className = "cascade-impact-bomb";
  effect.style.setProperty("--juice-x", `${center.x}px`);
  effect.style.setProperty("--juice-y", `${center.y}px`);
  effect.style.setProperty("--juice-color", tileColor(tile));
  const ring = document.createElement("span");
  ring.className = "cascade-bomb-ring";
  effect.append(ring);
  ensureJuiceLayer().append(effect);
  window.setTimeout(() => effect.remove(), 760);
  impact(2);
}

function spawnColorSweep(tile) {
  if (reducedMotion) return;
  const board = document.querySelector("#board");
  const rect = board?.getBoundingClientRect();
  if (!rect) return;
  const wash = document.createElement("div");
  wash.className = "cascade-color-wash";
  wash.style.left = `${rect.left}px`;
  wash.style.top = `${rect.top}px`;
  wash.style.width = `${rect.width}px`;
  wash.style.height = `${rect.height}px`;
  wash.style.setProperty("--juice-color", tileColor(tile));
  ensureJuiceLayer().append(wash);
  window.setTimeout(() => wash.remove(), 760);
  impact(3);
}

function showHype(text, tier = 2, subtext = "") {
  if (!text || reducedMotion) return;
  const layer = ensureHypeLayer();
  const wrap = document.querySelector(".cascade-board-wrap");
  if (!layer || !wrap) return;
  const token = ++hypeToken;
  layer.querySelectorAll(".cascade-hype-word").forEach((existing) => existing.remove());
  const word = document.createElement("div");
  word.className = "cascade-hype-word";
  word.style.setProperty("--hype-color", palette[(tier + 1) % palette.length]);
  word.style.setProperty("--hype-duration", tier >= 4 ? "1180ms" : "920ms");
  word.append(document.createTextNode(text));
  if (subtext) {
    const small = document.createElement("small");
    small.textContent = subtext;
    word.append(small);
  }
  layer.append(word);
  wrap.dataset.juiceHype = String(Math.max(2, Math.min(4, tier)));
  wrap.style.setProperty("--juice-hype-color", palette[(tier + 1) % palette.length]);
  window.setTimeout(() => {
    word.remove();
    if (token === hypeToken) delete wrap.dataset.juiceHype;
  }, tier >= 4 ? 1_260 : 1_020);
}

function hypeForCascade(cascade) {
  if (cascade < 2) return;
  if (cascade === 2) showHype("Nice!", 2, "Cascade ×2");
  else if (cascade === 3) showHype("Sweet!", 2, "Cascade ×3");
  else if (cascade === 4) showHype("Huge!", 3, "Cascade ×4");
  else showHype("Mega!", 4, `Cascade ×${cascade}`);
}

function specialPriority(type) {
  if (type === "color") return 3;
  if (type === "bomb") return 2;
  if (type === "stripe-h" || type === "stripe-v") return 1;
  return 0;
}

function processBoardEffects() {
  boardEffectsQueued = false;
  const clears = [...pendingClears];
  const triggered = [...pendingSpecialTriggers];
  pendingClears.clear();
  pendingSpecialTriggers.clear();
  const cascade = currentCascade();

  for (const tile of clears) {
    const special = tile.dataset.special || "";
    const intensity = (special || cascade >= 4) ? 3 : cascade >= 2 ? 2 : 1;
    spawnPopBurst(tile, intensity);
  }
  if (clears.length) playClear(clears.length);

  let strongestType = "";
  for (const tile of triggered) {
    const type = tile.dataset.special || "";
    if (type === "stripe-h" || type === "stripe-v") spawnStripeBeam(tile, type);
    else if (type === "bomb") spawnBombImpact(tile);
    else if (type === "color") spawnColorSweep(tile);
    if (specialPriority(type) > specialPriority(strongestType)) strongestType = type;
  }
  if (strongestType) playSpecialTrigger(strongestType);
  if (!triggered.length && cascade >= 3) impact(cascade >= 5 ? 2 : 1);
}

function scheduleBoardEffects() {
  if (boardEffectsQueued) return;
  boardEffectsQueued = true;
  queueMicrotask(processBoardEffects);
}

function readSpecialSnapshot() {
  const snapshot = new Map();
  document.querySelectorAll("#board .cascade-tile[data-special]").forEach((tile) => {
    snapshot.set(Number(tile.dataset.index), tile.dataset.special || "");
  });
  return snapshot;
}

function countSpecials(snapshot) {
  const counts = new Map();
  for (const type of snapshot.values()) counts.set(type, (counts.get(type) || 0) + 1);
  return counts;
}

function scanSpecialBirths() {
  boardScanQueued = false;
  const next = readSpecialSnapshot();
  const beforeCounts = countSpecials(specialSnapshot);
  const nextCounts = countSpecials(next);
  for (const [type, nextCount] of nextCounts) {
    const delta = nextCount - (beforeCounts.get(type) || 0);
    if (delta <= 0) continue;
    const candidates = [...next.entries()]
      .filter(([index, value]) => value === type && specialSnapshot.get(index) !== type)
      .slice(0, delta);
    for (const [index] of candidates) {
      const tile = document.querySelector(`#board .cascade-tile[data-index="${index}"]`);
      if (tile) spawnSpecialBirth(tile, type);
    }
  }
  specialSnapshot = next;
}

function scheduleSpecialScan() {
  if (boardScanQueued) return;
  boardScanQueued = true;
  queueMicrotask(scanSpecialBirths);
}

function handleBoardMutation(mutations) {
  let sawHammer = false;
  for (const mutation of mutations) {
    if (mutation.type === "childList") {
      scheduleSpecialScan();
      continue;
    }
    if (mutation.type !== "attributes") continue;
    const tile = mutation.target;
    if (!(tile instanceof HTMLElement) || !tile.classList.contains("cascade-tile")) continue;
    if (tile.classList.contains("is-hammer-hit")) sawHammer = true;
    if (tile.classList.contains("is-clearing") && !clearSeen.has(tile)) {
      clearSeen.add(tile);
      pendingClears.add(tile);
      scheduleBoardEffects();
    }
    if (tile.classList.contains("is-special-triggered") && !specialTriggerSeen.has(tile)) {
      specialTriggerSeen.add(tile);
      pendingSpecialTriggers.add(tile);
      scheduleBoardEffects();
    }
  }
  if (sawHammer) playHammer();
}

function handleComboMutation() {
  queueMicrotask(() => {
    const element = document.querySelector("#combo-label");
    const text = element?.textContent?.trim() || "";
    if (text === lastComboText) return;
    lastComboText = text;
    if (!text) return;
    const cascadeMatch = text.match(/CASCADE\s*×(\d+)/i);
    if (cascadeMatch) {
      hypeForCascade(Math.max(2, Number(cascadeMatch[1]) || 2));
      return;
    }
    if (element?.classList.contains("is-wild") && text !== "SPECIAL MADE") {
      showHype("Power Combo!", 4, text.replaceAll("_", " "));
      impact(3);
    }
  });
}

function celebrate(finalRun = false) {
  if (reducedMotion) return;
  document.querySelector(".cascade-confetti-layer")?.remove();
  document.querySelector(".cascade-win-bloom")?.remove();
  const layer = document.createElement("div");
  layer.className = "cascade-confetti-layer";
  layer.setAttribute("aria-hidden", "true");
  const reduced = effectiveEffectsMode() === "reduced";
  const count = reduced ? (finalRun ? 28 : 20) : (finalRun ? 82 : 48);
  for (let index = 0; index < count; index += 1) {
    const piece = document.createElement("i");
    piece.className = "cascade-confetti-piece";
    piece.style.setProperty("--x", `${2 + Math.random() * 96}%`);
    piece.style.setProperty("--w", `${7 + Math.random() * 11}px`);
    piece.style.setProperty("--confetti", palette[index % palette.length]);
    piece.style.setProperty("--duration", `${1.8 + Math.random() * 1.5}s`);
    piece.style.setProperty("--delay", `${Math.random() * .35}s`);
    piece.style.setProperty("--drift", `${-90 + Math.random() * 180}px`);
    piece.style.setProperty("--spin", `${360 + Math.round(Math.random() * 860)}deg`);
    layer.append(piece);
  }
  document.body.append(layer);

  if (!reduced) {
    const bloom = document.createElement("div");
    bloom.className = "cascade-win-bloom";
    bloom.setAttribute("aria-hidden", "true");
    document.body.append(bloom);
    window.setTimeout(() => bloom.remove(), 1_400);
  }
  showHype(finalRun ? "Run Crushed!" : "Level Clear!", 4, finalRun ? "300 levels" : "Nice work");
  window.setTimeout(() => layer.remove(), 4_000);
}

function updateSoundButton(button) {
  button.textContent = soundEnabled ? "🔊 Sound on" : "🔇 Sound off";
  button.setAttribute("aria-pressed", String(soundEnabled));
}

function updateEffectsButton(button) {
  const reduced = effectiveEffectsMode() === "reduced";
  button.textContent = reduced ? "✨ Effects reduced" : "✨ Effects full";
  button.setAttribute("aria-pressed", String(reduced));
  button.title = reducedMotion ? "Your device requests reduced motion." : "Toggle full or reduced visual effects.";
}

function setEffectsMode(mode) {
  effectsMode = mode === "reduced" ? "reduced" : "full";
  localStorage.setItem(EFFECTS_KEY, effectsMode);
  applyEffectsMode();
  return effectiveEffectsMode();
}

function installFeedbackControls() {
  const side = document.querySelector(".cascade-side");
  if (!side || document.querySelector("#cascade-feedback-card")) return;
  const card = document.createElement("div");
  card.id = "cascade-feedback-card";
  card.className = "cascade-card cascade-feedback-card";
  const label = document.createElement("small");
  label.textContent = "FEEDBACK";
  const controls = document.createElement("div");
  controls.className = "cascade-feedback-controls";

  const soundButton = document.createElement("button");
  soundButton.type = "button";
  soundButton.id = "cascade-sound-toggle";
  updateSoundButton(soundButton);
  soundButton.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem(SOUND_KEY, soundEnabled ? "on" : "off");
    updateSoundButton(soundButton);
    if (soundEnabled) {
      getAudioContext();
      tone(523.25, .08, .025, "triangle");
      tone(659.25, .09, .02, "triangle", .06);
    }
  });

  const effectsButton = document.createElement("button");
  effectsButton.type = "button";
  effectsButton.id = "cascade-effects-toggle";
  updateEffectsButton(effectsButton);
  effectsButton.addEventListener("click", () => {
    setEffectsMode(effectsMode === "reduced" ? "full" : "reduced");
    if (effectiveEffectsMode() === "full") showHype("Pop!", 2, "Full effects");
  });

  controls.append(soundButton, effectsButton);
  card.append(label, controls);
  side.append(card);
}

function handleResultDialog() {
  const dialog = document.querySelector("#result-dialog");
  if (!dialog) return;
  const isOpen = dialog.hasAttribute("open");
  if (!isOpen || resultWasOpen) {
    resultWasOpen = isOpen;
    if (!isOpen) dialog.classList.remove("is-celebrating");
    return;
  }
  resultWasOpen = true;
  const kicker = document.querySelector("#result-kicker")?.textContent || "";
  if (kicker === "LEVEL COMPLETE") {
    dialog.classList.add("is-celebrating");
    playWin();
    celebrate(false);
  } else if (kicker === "RUN COMPLETE") {
    dialog.classList.add("is-celebrating");
    playFinalWin();
    celebrate(true);
  } else if (kicker === "OUT OF MOVES" || kicker === "OUT OF LIVES") {
    playSoftFail();
  }
}

function demo(effect = "color") {
  const board = document.querySelector("#board");
  const tile = board?.querySelector('.cascade-tile[data-index="27"]') || board?.querySelector(".cascade-tile");
  if (!tile) return false;
  spawnPopBurst(tile, 3);
  if (effect === "stripe") {
    spawnStripeBeam(tile, "stripe-h");
    showHype("Sweet!", 3, "Stripe blast");
  } else if (effect === "bomb") {
    spawnBombImpact(tile);
    showHype("Huge!", 3, "Bomb blast");
  } else {
    spawnColorSweep(tile);
    showHype("Mega!", 4, "Color clear");
  }
  return true;
}

installJuiceStyles();
applyEffectsMode();
installFeedbackControls();

const board = document.querySelector("#board");
if (board) {
  specialSnapshot = readSpecialSnapshot();
  new MutationObserver(handleBoardMutation).observe(board, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class"],
  });
}

const comboLabel = document.querySelector("#combo-label");
if (comboLabel) {
  new MutationObserver(handleComboMutation).observe(comboLabel, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class"],
  });
}

const resultDialog = document.querySelector("#result-dialog");
if (resultDialog) {
  new MutationObserver(handleResultDialog).observe(resultDialog, {
    attributes: true,
    attributeFilter: ["open"],
  });
}

document.addEventListener("pointerdown", (event) => {
  if (!soundEnabled) return;
  getAudioContext();
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  if (target.closest(".cascade-tile")) {
    playTileTap();
    return;
  }
  if (target.closest("button")) playUiClick();
}, { passive: true });

window.cascadePolish = Object.freeze({
  demo,
  getEffectsMode: () => effectiveEffectsMode(),
  setEffectsMode,
});