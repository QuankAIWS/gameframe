const scoreHost = document.querySelector("#score");
const livesHost = document.querySelector("#lives");
const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
const LIFE_MAX = 5;

let scoreFrame = 0;
let scoreVisualValue = 0;
let scoreTargetValue = 0;
let scorePaints = 0;

function numericText(value) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function formatScore(value) {
  return Math.max(0, Math.round(Number(value) || 0)).toLocaleString();
}

function scoreVisual() {
  return scoreHost?.querySelector(":scope > .cascade-score-value") ?? null;
}

function paintScore(value) {
  if (!scoreHost) return;
  let visual = scoreVisual();
  if (!visual) {
    visual = document.createElement("span");
    visual.className = "cascade-score-value";
    scoreHost.replaceChildren(visual);
  }
  scoreVisualValue = Math.max(0, Math.round(Number(value) || 0));
  visual.textContent = formatScore(scoreVisualValue);
  scoreHost.setAttribute("aria-label", `Score ${formatScore(scoreVisualValue)} points`);
  scorePaints += 1;
}

function finishScoreAnimation() {
  if (!scoreHost) return;
  scoreFrame = 0;
  scoreVisualValue = scoreTargetValue;
  paintScore(scoreTargetValue);
  scoreHost.classList.remove("is-counting", "is-score-jump");
}

function animateScoreTo(nextValue) {
  if (!scoreHost) return;
  const next = Math.max(0, Math.round(Number(nextValue) || 0));
  window.cancelAnimationFrame(scoreFrame);
  scoreFrame = 0;

  if (!scoreVisual()) {
    const source = numericText(scoreHost.textContent);
    if (scorePaints === 0) scoreVisualValue = source;
  }

  const start = Math.max(0, scoreVisualValue);
  scoreTargetValue = next;
  scoreHost.dataset.scoreTarget = String(next);

  if (reducedMotion || next <= start || next === 0) {
    paintScore(next);
    scoreHost.classList.remove("is-counting", "is-score-jump");
    return;
  }

  const gain = next - start;
  const duration = Math.min(760, Math.max(420, 350 + Math.log10(gain + 1) * 105));
  const startedAt = window.performance?.now?.() ?? Date.now();
  scoreHost.classList.toggle("is-score-jump", gain >= 1000);
  scoreHost.classList.remove("is-counting");
  void scoreHost.offsetWidth;
  scoreHost.classList.add("is-counting");

  const step = (now) => {
    const elapsed = Math.max(0, now - startedAt);
    const progress = Math.min(1, elapsed / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(start + gain * eased);
    paintScore(value);
    if (progress >= 1) {
      finishScoreAnimation();
      return;
    }
    scoreFrame = window.requestAnimationFrame(step);
  };

  paintScore(start);
  scoreFrame = window.requestAnimationFrame(step);
}

function rawLivesCount() {
  if (!livesHost) return 0;
  const raw = livesHost.textContent?.trim() ?? "";
  if (raw === "0") return 0;
  return Math.max(0, Math.min(LIFE_MAX, (raw.match(/♥/g) || []).length));
}

function mountLives(count) {
  if (!livesHost) return;
  const lives = Math.max(0, Math.min(LIFE_MAX, Math.floor(Number(count) || 0)));
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < LIFE_MAX; index += 1) {
    const heart = document.createElement("span");
    heart.className = `cascade-life-heart ${index < lives ? "is-full" : "is-empty"}`;
    heart.textContent = "♥";
    heart.setAttribute("aria-hidden", "true");
    fragment.append(heart);
  }
  livesHost.replaceChildren(fragment);
  livesHost.dataset.lives = String(lives);
  livesHost.setAttribute("aria-label", `${lives} of ${LIFE_MAX} lives`);
}

if (scoreHost) {
  scoreVisualValue = numericText(scoreHost.textContent);
  scoreTargetValue = scoreVisualValue;
  paintScore(scoreVisualValue);
  new MutationObserver(() => {
    if (scoreVisual()) return;
    animateScoreTo(numericText(scoreHost.textContent));
  }).observe(scoreHost, { childList: true });
}

if (livesHost) {
  mountLives(rawLivesCount());
  new MutationObserver(() => {
    if (livesHost.querySelector(":scope > .cascade-life-heart")) return;
    mountLives(rawLivesCount());
  }).observe(livesHost, { childList: true });
}

window.cascadeHudPolish = Object.freeze({
  getStats() {
    return {
      scoreVisualValue,
      scoreTargetValue,
      scorePaints,
      lifeSlots: livesHost?.querySelectorAll(":scope > .cascade-life-heart").length ?? 0,
      filledLives: livesHost?.querySelectorAll(":scope > .cascade-life-heart.is-full").length ?? 0,
    };
  },
});
