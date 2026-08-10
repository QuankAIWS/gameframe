import { establishGameFrameIdentity, gameFrameFetch } from "./gameframe-auth.js";

const query = new URLSearchParams(window.location.search);
const identity = await establishGameFrameIdentity({
  preferredDevelopmentPlayerId: query.get("player"),
});
window.gameFrameIdentity = identity;
await import("./gameframe-nav.js");

const FAVORITE_GAMES = [
  { id: "cascade", name: "Cascade", detail: "Match-3 puzzle", href: "/cascade.html" },
  { id: "othello", name: "Othello", detail: "Strategy board game", href: "/othello.html" },
  { id: "american-checkers", name: "Clockwork Checkers", detail: "Strategy board game", href: "/?game=american-checkers&menu=1" },
  { id: "tic-tac-toe", name: "Tic-Tac-Toe", detail: "Quick board game", href: "/?game=tic-tac-toe&menu=1" },
  { id: "monster-master-duel", name: "Monster Master Arena", detail: "Tactical battle", href: "/monster-master.html" },
  { id: "monster-master-rpg", name: "Monster Master RPG", detail: "Role-playing campaign", href: "/gameframe-rpg.html" },
];

const errorBox = document.querySelector("#profile-error");
const avatar = document.querySelector("#profile-avatar");
const avatarFallback = document.querySelector("#profile-avatar-fallback");
const name = document.querySelector("#profile-name");
const playerId = document.querySelector("#profile-id");
const source = document.querySelector("#profile-source");
const favorites = document.querySelector("#profile-favorites");
const favoritesCount = document.querySelector("#profile-favorites-count");
const favoritesStatus = document.querySelector("#profile-favorites-status");
const stats = document.querySelector("#profile-stats");
const recordCount = document.querySelector("#profile-record-count");
const activeList = document.querySelector("#profile-active");
const activeCount = document.querySelector("#profile-active-count");
let favoriteGameIds = [];
let preferencePending = false;

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

function renderFavorites() {
  const selected = new Set(favoriteGameIds);
  favoritesCount.textContent = String(selected.size);
  favorites.replaceChildren();
  for (const game of FAVORITE_GAMES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `profile-favorite${selected.has(game.id) ? " is-favorite" : ""}`;
    button.dataset.favoriteGameId = game.id;
    button.setAttribute("aria-pressed", String(selected.has(game.id)));
    button.innerHTML = `<span class="profile-favorite-star" aria-hidden="true">${selected.has(game.id) ? "★" : "☆"}</span><span><strong>${game.name}</strong><small>${game.detail}</small></span>`;
    button.addEventListener("click", () => void toggleFavorite(game.id));
    favorites.append(button);
  }
}

async function toggleFavorite(gameId) {
  if (preferencePending) return;
  preferencePending = true;
  favoritesStatus.textContent = "Saving favorites…";
  const selected = new Set(favoriteGameIds);
  if (selected.has(gameId)) selected.delete(gameId);
  else selected.add(gameId);
  try {
    const response = await gameFrameFetch("/api/me/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ favoriteGameIds: [...selected] }),
    }, identity);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || "Favorites could not be saved.");
    favoriteGameIds = Array.isArray(body.favoriteGameIds) ? body.favoriteGameIds : [];
    renderFavorites();
    favoritesStatus.textContent = "Favorites saved.";
  } catch (error) {
    favoritesStatus.textContent = error instanceof Error ? error.message : "Favorites could not be saved.";
  } finally {
    preferencePending = false;
  }
}

async function refresh() {
  try {
    const response = await gameFrameFetch("/api/me/feed", {}, identity);
    const feed = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(feed.message || "Player record could not be loaded.");
    const matches = Array.isArray(feed.matches) ? feed.matches : [];
    favoriteGameIds = Array.isArray(feed.favoriteGameIds) ? feed.favoriteGameIds : [];
    renderFavorites();
    renderStats(matches);
    renderActive(matches);
  } catch (error) {
    errorBox.hidden = false;
    errorBox.textContent = error instanceof Error ? error.message : "Profile data could not be loaded.";
  }
}

setupIdentity();
await refresh();
