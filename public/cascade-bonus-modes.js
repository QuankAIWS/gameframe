import { establishGameFrameIdentity, gameFrameFetch } from "./gameframe-auth.js";
import { HAMMER_MAX, resolveStarHammerReward } from "./cascade-hammer-economy.js";
import { LEVEL_COUNT } from "./cascade-engine.js";

const PERFORMANCE_KEY = "scribbles-gameframe.cascade-performance:v1";
const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const ANALYTICS_KEY = "scribbles-gameframe.cascade-analytics:v1";
const QUICK_RECALL_AFTER_LEVELS = Object.freeze(new Set([
  8, 24, 48, 72, 96, 126, 156, 186, 216, 246, 276,
  306, 336, 366, 396, 426, 456, 486, 516, 546, 576,
  606, 636, 666, 696, 726, 756, 786, 816, 846, 876,
]));
const RECALL_ROUNDS = Object.freeze([2, 3, 4]);
const RECALL_PACE = Object.freeze([
  Object.freeze({ leadIn: 700, show: 1100, gap: 260 }),
  Object.freeze({ leadIn: 650, show: 950, gap: 230 }),
  Object.freeze({ leadIn: 600, show: 825, gap: 200 }),
]);
const WEEKLY_MODE_ID = "weekly-blitz";
const WEEKLY_RULESET = "cascade-weekly-blitz-v1";
const WEEKLY_COMPLETED_LEVEL_SEED = 99;

const resultDialog = document.querySelector("#result-dialog");
const resultKicker = document.querySelector("#result-kicker");
const resultCopy = document.querySelector("#result-copy");
const side = document.querySelector(".cascade-side");
const research = window.cascadeResearch;

let continueBypass = false;
let weeklyRun = null;
let weeklySubmissionPromise = null;
let identityPromise = null;
let recallRun = null;

function safeJson(key, fallback) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "null");
    return value && typeof value === "object" ? value : structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

function performanceState() {
  const value = safeJson(PERFORMANCE_KEY, {});
  const { pendingHammerRewards: _discardedLegacyHammerBank, ...persisted } = value;
  return {
    ...persisted,
    starsByLevel: value.starsByLevel && typeof value.starsByLevel === "object" ? value.starsByLevel : {},
    blitzStars: value.blitzStars && typeof value.blitzStars === "object" ? value.blitzStars : {},
    recallBest: value.recallBest && typeof value.recallBest === "object" ? value.recallBest : {},
    recallSeen: value.recallSeen && typeof value.recallSeen === "object" ? value.recallSeen : {},
  };
}

function savePerformance(value) {
  window.localStorage.setItem(PERFORMANCE_KEY, JSON.stringify(value));
}

function totalBestStars(value) {
  const normal = Object.values(value.starsByLevel || {}).reduce((sum, stars) => sum + Math.max(0, Math.min(3, Number(stars) || 0)), 0);
  // The v1 Cascade performance schema stores all bonus stars in blitzStars.
  // Recall uses a distinct prefixed key so the existing total-star and hammer economy remains backward compatible.
  const bonus = Object.values(value.blitzStars || {}).reduce((sum, stars) => sum + Math.max(0, Math.min(3, Number(stars) || 0)), 0);
  return normal + bonus;
}

function adaptiveRecallRounds() {
  const history = Object.values(performanceState().recallBest || {})
    .map((entry) => Number(entry?.accuracy))
    .filter((value) => Number.isFinite(value))
    .slice(-4);
  if (!history.length) return RECALL_ROUNDS.slice();
  const average = history.reduce((sum, value) => sum + value, 0) / history.length;
  if (average >= .88) return [3, 4, 5];
  if (average >= .68) return [2, 3, 4];
  return [2, 2, 3];
}

function recallStars(accuracy) {
  if (accuracy >= 0.9) return 3;
  if (accuracy >= 0.7) return 2;
  return accuracy > 0 ? 1 : 0;
}

