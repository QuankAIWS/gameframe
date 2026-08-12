const ACTIVE_RUN_KEY = "scribbles-gameframe.cascade-active-run:v1";
const BLITZ_RETURN_KEY = "scribbles-gameframe.cascade-blitz-return:v1";
const SOUND_KEY = "scribbles-gameframe.cascade-sound:v1";
const WEEKLY_SCORE_WAIT_MS = 4_000;

const resultDialog = document.querySelector("#result-dialog");
const resultKicker = document.querySelector("#result-kicker");

function preserveNormalRunForBonus() {
  const activeRun = window.localStorage.getItem(ACTIVE_RUN_KEY);
  if (activeRun) window.sessionStorage.setItem(BLITZ_RETURN_KEY, activeRun);
}

function wrapResearchBlitz() {
  const research = window.cascadeResearch;
  if (!research?.startBlitz || research.familyPolishWrapped) return;
  window.cascadeResearch = Object.freeze({
    ...research,
    familyPolishWrapped: true,
    startBlitz(completedLevel = 5) {
      preserveNormalRunForBonus();
      return research.startBlitz(completedLevel);
    },
  });
}

function waitForWeeklyScoreSettlement(timeoutMs = WEEKLY_SCORE_WAIT_MS) {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      const status = document.querySelector("[data-weekly-status]");
      if (!status || !status.textContent?.startsWith("Saving weekly score")) {
        resolve(true);
        return;
      }

      let settled = false;
      let observer = null;
      const finish = (sharedSaved) => {
        if (settled) return;
        settled = true;
        observer?.disconnect();
        window.clearTimeout(timeout);
        resolve(sharedSaved);
      };
      observer = new MutationObserver(() => {
        if (status.textContent?.startsWith("Saving weekly score")) return;
        finish(true);
      });
      observer.observe(status, { subtree: true, childList: true, characterData: true });
      const timeout = window.setTimeout(() => {
        if (status.textContent?.startsWith("Saving weekly score")) {
          status.textContent = "Score saved locally; shared standings unavailable.";
        }
        finish(false);
      }, Math.max(250, Number(timeoutMs) || WEEKLY_SCORE_WAIT_MS));
    });
  });
}

async function restoreNormalRunAfterBlitz(event) {
  const button = event.target instanceof Element ? event.target.closest("#result-actions button") : null;
  if (!button || button.textContent !== "Continue") return;
  if (resultKicker?.textContent !== "BLITZ COMPLETE") return;
  const snapshot = window.sessionStorage.getItem(BLITZ_RETURN_KEY);
  if (!snapshot) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  button.disabled = true;
  const originalLabel = button.textContent;
  if (document.querySelector("[data-weekly-status]")?.textContent?.startsWith("Saving weekly score")) {
    button.textContent = "Saving score…";
  }
  await waitForWeeklyScoreSettlement();
  button.textContent = originalLabel;
  window.localStorage.setItem(ACTIVE_RUN_KEY, snapshot);
  window.sessionStorage.removeItem(BLITZ_RETURN_KEY);
  if (resultDialog?.open) resultDialog.close();
  window.location.reload();
}

function hardenTerminalDialogs() {
  document.addEventListener("cancel", (event) => {
    const dialog = event.target;
    if (!(dialog instanceof HTMLDialogElement)) return;
    if (dialog === resultDialog || dialog.id === "cascade-recall-dialog") event.preventDefault();
  }, true);
}

function polishLevelTreeStars() {
  for (const badge of document.querySelectorAll(".cascade-map-stars")) {
    const match = badge.getAttribute("aria-label")?.match(/^Best rating: ([1-3]) of 3 stars$/);
    if (!match) continue;
    const filled = "★".repeat(Number(match[1]));
    if (badge.textContent !== filled) badge.textContent = filled;
  }
}

function polishPlayerCopy() {
  polishLevelTreeStars();

  const feedbackLabel = document.querySelector("#cascade-feedback-card > small");
  if (feedbackLabel?.textContent === "FEEDBACK") feedbackLabel.textContent = "SETTINGS";

  const weeklyCopy = document.querySelector("[data-weekly-copy]");
  if (weeklyCopy?.textContent?.includes("same board seed for everyone")) {
    weeklyCopy.textContent = weeklyCopy.textContent.replace("same board seed for everyone", "everyone gets the same board this week");
  }

  const weeklyStatus = document.querySelector("[data-weekly-status]");
  if (weeklyStatus?.textContent?.startsWith("Shared seed ·")) {
    weeklyStatus.textContent = weeklyStatus.textContent.replace("Shared seed ·", "Same board for everyone ·");
  }
}

