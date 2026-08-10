const SOUND_KEY = "scribbles-gameframe.cascade-sound:v1";
const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
const palette = ["#ff5eaa", "#44c9ee", "#ffd34e", "#69d877", "#a56af4", "#ff914d"];

let soundEnabled = localStorage.getItem(SOUND_KEY) !== "off";
let audioContext = null;
let clearSoundQueued = false;
let resultWasOpen = false;

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
  if (count >= 8) {
    tone(base * 1.5, .14, .022, "sine", .045);
  }
  if (cascade >= 3) {
    tone(base * 1.75, .12, .02, "triangle", .07);
  }
}

function playHammer() {
  tone(150, .1, .045, "square");
  tone(340, .09, .022, "triangle", .045);
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

function celebrate(finalRun = false) {
  if (reducedMotion) return;
  document.querySelector(".cascade-confetti-layer")?.remove();
  const layer = document.createElement("div");
  layer.className = "cascade-confetti-layer";
  layer.setAttribute("aria-hidden", "true");
  const count = finalRun ? 54 : 32;
  for (let index = 0; index < count; index += 1) {
    const piece = document.createElement("i");
    piece.className = "cascade-confetti-piece";
    piece.style.setProperty("--x", `${2 + Math.random() * 96}%`);
    piece.style.setProperty("--w", `${7 + Math.random() * 10}px`);
    piece.style.setProperty("--confetti", palette[index % palette.length]);
    piece.style.setProperty("--duration", `${1.8 + Math.random() * 1.5}s`);
    piece.style.setProperty("--delay", `${Math.random() * .35}s`);
    piece.style.setProperty("--drift", `${-70 + Math.random() * 140}px`);
    piece.style.setProperty("--spin", `${360 + Math.round(Math.random() * 720)}deg`);
    layer.append(piece);
  }
  document.body.append(layer);
  window.setTimeout(() => layer.remove(), 4_000);
}

function updateSoundButton(button) {
  button.textContent = soundEnabled ? "🔊 Sound on" : "🔇 Sound off";
  button.setAttribute("aria-pressed", String(soundEnabled));
}

function installSoundControl() {
  const side = document.querySelector(".cascade-side");
  if (!side || document.querySelector("#cascade-sound-toggle")) return;
  const card = document.createElement("div");
  card.className = "cascade-card cascade-sound-card";
  const label = document.createElement("small");
  label.textContent = "SOUND";
  const button = document.createElement("button");
  button.type = "button";
  button.id = "cascade-sound-toggle";
  updateSoundButton(button);
  button.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem(SOUND_KEY, soundEnabled ? "on" : "off");
    updateSoundButton(button);
    if (soundEnabled) {
      getAudioContext();
      tone(523.25, .08, .025, "triangle");
      tone(659.25, .09, .02, "triangle", .06);
    }
  });
  card.append(label, button);
  side.append(card);
}

function installBranding() {
  const adminDialog = document.querySelector("#cascade-admin-dialog");
  const adminLabel = adminDialog?.querySelector("header small");
  if (adminLabel?.textContent?.trim() === "CASCADE ADMIN") {
    adminLabel.textContent = "CASCADE CRUSH ADMIN";
  }
}

function handleBoardMutation(mutations) {
  let sawHammer = false;
  let sawClear = false;
  for (const mutation of mutations) {
    if (mutation.type !== "attributes") continue;
    const tile = mutation.target;
    if (!(tile instanceof HTMLElement) || !tile.classList.contains("cascade-tile")) continue;
    if (tile.classList.contains("is-hammer-hit")) sawHammer = true;
    if (tile.classList.contains("is-clearing")) sawClear = true;
  }
  if (sawHammer) playHammer();
  if (!sawClear || clearSoundQueued) return;
  clearSoundQueued = true;
  queueMicrotask(() => {
    clearSoundQueued = false;
    const count = document.querySelectorAll(".cascade-tile.is-clearing").length;
    if (count) playClear(count);
  });
}

function handleResultDialog() {
  const dialog = document.querySelector("#result-dialog");
  if (!dialog) return;
  const isOpen = dialog.hasAttribute("open");
  if (!isOpen || resultWasOpen) {
    resultWasOpen = isOpen;
    return;
  }
  resultWasOpen = true;
  const kicker = document.querySelector("#result-kicker")?.textContent || "";
  if (kicker === "LEVEL COMPLETE") {
    playWin();
    celebrate(false);
  } else if (kicker === "RUN COMPLETE") {
    playFinalWin();
    celebrate(true);
  } else if (kicker === "OUT OF MOVES" || kicker === "OUT OF LIVES") {
    playSoftFail();
  }
}

installSoundControl();
installBranding();
new MutationObserver(installBranding).observe(document.body, { childList: true, subtree: true });

const board = document.querySelector("#board");
if (board) {
  new MutationObserver(handleBoardMutation).observe(board, {
    subtree: true,
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