function awardRecallResult(id, result) {
  const value = performanceState();
  const previousTotal = totalBestStars(value);
  const previousStars = Math.max(0, Math.min(3, Number(value.blitzStars[id]) || 0));
  const stars = recallStars(result.accuracy);
  const bestStars = Math.max(previousStars, stars);
  const previousBest = Math.max(0, Number(value.recallBest[id]?.accuracy) || 0);
  if (!value.recallBest[id] || result.accuracy > previousBest) {
    value.recallBest[id] = {
      accuracy: result.accuracy,
      correct: result.correct,
      total: result.total,
      perfectRounds: result.perfectRounds,
      updatedAt: Date.now(),
    };
  }
  value.blitzStars[id] = bestStars;
  const nextTotal = previousTotal + (bestStars - previousStars);
  const state = safeJson(STATE_KEY, {});
  const hammerReward = resolveStarHammerReward({
    hammers: Math.max(0, Math.min(HAMMER_MAX, Number(state.hammers) || 0)),
    previousStars: previousTotal,
    nextStars: nextTotal,
  });
  if (hammerReward.granted > 0) {
    state.hammers = hammerReward.hammers;
    window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }
  savePerformance(value);
  return {
    stars,
    bestStars,
    rewards: hammerReward.granted,
    claimed: hammerReward.granted,
    discarded: hammerReward.discarded,
    best: value.recallBest[id],
  };
}

