import { establishGameFrameIdentity, gameFrameFetch } from "./gameframe-auth.js";

const query = new URLSearchParams(window.location.search);
const identity = await establishGameFrameIdentity({
  preferredDevelopmentPlayerId: query.get("player"),
});
window.gameFrameIdentity = identity;
await import("./gameframe-nav.js");

const viewedPlayerId = query.get("view")?.trim() || identity.playerId;
const viewingOwnProfile = viewedPlayerId === identity.playerId;

const FAVORITE_GAMES = [
  { id: "cascade", name: "Cascade Crush", detail: "Match-3 puzzle", href: "/cascade.html" },
  { id: "othello", name: "Othello", detail: "Strategy board game", href: "/othello.html" },
  { id: "american-checkers", name: "Clockwork Checkers", detail: "Strategy board game", href: "/?game=american-checkers&menu=1" },
  { id: "tic-tac-toe", name: "Tic-Tac-Toe", detail: "Quick board game", href: "/?game=tic-tac-toe&menu=1" },
  { id: "monster-master-duel", name: "Monster Master Arena", detail: "Tactical battle", href: "/monster-master.html" },
  { id: "monster-master-rpg", name: "Monster Master RPG", detail: "Role-playing campaign", href: "/gameframe-rpg.html" },
];

const errorBox = document.querySelector("#profile-error");
const pageTitle = document.querySelector("#profile-page-title");
const pageDescription = document.querySelector("#profile-page-description");
const avatar = document.querySelector("#profile-avatar");
const avatarFallback = document.querySelector("#profile-avatar-fallback");
const name = document.querySelector("#profile-name");
const playerId = document.querySelector("#profile-id");
const source = document.querySelector("#profile-source");
const levelNumber = document.querySelector("#profile-level-number");
const xpTotal = document.querySelector("#profile-xp-total");
const xpFill = document.querySelector("#profile-xp-fill");
const levelProgress = document.querySelector("#profile-level-progress");
const levelNext = document.querySelector("#profile-level-next");
const cascadeStats = document.querySelector("#profile-cascade");
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
  if (gameId === "monster-master-duel") return "Monster Master Arena";
  if (gameId === "monster-master-rpg") return "Monster Master RPG";
  if (gameId === "cascade") return "Cascade Crush";
  return gameId;
}

function setupIdentity(profile) {
  const displayName = profile.displayName || "GameFrame Player";
  name.textContent = displayName;
  playerId.textContent = profile.playerId;
  source.textContent = profile.source === "discord" ? "DISCORD · GAMEFRAME PLAYER" : "LOCAL DEVELOPMENT PLAYER";
  if (!viewingOwnProfile) {
    pageTitle.textContent = displayName;
    pageDescription.textContent = "GameFrame level, progress, and shared game records.";
    document.title = `${displayName} · GameFrame`;
  }
  if (profile.avatarUrl) {
    avatar.src = profile.avatarUrl;
    avatar.hidden = false;
    avatarFallback.hidden = true;
  } else {
    avatar.hidden = true;
    avatarFallback.hidden = false;
    avatarFallback.textContent = displayName.slice(0, 2).toUpperCase();
    avatarFallback.style.display = "grid";
    avatarFallback.style.placeItems = "center";
    avatarFallback.style.fontWeight = "900";
  }
}

function renderProgression(progression) {
  const level = Math.max(1, Math.floor(Number(progression?.gamerLevel) || 1));
  const xp = Math.max(0, Math.floor(Number(progression?.gamerXp) || 0));
  const toNext = Math.max(0, Math.floor(Number(progression?.xpToNextLevel) || 0));
  const progress = Math.max(0, Math.min(1, Number(progression?.progress) || 0));
  levelNumber.textContent = String(level);
  xpTotal.textContent = `${xp.toLocaleString()} XP`;
  xpFill.style.width = `${(progress * 100).toFixed(2)}%`;
  levelProgress.textContent = `${Math.round(progress * 100)}% through level ${level}`;
  levelNext.textContent = `${toNext.toLocaleString()} XP to LV ${level + 1}`;
}

