const stylesheetUrl = "/monster-master-hints.css";
if (!document.querySelector(`link[href="${stylesheetUrl}"]`)) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = stylesheetUrl;
  document.head.append(stylesheet);
}

const STORAGE_KEY = "gameframe:monster-master:hints-enabled";
const briefing = document.querySelector(".monster-master-board-briefing");
const status = document.querySelector("#monster-master-status");
const help = document.querySelector("#monster-master-help");
const match = document.querySelector("#monster-master-match");
let toast = null;
let toggle = null;
let dismissTimer = null;
let enabled = true;

function readPreference() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

function writePreference(value) {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Hint persistence is optional.
  }
}

function clearDismissTimer() {
  if (dismissTimer !== null) {
    window.clearTimeout(dismissTimer);
    dismissTimer = null;
  }
}

function hideToast() {
  clearDismissTimer();
  toast?.classList.remove("is-visible");
}

function showToast({ duration = 5200 } = {}) {
  if (!enabled || !toast || !status || match?.hidden) return;
  const message = status.textContent?.trim();
  if (!message) return;
  clearDismissTimer();
  toast.classList.remove("is-visible");
  requestAnimationFrame(() => {
    toast?.classList.add("is-visible");
  });
  dismissTimer = window.setTimeout(hideToast, duration);
}

function setEnabled(nextEnabled, { persist = true, reveal = true } = {}) {
  enabled = Boolean(nextEnabled);
  document.body.classList.toggle("monster-master-hints-disabled", !enabled);
  if (toggle) toggle.checked = enabled;
  if (status) status.setAttribute("aria-live", enabled ? "polite" : "off");
  if (persist) writePreference(enabled);
  if (enabled && reveal) showToast();
  else if (!enabled) hideToast();
}

function installHintLayer() {
  if (!briefing || !status) return false;
  briefing.classList.add("monster-master-hint-layer");
  briefing.querySelector(".section-label")?.remove();
  help?.classList.add("monster-master-sr-only");

  toast = document.createElement("div");
  toast.id = "monster-master-status-toast";
  toast.className = "monster-master-status-toast";
  status.classList.add("monster-master-status-toast-message");
  briefing.insertBefore(toast, status);
  toast.append(status);

  const label = document.createElement("label");
  label.className = "monster-master-hints-toggle";
  label.setAttribute("aria-label", "Show battlefield hints");
  label.innerHTML = `
    <input id="monster-master-hints-enabled" type="checkbox">
    <span class="monster-master-hints-check" aria-hidden="true">✓</span>
    <span>Hints</span>
  `;
  briefing.insertBefore(label, toast);
  toggle = label.querySelector("input");
  toggle?.addEventListener("change", () => setEnabled(toggle.checked));

  new MutationObserver(() => showToast()).observe(status, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  new MutationObserver(() => {
    if (match.hidden) hideToast();
    else showToast({ duration: 6200 });
  }).observe(match, { attributes: true, attributeFilter: ["hidden"] });

  enabled = readPreference();
  setEnabled(enabled, { persist: false, reveal: false });
  document.body.classList.add("monster-master-hints-ready");
  if (!match.hidden) showToast({ duration: 6200 });
  return true;
}

installHintLayer();

window.gameFrameMonsterHints = Object.freeze({
  isEnabled: () => enabled,
  setEnabled,
  show: showToast,
  hide: hideToast,
});