function track(type, detail = {}) {
  try {
    const events = JSON.parse(window.localStorage.getItem(ANALYTICS_KEY) || "[]");
    events.push({ at: new Date().toISOString(), type, mode: "bonus", ...detail });
    window.localStorage.setItem(ANALYTICS_KEY, JSON.stringify(events.slice(-500)));
  } catch {
    // Bonus telemetry is advisory and must never interrupt play.
  }
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function glyphs(count) {
  const earned = Math.max(0, Math.min(3, Number(count) || 0));
  return `${"★".repeat(earned)}${"☆".repeat(3 - earned)}`;
}

function recallId(level) {
  return `recall-after-${level}`;
}

function shouldOfferRecall(level) {
  const value = performanceState();
  return QUICK_RECALL_AFTER_LEVELS.has(level) && !value.recallSeen[recallId(level)];
}

function markRecallSeen(level) {
  const value = performanceState();
  value.recallSeen[recallId(level)] = true;
  savePerformance(value);
}

function randomSequence(length) {
  const values = [];
  while (values.length < length) {
    const next = Math.floor(Math.random() * 6);
    if (values.length && values.at(-1) === next) continue;
    values.push(next);
  }
  return values;
}

function ensureRecallDialog() {
  let dialog = document.querySelector("#cascade-recall-dialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "cascade-recall-dialog";
  dialog.className = "cascade-recall-dialog";
  dialog.innerHTML = `
    <section class="cascade-recall-card">
      <small data-recall-kicker>QUICK RECALL</small>
      <h2 data-recall-title>Watch the sequence.</h2>
      <p data-recall-copy>Remember the tile order, then tap it back.</p>
      <div class="cascade-recall-stage" data-recall-stage aria-live="polite"></div>
      <div class="cascade-recall-progress" data-recall-progress></div>
      <div class="cascade-recall-choices" data-recall-choices hidden></div>
      <div class="cascade-recall-actions" data-recall-actions></div>
    </section>
  `;
  document.body.append(dialog);
  return dialog;
}

function tile(kind, interactive = false) {
  const element = document.createElement(interactive ? "button" : "div");
  if (interactive) element.type = "button";
  element.className = "cascade-tile cascade-recall-tile";
  element.dataset.kind = String(kind);
  element.setAttribute("aria-label", `Recall tile ${kind + 1}`);
  return element;
}

function setRecallActions(dialog, actions) {
  const container = dialog.querySelector("[data-recall-actions]");
  container.replaceChildren(...actions.map(({ label, primary, onClick }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    if (primary) button.classList.add("primary");
    button.addEventListener("click", onClick);
    return button;
  }));
}

function continueAfterRecall() {
  window.location.reload();
}

async function playRecallRound(dialog, roundIndex, sequence, totalRounds) {
  const title = dialog.querySelector("[data-recall-title]");
  const copy = dialog.querySelector("[data-recall-copy]");
  const stage = dialog.querySelector("[data-recall-stage]");
  const progress = dialog.querySelector("[data-recall-progress]");
  const choices = dialog.querySelector("[data-recall-choices]");
  const actions = dialog.querySelector("[data-recall-actions]");
  const pace = RECALL_PACE[roundIndex] || RECALL_PACE.at(-1);
  title.textContent = `Round ${roundIndex + 1} of ${totalRounds}`;
  copy.textContent = `Watch ${sequence.length} tiles, then repeat them in order. Your picks stay visible as you enter them.`;
  progress.textContent = "WATCH";
  choices.hidden = true;
  actions.replaceChildren();
  stage.replaceChildren();

  await sleep(pace.leadIn);
  for (const kind of sequence) {
    stage.replaceChildren(tile(kind));
    await sleep(pace.show);
    stage.replaceChildren();
    await sleep(pace.gap);
  }

  progress.textContent = `REPEAT · 0/${sequence.length}`;
  choices.hidden = false;
  choices.replaceChildren(...Array.from({ length: 6 }, (_, kind) => tile(kind, true)));
  stage.replaceChildren();

  return new Promise((resolve) => {
    const response = [];
    const clicks = [...choices.querySelectorAll("button")];
    const finish = () => {
      clicks.forEach((button) => { button.disabled = true; });
      const correct = response.reduce((sum, kind, index) => sum + Number(kind === sequence[index]), 0);
      const perfect = correct === sequence.length;
      progress.textContent = perfect ? "PERFECT" : `${correct}/${sequence.length} CORRECT`;
      stage.replaceChildren(...response.map((kind, index) => {
        const answer = tile(kind);
        answer.classList.add(kind === sequence[index] ? "is-recall-correct" : "is-recall-wrong");
        return answer;
      }));
      window.setTimeout(() => resolve({ correct, total: sequence.length, perfect }), 800);
    };
    clicks.forEach((button) => button.addEventListener("click", () => {
      if (response.length >= sequence.length) return;
      response.push(Number(button.dataset.kind));
      progress.textContent = `REPEAT · ${response.length}/${sequence.length}`;
      stage.replaceChildren(...response.map((kind) => {
        const answer = tile(kind);
        answer.classList.add("is-recall-entered");
        return answer;
      }));
      if (response.length === sequence.length) finish();
    }));
  });
}

async function runQuickRecall(level) {
  if (recallRun) return;
  const dialog = ensureRecallDialog();
  const id = recallId(level);
  markRecallSeen(level);
  recallRun = { id, level };
  track("quick_recall_start", { id, afterLevel: level });
  if (!dialog.open) dialog.showModal();

  let correct = 0;
  let total = 0;
  let perfectRounds = 0;
  const roundLengths = adaptiveRecallRounds();
  for (let index = 0; index < roundLengths.length; index += 1) {
    const sequence = randomSequence(roundLengths[index]);
    const result = await playRecallRound(dialog, index, sequence, roundLengths.length);
    correct += result.correct;
    total += result.total;
    perfectRounds += Number(result.perfect);
  }

  const accuracy = total ? correct / total : 0;
  const reward = awardRecallResult(id, { accuracy, correct, total, perfectRounds });
  track("quick_recall_complete", {
    id,
    afterLevel: level,
    accuracy,
    correct,
    total,
    perfectRounds,
    stars: reward.stars,
    bestStars: reward.bestStars,
  });

  dialog.querySelector("[data-recall-kicker]").textContent = "QUICK RECALL COMPLETE";
  dialog.querySelector("[data-recall-title]").textContent = `${Math.round(accuracy * 100)}% recalled`;
  dialog.querySelector("[data-recall-copy]").textContent = `${glyphs(reward.stars)} · ${correct}/${total} tiles · ${perfectRounds}/${roundLengths.length} perfect rounds${reward.claimed ? ` · +${reward.claimed} hammer earned` : ""}.`;
  dialog.querySelector("[data-recall-stage]").replaceChildren();
  dialog.querySelector("[data-recall-progress]").textContent = reward.best?.accuracy > accuracy
    ? `BEST ${Math.round(reward.best.accuracy * 100)}%`
    : "NEW BEST";
  dialog.querySelector("[data-recall-choices]").hidden = true;
  setRecallActions(dialog, [{ label: "Continue", primary: true, onClick: continueAfterRecall }]);
  recallRun = null;
}

function showRecallOffer(level, originalContinue) {
  const dialog = ensureRecallDialog();
  const id = recallId(level);
  const best = performanceState().recallBest[id];
  dialog.querySelector("[data-recall-kicker]").textContent = "BONUS ROUND";
  dialog.querySelector("[data-recall-title]").textContent = "Quick Recall?";
  dialog.querySelector("[data-recall-copy]").textContent = best
    ? `Three short memory rounds. Your current best is ${Math.round(Number(best.accuracy || 0) * 100)}%. Skip with no penalty.`
    : "Three short memory rounds using the same Cascade tiles. Skip with no penalty.";
  dialog.querySelector("[data-recall-stage]").replaceChildren();
  dialog.querySelector("[data-recall-progress]").textContent = "WATCH · HIDE · REPEAT";
  dialog.querySelector("[data-recall-choices]").hidden = true;
  setRecallActions(dialog, [
    {
      label: "Skip",
      primary: false,
      onClick: () => {
        markRecallSeen(level);
        track("quick_recall_skip", { id, afterLevel: level });
        dialog.close();
        continueBypass = true;
        originalContinue.click();
      },
    },
    {
      label: "PLAY QUICK RECALL",
      primary: true,
      onClick: () => {
        dialog.close();
        runQuickRecall(level);
      },
    },
  ]);
  if (resultDialog?.open) resultDialog.close();
  if (!dialog.open) dialog.showModal();
  track("quick_recall_offer", { id, afterLevel: level });
}

function interceptLevelContinue(event) {
  const button = event.target instanceof Element ? event.target.closest("#result-actions button") : null;
  if (!button || continueBypass) {
    continueBypass = false;
    return;
  }
  if (resultKicker?.textContent !== "LEVEL COMPLETE" || button.textContent !== "Continue") return;
  const level = Number(research?.exportLevel?.()?.level?.level) || 0;
  if (!shouldOfferRecall(level)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  showRecallOffer(level, button);
}

document.addEventListener("click", interceptLevelContinue, true);

function startOfUtcWeek(now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const distance = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - distance);
  return date;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function hash32(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function weeklyEvent(now = new Date()) {
  const starts = startOfUtcWeek(now);
  const ends = new Date(starts.getTime() + 7 * 24 * 60 * 60 * 1000);
  const week = isoDate(starts);
  const id = `${WEEKLY_RULESET}:${week}`;
  return Object.freeze({
    id,
    gameId: "cascade",
    modeId: WEEKLY_MODE_ID,
    ruleset: WEEKLY_RULESET,
    week,
    startsAt: starts.toISOString(),
    endsAt: ends.toISOString(),
    seed: hash32(id),
  });
}

function weeklyLabel(event) {
  const date = new Date(`${event.week}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

function ensureWeeklyCard() {
  if (!side) return null;
  let card = side.querySelector("#cascade-weekly-card");
  if (card) return card;
  const event = weeklyEvent();
  card = document.createElement("div");
  card.id = "cascade-weekly-card";
  card.className = "cascade-card cascade-weekly-card";
  card.innerHTML = `
    <small>WEEKLY BLITZ</small>
    <strong data-weekly-score>—</strong>
    <span data-weekly-copy>Week of ${weeklyLabel(event)} · same board seed for everyone.</span>
    <button type="button" data-weekly-start>Play weekly <b>30s</b></button>
    <a href="/leaderboard.html?game=cascade-weekly" data-weekly-leaderboard>View standings</a>
    <b class="cascade-weekly-status" data-weekly-status></b>
  `;
  card.querySelector("[data-weekly-start]").addEventListener("click", startWeeklyBlitz);
  side.append(card);
  return card;
}

function setWeeklyStatus(text) {
  const card = ensureWeeklyCard();
  if (card) card.querySelector("[data-weekly-status]").textContent = text;
}

function setWeeklyLocalBest(score) {
  const card = ensureWeeklyCard();
  if (!card) return;
  const best = Math.max(0, Number(window.localStorage.getItem(`scribbles-gameframe.cascade-weekly-best:${weeklyEvent().id}`)) || 0, Number(score) || 0);
  window.localStorage.setItem(`scribbles-gameframe.cascade-weekly-best:${weeklyEvent().id}`, String(best));
  card.querySelector("[data-weekly-score]").textContent = best ? best.toLocaleString() : "—";
}

function ensureIdentity() {
  if (!identityPromise) {
    const query = new URLSearchParams(window.location.search);
    identityPromise = establishGameFrameIdentity({ preferredDevelopmentPlayerId: query.get("player") });
  }
  return identityPromise;
}

async function submitWeeklyScore(event, scoreEvent) {
  if (weeklySubmissionPromise) return weeklySubmissionPromise;
  weeklySubmissionPromise = (async () => {
    try {
      setWeeklyStatus("Saving weekly score…");
      const identity = await ensureIdentity();
      const response = await gameFrameFetch("/api/scores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          gameId: event.gameId,
          modeId: event.modeId,
          eventId: event.id,
          score: Math.max(0, Math.floor(Number(scoreEvent.score) || 0)),
          metrics: {
            matches: Math.max(0, Math.floor(Number(scoreEvent.matches) || 0)),
            specials: Math.max(0, Math.floor(Number(scoreEvent.specials) || 0)),
            cascades: Math.max(0, Math.floor(Number(scoreEvent.cascades) || 0)),
          },
        }),
      }, identity);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Weekly score could not be saved.");
      const saved = Math.max(0, Number(body.entry?.score) || Number(scoreEvent.score) || 0);
      setWeeklyLocalBest(saved);
      setWeeklyStatus(body.improved ? "New weekly best saved." : `Weekly best ${saved.toLocaleString()}.`);
      if (resultCopy && resultKicker?.textContent === "BLITZ COMPLETE") {
        resultCopy.textContent = `${resultCopy.textContent} Weekly best: ${saved.toLocaleString()}.`;
      }
      track("weekly_blitz_submit", { eventId: event.id, score: Number(scoreEvent.score) || 0, saved, improved: Boolean(body.improved) });
      return body;
    } catch (error) {
      setWeeklyStatus("Score saved locally; shared standings unavailable.");
      track("weekly_blitz_submit_failed", { eventId: event.id, message: error instanceof Error ? error.message : "unknown" });
      return null;
    } finally {
      weeklySubmissionPromise = null;
    }
  })();
  return weeklySubmissionPromise;
}

function latestWeeklyBlitzComplete(startedAt) {
  const events = research?.exportEvents?.() || [];
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.type !== "blitz_complete") continue;
    if (event?.at && new Date(event.at).getTime() + 1000 < startedAt) continue;
    return event;
  }
  return null;
}

function installWeeklyReplayAction() {
  const actions = resultDialog?.querySelector("#result-actions");
  if (!actions) return;
  const again = [...actions.querySelectorAll("button")].find((button) => button.textContent === "Again");
  if (!again) return;
  const replay = again.cloneNode(true);
  replay.addEventListener("click", () => {
    resultDialog.close();
    startWeeklyBlitz();
  });
  again.replaceWith(replay);
}

function observeWeeklyCompletion() {
  if (!resultDialog) return;
  const observer = new MutationObserver(() => {
    if (!weeklyRun || !resultDialog.open || resultKicker?.textContent !== "BLITZ COMPLETE") return;
    const completed = latestWeeklyBlitzComplete(weeklyRun.startedAt);
    if (!completed) return;
    const event = weeklyRun.event;
    weeklyRun = null;
    const score = Math.max(0, Number(completed.score) || 0);
    setWeeklyLocalBest(score);
    installWeeklyReplayAction();
    submitWeeklyScore(event, completed);
  });
  observer.observe(resultDialog, { attributes: true, childList: true, subtree: true });
}

function startWeeklyBlitz() {
  if (!research?.startBlitz || weeklyRun) return;
  const event = weeklyEvent();
  weeklyRun = { event, startedAt: Date.now() };
  setWeeklyStatus(`Shared seed · week of ${weeklyLabel(event)}`);
  track("weekly_blitz_start", { eventId: event.id, seed: event.seed });
  const realNow = Date.now;
  try {
    Date.now = () => event.seed;
    research.startBlitz(WEEKLY_COMPLETED_LEVEL_SEED);
  } finally {
    Date.now = realNow;
  }
}

const weeklyCard = ensureWeeklyCard();
if (weeklyCard) {
  setWeeklyLocalBest(0);
  weeklyCard.querySelector("[data-weekly-leaderboard]").href = `/leaderboard.html?game=cascade-weekly&event=${encodeURIComponent(weeklyEvent().id)}`;
}
observeWeeklyCompletion();

window.cascadeBonusModes = Object.freeze({
  currentWeeklyEvent() {
    return { ...weeklyEvent() };
  },
  startWeeklyBlitz,
  startQuickRecall(afterLevel = 8) {
    const level = Math.max(1, Math.min(LEVEL_COUNT, Number(afterLevel) || 8));
    runQuickRecall(level);
  },
  exportRecall() {
    const value = performanceState();
    return { recallBest: structuredClone(value.recallBest), recallSeen: structuredClone(value.recallSeen) };
  },
});
