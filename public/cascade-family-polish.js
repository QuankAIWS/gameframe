const ACTIVE_RUN_KEY = "scribbles-gameframe.cascade-active-run:v1";
const BLITZ_RETURN_KEY = "scribbles-gameframe.cascade-blitz-return:v1";
const SOUND_KEY = "scribbles-gameframe.cascade-sound:v1";

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

function restoreNormalRunAfterBlitz(event) {
  const button = event.target instanceof Element ? event.target.closest("#result-actions button") : null;
  if (!button || button.textContent !== "Continue") return;
  if (resultKicker?.textContent !== "BLITZ COMPLETE") return;
  const snapshot = window.sessionStorage.getItem(BLITZ_RETURN_KEY);
  if (!snapshot) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  window.localStorage.setItem(ACTIVE_RUN_KEY, snapshot);
  window.sessionStorage.removeItem(BLITZ_RETURN_KEY);
  if (resultDialog?.open) resultDialog.close();
  window.location.reload();
}

function hardenTerminalDialog() {
  resultDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
  });
}

function polishPlayerCopy() {
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
const soundSeen = new WeakSet();
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

function addTactileSound(node) {
  if (!(node instanceof HTMLElement) || !node.classList.contains("cascade-tile") || soundSeen.has(node)) return;
  if (node.classList.contains("is-special-triggered")) {
    soundSeen.add(node);
    const special = node.dataset.special || "";
    if (special === "bomb") {
      bodyThump(92, 0.16, 0.024);
      noiseBurst(0.095, 0.018, 140, 2500);
    } else if (special === "stripe-h" || special === "stripe-v") {
      noiseBurst(0.12, 0.012, 900, 7600);
    } else if (special === "color") {
      noiseBurst(0.18, 0.01, 1500, 9800);
    }
    return;
  }
  if (node.classList.contains("is-clearing")) {
    soundSeen.add(node);
    noiseBurst(0.045, 0.0065, 650, 5000);
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
hardenTerminalDialog();
installTactileAudio();
polishPlayerCopy();

document.addEventListener("click", restoreNormalRunAfterBlitz, true);
new MutationObserver(polishPlayerCopy).observe(document.body, { subtree: true, childList: true, characterData: true });

window.cascadeFamilyPolish = Object.freeze({ preserveNormalRunForBonus, polishPlayerCopy });