function renderCascade(progression) {
  const cascade = progression?.cascade || {};
  const highest = Math.max(0, Math.floor(Number(cascade.highestCompletedLevel) || 0));
  const stars = Math.max(0, Math.floor(Number(cascade.totalBestStars) || 0));
  const blitzEntries = Math.max(0, Math.floor(Number(cascade.weeklyBlitzEntries) || 0));
  const blitzBest = Math.max(0, Math.floor(Number(cascade.weeklyBlitzBestScore) || 0));
  cascadeStats.replaceChildren();
  const values = [
    ["LEVELS CLEARED", highest.toLocaleString(), highest ? `Next: ${highest + 1}` : "Start a run"],
    ["BEST STARS", stars.toLocaleString(), "Across normal levels"],
    ["WEEKLY BLITZ", blitzEntries.toLocaleString(), blitzBest ? `Best ${blitzBest.toLocaleString()}` : "No score yet"],
  ];
  for (const [label, value, detail] of values) {
    const card = document.createElement("article");
    card.className = "profile-highlight";
    card.innerHTML = `<small>${label}</small><strong>${value}</strong><span>${detail}</span>`;
    cascadeStats.append(card);
  }
}

function renderStats(gameRecords) {
  const records = gameRecords && typeof gameRecords === "object" ? Object.entries(gameRecords) : [];
  const completed = records.reduce((total, [, record]) => total + Math.max(0, Number(record?.played) || 0), 0);
  recordCount.textContent = `${completed} completed`;
  stats.replaceChildren();
  if (!records.length) {
    const empty = document.createElement("p");
    empty.className = "platform-empty";
    empty.textContent = "Complete a shared game and its lifetime record will appear here.";
    stats.append(empty);
    return;
  }
  for (const [gameId, record] of records) {
    const played = Math.max(0, Math.floor(Number(record?.played) || 0));
    const wins = Math.max(0, Math.floor(Number(record?.wins) || 0));
    const losses = Math.max(0, Math.floor(Number(record?.losses) || 0));
    const draws = Math.max(0, Math.floor(Number(record?.draws) || 0));
    if (!played) continue;
    const card = document.createElement("article");
    card.className = "profile-stat";
    const label = document.createElement("small");
    label.textContent = gameName(gameId);
    const total = document.createElement("strong");
    total.textContent = `${wins}–${losses}${draws ? `–${draws}` : ""}`;
    const detail = document.createElement("span");
    detail.textContent = `${played} played · ${wins} wins · ${losses} losses${draws ? ` · ${draws} draws` : ""}`;
    card.append(label, total, detail);
    stats.append(card);
  }
  if (!stats.children.length) {
    const empty = document.createElement("p");
    empty.className = "platform-empty";
    empty.textContent = "No shared game record yet.";
    stats.append(empty);
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
  if (preferencePending || !viewingOwnProfile) return;
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

async function loadOwnProfile() {
  const [feedResponse, progressionResponse] = await Promise.all([
    gameFrameFetch("/api/me/feed", {}, identity),
    gameFrameFetch("/api/me/progression", {}, identity),
  ]);
  const feed = await feedResponse.json().catch(() => ({}));
  const progression = await progressionResponse.json().catch(() => ({}));
  if (!feedResponse.ok) throw new Error(feed.message || "Player record could not be loaded.");
  if (!progressionResponse.ok) throw new Error(progression.message || "Gamer Level could not be loaded.");
  setupIdentity(identity);
  renderProgression(progression);
  renderCascade(progression);
  renderStats(progression.games);
  favoriteGameIds = Array.isArray(feed.favoriteGameIds) ? feed.favoriteGameIds : [];
  renderFavorites();
  renderActive(Array.isArray(feed.matches) ? feed.matches : []);
}

async function loadPublicProfile() {
  document.querySelectorAll("[data-private-profile]").forEach((section) => { section.hidden = true; });
  const response = await gameFrameFetch(`/api/players/${encodeURIComponent(viewedPlayerId)}/profile`, {}, identity);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Player profile could not be loaded.");
  setupIdentity(body.profile || { playerId: viewedPlayerId });
  renderProgression(body.progression || {});
  renderCascade(body.progression || {});
  renderStats(body.progression?.games || {});
}

try {
  if (viewingOwnProfile) await loadOwnProfile();
  else await loadPublicProfile();
} catch (error) {
  errorBox.hidden = false;
  errorBox.textContent = error instanceof Error ? error.message : "Profile data could not be loaded.";
}
