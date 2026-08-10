import { establishGameFrameIdentity, gameFrameFetch } from "./gameframe-auth.js";

const identity = await establishGameFrameIdentity();
window.gameFrameIdentity = identity;
await import("./gameframe-nav.js");

const errorBox = document.querySelector("#profile-error");
const avatar = document.querySelector("#profile-avatar");
const avatarFallback = document.querySelector("#profile-avatar-fallback");
const name = document.querySelector("#profile-name");
const playerId = document.querySelector("#profile-id");
const source = document.querySelector("#profile-source");
const stats = document.querySelector("#profile-stats");
const recordCount = document.querySelector("#profile-record-count");
const activeList = document.querySelector("#profile-active");
const activeCount = document.querySelector("#profile-active-count");

function gameName(gameId) {
  if (gameId === "othello") return "Othello";
  if (gameId === "american-checkers") return "Clockwork Checkers";
  if (gameId === "tic-tac-toe") return "Tic-Tac-Toe";
  return gameId;
}

function setupIdentity() {
  name.textContent = identity.displayName || "GameFrame Player";
  playerId.textContent = identity.playerId;
  source.textContent = identity.source === "discord" ? "DISCORD · GAMEFRAME PLAYER" : "LOCAL DEVELOPMENT PLAYER";
  if (identity.avatarUrl) {
    avatar.src = identity.avatarUrl;
    avatar.hidden = false;
    avatarFallback.hidden = true;
  } else {
    avatarFallback.textContent = (identity.displayName || "GF").slice(0, 2).toUpperCase();
    avatarFallback.style.display = "grid";
    avatarFallback.style.placeItems = "center";
    avatarFallback.style.fontWeight = "900";
  }
}

function recordByGame(matches) {
  const result = new Map();
  for (const match of matches.filter((candidate) => candidate.lifecycle === "completed")) {
    const record = result.get(match.gameId) || { played: 0, wins: 0, losses: 0, draws: 0 };
    record.played += 1;
    if (match.draw) record.draws += 1;
    else if (match.winnerPlayerId === identity.playerId) record.wins += 1;
    else record.losses += 1;
    result.set(match.gameId, record);
  }
  return result;
}

function renderStats(matches) {
  const records = recordByGame(matches);
  const completed = matches.filter((match) => match.lifecycle === "completed").length;
  recordCount.textContent = `${completed} completed`;
  stats.replaceChildren();
  if (!records.size) {
    const empty = document.createElement("p");
    empty.className = "platform-empty";
    empty.textContent = "Complete a shared board game and its record will appear here.";
    stats.append(empty);
    return;
  }
  for (const [gameId, record] of records) {
    const card = document.createElement("article");
    card.className = "profile-stat";
    const label = document.createElement("small");
    label.textContent = gameName(gameId);
    const total = document.createElement("strong");
    total.textContent = `${record.wins}–${record.losses}${record.draws ? `–${record.draws}` : ""}`;
    const detail = document.createElement("span");
    detail.textContent = `${record.played} played · ${record.wins} wins · ${record.losses} losses${record.draws ? ` · ${record.draws} draws` : ""}`;
    detail.style.color = "var(--platform-muted)";
    detail.style.fontSize = ".76rem";
    card.append(label, total, detail);
    stats.append(card);
  }
}

function renderActive(matches) {
  const active = matches.filter((match) => match.lifecycle === "active");
  activeCount.textContent = String(active.length);
  activeList.replaceChildren();
  if (!active.length) {
    const empty = document.createElement("p");
    empty.className = "platform-empty";
    empty.textContent = "No open board-game matches.";
    activeList.append(empty);
    return;
  }
  for (const match of active) {
    const row = document.createElement("article");
    row.className = `platform-row ${match.activePlayerId === identity.playerId ? "is-turn" : ""}`;
    const copy = document.createElement("div");
    copy.className = "platform-row-copy";
    const kicker = document.createElement("span");
    kicker.className = "platform-row-kicker";
    kicker.textContent = match.activePlayerId === identity.playerId ? "YOUR TURN" : "WAITING";
    const title = document.createElement("strong");
    title.textContent = gameName(match.gameId);
    const detail = document.createElement("p");
    detail.textContent = `Revision ${match.revision}`;
    copy.append(kicker, title, detail);
    const actions = document.createElement("div");
    actions.className = "platform-actions";
    const link = document.createElement("a");
    link.className = `platform-button ${match.activePlayerId === identity.playerId ? "primary" : ""}`;
    link.href = match.resumePath;
    link.textContent = "Open";
    actions.append(link);
    row.append(copy, actions);
    activeList.append(row);
  }
}

async function refresh() {
  try {
    const response = await gameFrameFetch("/api/me/feed", {}, identity);
    const feed = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(feed.message || "Player record could not be loaded.");
    const matches = Array.isArray(feed.matches) ? feed.matches : [];
    renderStats(matches);
    renderActive(matches);
  } catch (error) {
    errorBox.hidden = false;
    errorBox.textContent = error instanceof Error ? error.message : "Profile data could not be loaded.";
  }
}

setupIdentity();
await refresh();
