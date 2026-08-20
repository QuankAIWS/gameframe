import { establishGameFrameIdentity, gameFrameFetch } from "./gameframe-auth.js";

const query = new URLSearchParams(window.location.search);
const identity = await establishGameFrameIdentity({
  preferredDevelopmentPlayerId: query.get("player"),
});
window.gameFrameIdentity = identity;
await import("./gameframe-nav.js");

const errorBox = document.querySelector("#admin-error");
const statusBox = document.querySelector("#admin-status");
const playerSelect = document.querySelector("#admin-player");
const summary = document.querySelector("#admin-player-summary");
const records = document.querySelector("#admin-records");
const recordCount = document.querySelector("#admin-record-count");
const matches = document.querySelector("#admin-matches");
const matchCount = document.querySelector("#admin-match-count");
let selectedPlayerId = query.get("view")?.trim() || identity.playerId;
let voidingMatchId = null;

function gameName(gameId) {
  if (gameId === "othello") return "Othello";
  if (gameId === "american-checkers") return "Clockwork Checkers";
  if (gameId === "tic-tac-toe") return "Tic-Tac-Toe";
  if (gameId === "monster-master-duel") return "Monster Master Arena";
  if (gameId === "cascade") return "Cascade Crush";
  return gameId;
}

function empty(container, text) {
  const paragraph = document.createElement("p");
  paragraph.className = "platform-empty";
  paragraph.textContent = text;
  container.replaceChildren(paragraph);
}

function renderSummary(body) {
  const profile = body.profile || {};
  const progression = body.progression || {};
  const cascade = progression.cascade || {};
  summary.replaceChildren();
  const values = [
    ["PLAYER", profile.displayName || profile.playerId || selectedPlayerId, profile.playerId || selectedPlayerId],
    ["GAMER LEVEL", `LV ${Math.max(1, Number(progression.gamerLevel) || 1)}`, `${Math.max(0, Number(progression.gamerXp) || 0).toLocaleString()} XP`],
    ["CASCADE", `${Math.max(0, Number(cascade.highestCompletedLevel) || 0)} levels`, `${Math.max(0, Number(cascade.totalBestStars) || 0)} best stars`],
  ];
  for (const [label, value, detail] of values) {
    const card = document.createElement("article");
    card.className = "admin-summary-card";
    const small = document.createElement("small");
    small.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = value;
    const span = document.createElement("span");
    span.textContent = detail;
    card.append(small, strong, span);
    summary.append(card);
  }
}

function renderRecords(progression) {
  records.replaceChildren();
  const gameRecords = progression?.games && typeof progression.games === "object"
    ? Object.entries(progression.games)
    : [];
  const completed = gameRecords.reduce((total, [, value]) => total + Math.max(0, Number(value?.played) || 0), 0);
  recordCount.textContent = `${completed} completed`;
  for (const [gameId, record] of gameRecords) {
    const played = Math.max(0, Math.floor(Number(record?.played) || 0));
    if (!played) continue;
    const wins = Math.max(0, Math.floor(Number(record?.wins) || 0));
    const losses = Math.max(0, Math.floor(Number(record?.losses) || 0));
    const draws = Math.max(0, Math.floor(Number(record?.draws) || 0));
    const card = document.createElement("article");
    card.className = "admin-record-card";
    const label = document.createElement("small");
    label.textContent = gameName(gameId);
    const score = document.createElement("strong");
    score.textContent = `${wins}–${losses}${draws ? `–${draws}` : ""}`;
    const detail = document.createElement("span");
    detail.textContent = `${played} played · ${wins} wins · ${losses} losses${draws ? ` · ${draws} draws` : ""}`;
    card.append(label, score, detail);
    records.append(card);
  }
  if (!records.children.length) empty(records, "No completed shared-game record.");
}