let audioContext = null;
const clearSoundSeen = new WeakSet();
const specialSoundSeen = new WeakSet();
let clearSoundQueued = false;
let pendingClearCount = 0;
let resultSoundOpen = false;

function soundEnabled() {
  return window.localStorage.getItem(SOUND_KEY) !== "off";
}

function getAudioContext() {
  if (!soundEnabled()) return null;
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

function noiseBurst(duration = 0.055, volume = 0.012, highpass = 420, lowpass = 5200) {
  const context = getAudioContext();
  if (!context) return;
  const frameCount = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    const decay = 1 - (index / data.length);
    data[index] = (Math.random() * 2 - 1) * decay;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  const hp = context.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = highpass;
  const lp = context.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = lowpass;
  const gain = context.createGain();
  const now = context.currentTime;
  gain.gain.setValueAtTime(Math.max(0.0001, volume), now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.connect(hp);
  hp.connect(lp);
  lp.connect(gain);
  gain.connect(context.destination);
  source.start(now);
}

function bodyThump(frequency = 105, duration = 0.1, volume = 0.018) {
  const context = getAudioContext();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(45, frequency * 0.55), now + duration);
  gain.gain.setValueAtTime(Math.max(0.0001, volume), now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function queueClearSound() {
  pendingClearCount += 1;
  if (clearSoundQueued) return;
  clearSoundQueued = true;
  queueMicrotask(() => {
    clearSoundQueued = false;
    const count = pendingClearCount;
    pendingClearCount = 0;
    if (!count) return;
    const intensity = Math.min(1, count / 10);
    noiseBurst(0.04 + intensity * 0.025, 0.0055 + intensity * 0.003, 650, 5000 + count * 80);
  });
}

function addTactileSound(node) {
  if (!(node instanceof HTMLElement) || !node.classList.contains("cascade-tile")) return;
  if (node.classList.contains("is-special-triggered") && !specialSoundSeen.has(node)) {
    specialSoundSeen.add(node);
    const special = node.dataset.special || "";
    if (special === "bomb") {
      bodyThump(92, 0.16, 0.024);
      noiseBurst(0.095, 0.018, 140, 2500);
    } else if (special === "stripe-h" || special === "stripe-v") {
      noiseBurst(0.12, 0.012, 900, 7600);
    } else if (special === "color") {
      noiseBurst(0.18, 0.01, 1500, 9800);
    }
  }
  if (node.classList.contains("is-clearing") && !clearSoundSeen.has(node)) {
    clearSoundSeen.add(node);
    queueClearSound();
  }
}

function installTactileAudio() {
  const board = document.querySelector("#board");
  if (board) {
    new MutationObserver((mutations) => {
      for (const mutation of mutations) addTactileSound(mutation.target);
    }).observe(board, { subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  if (resultDialog) {
    new MutationObserver(() => {
      const open = resultDialog.open;
      if (!open || resultSoundOpen) {
        resultSoundOpen = open;
        return;
      }
      resultSoundOpen = true;
      const kicker = resultKicker?.textContent || "";
      if (kicker === "LEVEL COMPLETE" || kicker === "RUN COMPLETE") {
        bodyThump(kicker === "RUN COMPLETE" ? 118 : 132, 0.18, 0.015);
        noiseBurst(0.16, 0.008, 1200, 8500);
      } else if (kicker === "OUT OF MOVES" || kicker === "OUT OF LIVES") {
        bodyThump(76, 0.12, 0.012);
      }
    }).observe(resultDialog, { attributes: true, attributeFilter: ["open"] });
  }

  document.addEventListener("pointerdown", () => {
    getAudioContext();
  }, { passive: true, once: true });
}

wrapResearchBlitz();
hardenTerminalDialogs();
installTactileAudio();
polishPlayerCopy();

document.addEventListener("click", restoreNormalRunAfterBlitz, true);
new MutationObserver(polishPlayerCopy).observe(document.body, { subtree: true, childList: true, characterData: true });

window.cascadeFamilyPolish = Object.freeze({ preserveNormalRunForBonus, polishLevelTreeStars, polishPlayerCopy });