function renderMatches(feed) {
  const entries = Array.isArray(feed?.matches) ? feed.matches : [];
  matchCount.textContent = `${entries.length} indexed`;
  matches.replaceChildren();
  if (!entries.length) {
    empty(matches, "No indexed matches for this player.");
    return;
  }
  for (const match of entries) {
    const row = document.createElement("article");
    row.className = `platform-row ${match.lifecycle === "active" ? "is-turn" : "is-complete"}`;
    const copy = document.createElement("div");
    copy.className = "platform-row-copy";
    const kicker = document.createElement("span");
    kicker.className = "platform-row-kicker";
    kicker.textContent = match.lifecycle === "active" ? "ACTIVE" : "COMPLETED";
    const title = document.createElement("strong");
    title.textContent = gameName(match.gameId);
    const detail = document.createElement("p");
    detail.textContent = match.lifecycle === "completed"
      ? match.draw
        ? `Draw · revision ${match.revision}`
        : match.winnerPlayerId === selectedPlayerId
          ? `Win · revision ${match.revision}`
          : `Loss · revision ${match.revision}`
      : `Revision ${match.revision} · ${match.activePlayerId === selectedPlayerId ? "player's turn" : "waiting"}`;
    copy.append(kicker, title, detail);

    const actions = document.createElement("div");
    actions.className = "platform-actions";
    const open = document.createElement("a");
    open.className = "platform-button";
    open.href = match.resumePath;
    open.textContent = "Inspect";
    const voidButton = document.createElement("button");
    voidButton.type = "button";
    voidButton.className = "platform-button admin-danger";
    voidButton.disabled = voidingMatchId !== null;
    voidButton.textContent = voidingMatchId === match.matchId ? "Voiding…" : "Void test match";
    voidButton.addEventListener("click", () => void voidMatch(match));
    actions.append(open, voidButton);
    row.append(copy, actions);
    matches.append(row);
  }
}

async function voidMatch(match) {
  if (voidingMatchId) return;
  const warning = match.lifecycle === "completed"
    ? "This removes the match from both players and reverses the W/L and Gamer XP awarded by this match."
    : "This removes the open match from both players without awarding a win or loss.";
  if (!window.confirm(`Void this ${gameName(match.gameId)} test match? ${warning}`)) return;
  voidingMatchId = match.matchId;
  statusBox.textContent = `Voiding ${gameName(match.gameId)}…`;
  try {
    const response = await gameFrameFetch(`/api/admin/matches/${encodeURIComponent(match.matchId)}/void`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }, identity);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || `Void failed with ${response.status}.`);
    statusBox.textContent = "Test match voided. Player records were recalculated from that match contribution.";
    voidingMatchId = null;
    await loadPlayer();
  } catch (error) {
    voidingMatchId = null;
    errorBox.hidden = false;
    errorBox.textContent = error instanceof Error ? error.message : "The test match could not be voided.";
    await loadPlayer();
  }
}

async function loadPlayer() {
  errorBox.hidden = true;
  const response = await gameFrameFetch(`/api/admin/players/${encodeURIComponent(selectedPlayerId)}`, {}, identity);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Administrator player data could not be loaded.");
  renderSummary(body);
  renderRecords(body.progression || {});
  renderMatches(body.feed || {});
}

async function loadPlayers() {
  const response = await gameFrameFetch("/api/players", {}, identity);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Player directory could not be loaded.");
  const candidates = [
    { playerId: identity.playerId, displayName: identity.displayName || "You" },
    ...(Array.isArray(body.players) ? body.players : []),
  ];
  const unique = [...new Map(candidates.map((player) => [player.playerId, player])).values()];
  playerSelect.replaceChildren(...unique.map((player) => {
    const option = document.createElement("option");
    option.value = player.playerId;
    option.textContent = player.playerId === identity.playerId
      ? `${player.displayName || "You"} (you)`
      : player.displayName || player.playerId;
    return option;
  }));
  if (!unique.some((player) => player.playerId === selectedPlayerId)) selectedPlayerId = identity.playerId;
  playerSelect.value = selectedPlayerId;
}

if (!identity.admin) {
  errorBox.hidden = false;
  errorBox.textContent = "This account does not have GameFrame administrator authority.";
  summary.replaceChildren();
  records.replaceChildren();
  matches.replaceChildren();
  playerSelect.disabled = true;
} else {
  try {
    await loadPlayers();
    await loadPlayer();
  } catch (error) {
    errorBox.hidden = false;
    errorBox.textContent = error instanceof Error ? error.message : "GameFrame admin could not be loaded.";
  }

  playerSelect.addEventListener("change", async () => {
    selectedPlayerId = playerSelect.value;
    const url = new URL(window.location.href);
    url.searchParams.set("view", selectedPlayerId);
    history.replaceState(null, "", url);
    statusBox.textContent = "";
    try {
      await loadPlayer();
    } catch (error) {
      errorBox.hidden = false;
      errorBox.textContent = error instanceof Error ? error.message : "Player data could not be loaded.";
    }
  });
}
