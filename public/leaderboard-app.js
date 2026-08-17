import { establishGameFrameIdentity, gameFrameFetch } from "./gameframe-auth.js";

const query = new URLSearchParams(window.location.search);
const identity = await establishGameFrameIdentity({
  preferredDevelopmentPlayerId: query.get("player"),
  allowOfflineCachedIdentity: true,
});
window.gameFrameIdentity = identity;
window.gameFrameOffline = identity?.offline === true || navigator.onLine === false;
await import("./gameframe-nav.js");

const LEADERBOARD_SNAPSHOT_KEY = "scribbles-gameframe.leaderboard-snapshot:v1";
const errorBox = document.querySelector("#leaderboard-error");
const gameSelect = document.querySelector("#leaderboard-game");
const rule = document.querySelector("#leaderboard-rule");
const list = document.querySelector("#leaderboard-list");
const podium = document.querySelector("#hall-podium");
const categories = document.querySelector("#hall-categories");
let boards = [];
let gamerLevels = [];

function gameName(gameId) {
  if (gameId === "othello") return "Othello";
  if (gameId === "american-checkers") return "Clockwork Checkers";
  if (gameId === "tic-tac-toe") return "Tic-Tac-Toe";
  if (gameId === "cascade") return "Cascade Crush";
  return gameId;
}

function scoredModeName(modeId) {
  if (modeId === "weekly-blitz") return "Weekly Blitz";
  return modeId;
}

function eventDateLabel(eventId) {
  const match = String(eventId).match(/(\d{4}-\d{2}-\d{2})$/);
  if (!match) return eventId;
  const date = new Date(`${match[1]}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return eventId;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

function boardValue(board) {
  if (board.kind === "gamer") return "gamer|level";
  return board.kind === "score"
    ? `score|${board.gameId}|${board.modeId}|${encodeURIComponent(board.eventId)}`
    : `board|${board.gameId}`;
}

function boardLabel(board) {
  if (board.kind === "gamer") return "Gamer Level";
  if (board.kind === "score") {
    return `${gameName(board.gameId)} · ${scoredModeName(board.modeId)} · ${eventDateLabel(board.eventId)}`;
  }
  return gameName(board.gameId);
}

function selectedBoard() {
  return boards.find((candidate) => boardValue(candidate) === gameSelect.value) ?? boards[0];
}

function profileHref(playerId) {
  return `/profile.html?view=${encodeURIComponent(playerId)}`;
}

function avatarFor(entry, className = "leaderboard-avatar-fallback") {
  if (entry.avatarUrl && !window.gameFrameOffline) {
    const avatar = document.createElement("img");
    avatar.src = entry.avatarUrl;
    avatar.alt = "";
    return avatar;
  }
  const avatar = document.createElement("span");
  avatar.className = className;
  avatar.textContent = String(entry.displayName || "GF").slice(0, 2).toUpperCase();
  return avatar;
}

function playerCell(entry) {
  const player = document.createElement(window.gameFrameOffline ? "div" : "a");
  player.className = "leaderboard-player";
  if (!window.gameFrameOffline) player.href = profileHref(entry.playerId);
  const avatar = avatarFor(entry);
  player.append(avatar);
  const copy = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = entry.playerId === identity.playerId ? `${entry.displayName || "You"} · You` : entry.displayName || "GameFrame Player";
  const detail = document.createElement("span");
  copy.append(name, detail);
  player.append(copy);
  return { player, detail };
}

function renderGamerLevel(board) {
  rule.textContent = "Gamer Level · activity and accomplishments across GameFrame";
  if (!Array.isArray(board.entries) || !board.entries.length) return false;
  board.entries.forEach((entry, index) => {
    const row = document.createElement("article");
    row.className = `leaderboard-row gamer-level-row${entry.playerId === identity.playerId ? " is-you" : ""}`;
    const rank = document.createElement("strong");
    rank.className = "leaderboard-rank";
    rank.textContent = String(index + 1);
    const { player, detail } = playerCell(entry);
    detail.textContent = `${Math.max(0, Number(entry.gamerXp) || 0).toLocaleString()} XP · ${Math.max(0, Number(entry.xpToNextLevel) || 0).toLocaleString()} to next level`;
    const level = document.createElement("div");
    level.className = "leaderboard-points gamer-level-value";
    level.innerHTML = `<strong>${Math.max(1, Math.floor(Number(entry.gamerLevel) || 1))}</strong><span>LEVEL</span>`;
    row.append(rank, player, level);
    list.append(row);
  });
  return true;
}

function renderBoardGame(board) {
  rule.textContent = "3 points per win · 1 per draw";
  if (!Array.isArray(board.entries) || !board.entries.length) return false;
  board.entries.forEach((entry, index) => {
    const row = document.createElement("article");
    row.className = `leaderboard-row${entry.playerId === identity.playerId ? " is-you" : ""}`;
    const rank = document.createElement("strong");
    rank.className = "leaderboard-rank";
    rank.textContent = String(index + 1);
    const { player, detail } = playerCell(entry);
    detail.textContent = `${entry.wins}W · ${entry.losses}L${entry.draws ? ` · ${entry.draws}D` : ""} · ${entry.played} played`;
    const points = document.createElement("div");
    points.className = "leaderboard-points";
    points.innerHTML = `<strong>${entry.points}</strong><span>PTS</span>`;
    row.append(rank, player, points);
    list.append(row);
  });
  return true;
}

function renderScoredGame(board) {
  rule.textContent = board.modeId === "weekly-blitz"
    ? `Best score per player · shared seed · week of ${eventDateLabel(board.eventId)}`
    : "Best score per player";
  if (!Array.isArray(board.entries) || !board.entries.length) return false;
  board.entries.forEach((entry, index) => {
    const row = document.createElement("article");
    row.className = `leaderboard-row${entry.playerId === identity.playerId ? " is-you" : ""}`;
    const rank = document.createElement("strong");
    rank.className = "leaderboard-rank";
    rank.textContent = String(index + 1);
    const { player, detail } = playerCell(entry);
    const metrics = entry.metrics && typeof entry.metrics === "object" ? entry.metrics : {};
    const parts = [];
    if (Number.isFinite(Number(metrics.matches))) parts.push(`${Math.floor(Number(metrics.matches))} match groups`);
    if (Number.isFinite(Number(metrics.specials))) parts.push(`${Math.floor(Number(metrics.specials))} specials`);
    detail.textContent = parts.length ? parts.join(" · ") : "Best submitted score";
    const score = document.createElement("div");
    score.className = "leaderboard-points";
    score.innerHTML = `<strong>${Math.max(0, Number(entry.score) || 0).toLocaleString()}</strong><span>SCORE</span>`;
    row.append(rank, player, score);
    list.append(row);
  });
  return true;
}

function render() {
  const board = selectedBoard();
  list.replaceChildren();
  if (!board) {
    rule.textContent = "GameFrame standings";
    const empty = document.createElement("p");
    empty.className = "platform-empty";
    empty.textContent = "No shared results yet.";
    list.append(empty);
    return;
  }

  const rendered = board.kind === "gamer"
    ? renderGamerLevel(board)
    : board.kind === "score"
      ? renderScoredGame(board)
      : renderBoardGame(board);
  if (rendered) return;
  const empty = document.createElement("p");
  empty.className = "platform-empty";
  empty.textContent = board.kind === "score" ? "No scores have been submitted for this event yet." : "No completed shared results yet.";
  list.append(empty);
}

function podiumCard(entry, rank) {
  const link = document.createElement(window.gameFrameOffline ? "article" : "a");
  if (!window.gameFrameOffline) link.href = profileHref(entry.playerId);
  link.className = `hall-podium-card hall-rank-${rank}${entry.playerId === identity.playerId ? " is-you" : ""}`;
  link.append(avatarFor(entry, "hall-avatar-fallback"));
  const copy = document.createElement("div");
  const rankLabel = document.createElement("small");
  rankLabel.textContent = rank === 1 ? "#1 GAMER" : `#${rank}`;
  const playerName = document.createElement("strong");
  playerName.textContent = entry.playerId === identity.playerId ? `${entry.displayName || "You"} · You` : entry.displayName || "GameFrame Player";
  const level = document.createElement("span");
  level.innerHTML = `LV <b>${Math.max(1, Math.floor(Number(entry.gamerLevel) || 1))}</b> · ${Math.max(0, Number(entry.gamerXp) || 0).toLocaleString()} XP`;
  copy.append(rankLabel, playerName, level);
  link.append(copy);
  return link;
}

function categoryCard(title, entries, valueFor, detailFor) {
  if (!entries.length) return null;
  const winner = entries[0];
  const value = valueFor(winner);
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) return null;
  const card = document.createElement(window.gameFrameOffline ? "article" : "a");
  card.className = "hall-category-card";
  if (!window.gameFrameOffline) card.href = profileHref(winner.playerId);
  card.innerHTML = `
    <small>${title}</small>
    <strong>${Number(value).toLocaleString()}</strong>
    <span>${winner.displayName || "GameFrame Player"}</span>
    <b>${detailFor(winner)}</b>
  `;
  return card;
}

function renderHallOverview() {
  podium.replaceChildren();
  const leaders = gamerLevels.slice(0, 3);
  if (!leaders.length) {
    const empty = document.createElement("p");
    empty.className = "platform-empty";
    empty.textContent = "No ranked players yet.";
    podium.append(empty);
  } else {
    leaders.forEach((entry, index) => podium.append(podiumCard(entry, index + 1)));
  }

  categories.replaceChildren();
  const byCascadeLevels = gamerLevels
    .filter((entry) => Number(entry.cascade?.highestCompletedLevel) > 0)
    .slice()
    .sort((a, b) => Number(b.cascade?.highestCompletedLevel || 0) - Number(a.cascade?.highestCompletedLevel || 0) || Number(b.gamerXp || 0) - Number(a.gamerXp || 0));
  const byCascadeStars = gamerLevels
    .filter((entry) => Number(entry.cascade?.totalBestStars) > 0)
    .slice()
    .sort((a, b) => Number(b.cascade?.totalBestStars || 0) - Number(a.cascade?.totalBestStars || 0) || Number(b.gamerXp || 0) - Number(a.gamerXp || 0));
  const byBlitzBest = gamerLevels
    .filter((entry) => Number(entry.cascade?.weeklyBlitzBestScore) > 0)
    .slice()
    .sort((a, b) => Number(b.cascade?.weeklyBlitzBestScore || 0) - Number(a.cascade?.weeklyBlitzBestScore || 0));
  const cards = [
    categoryCard("CASCADE PROGRESS", byCascadeLevels, (entry) => entry.cascade.highestCompletedLevel, () => "levels cleared"),
    categoryCard("CASCADE STARS", byCascadeStars, (entry) => entry.cascade.totalBestStars, () => "best stars"),
    categoryCard("BLITZ PERSONAL BEST", byBlitzBest, (entry) => entry.cascade.weeklyBlitzBestScore, () => "points"),
  ].filter(Boolean);
  cards.forEach((card) => categories.append(card));
  categories.hidden = !cards.length;
}

function requestedWeeklyEventBoard() {
  if (query.get("game") !== "cascade-weekly") return null;
  const eventId = query.get("event")?.trim();
  if (!eventId) return null;
  return {
    kind: "score",
    gameId: "cascade",
    modeId: "weekly-blitz",
    eventId,
    entries: [],
  };
}

function preferredBoardValue() {
  const requested = query.get("game");
  if (requested === "cascade-weekly") {
    const requestedEvent = query.get("event");
    const candidate = boards.find((board) => (
      board.kind === "score"
      && board.gameId === "cascade"
      && board.modeId === "weekly-blitz"
      && (!requestedEvent || board.eventId === requestedEvent)
    ));
    if (candidate) return boardValue(candidate);
  }
  if (requested) {
    const candidate = boards.find((board) => board.gameId === requested);
    if (candidate) return boardValue(candidate);
  }
  return "gamer|level";
}

function readSnapshot() {
  try {
    const snapshot = JSON.parse(localStorage.getItem(LEADERBOARD_SNAPSHOT_KEY) || "null");
    if (!snapshot || snapshot.version !== 1 || !snapshot.body || typeof snapshot.body !== "object") return null;
    if (snapshot.playerId && snapshot.playerId !== identity.playerId) return null;
    return snapshot;
  } catch {
    return null;
  }
}

function writeSnapshot(body) {
  try {
    localStorage.setItem(LEADERBOARD_SNAPSHOT_KEY, JSON.stringify({
      version: 1,
      playerId: identity.playerId,
      updatedAt: Date.now(),
      body,
    }));
  } catch {
    // The live leaderboard is still usable if local snapshot storage is unavailable.
  }
}

function applyLeaderboardBody(body) {
  gamerLevels = Array.isArray(body.gamerLevels) ? body.gamerLevels : [];
  const boardGames = Array.isArray(body.games) ? body.games.map((game) => ({ ...game, kind: "board" })) : [];
  const scoredGames = Array.isArray(body.scoredGames) ? body.scoredGames.map((game) => ({ ...game, kind: "score" })) : [];
  const requestedWeekly = requestedWeeklyEventBoard();
  if (requestedWeekly && !scoredGames.some((game) => (
    game.gameId === requestedWeekly.gameId
    && game.modeId === requestedWeekly.modeId
    && game.eventId === requestedWeekly.eventId
  ))) {
    scoredGames.unshift(requestedWeekly);
  }
  boards = [{ kind: "gamer", entries: gamerLevels }, ...scoredGames, ...boardGames];
  gameSelect.replaceChildren();
  for (const board of boards) {
    const option = document.createElement("option");
    option.value = boardValue(board);
    option.textContent = boardLabel(board);
    gameSelect.append(option);
  }
  const preferred = preferredBoardValue();
  if (boards.some((board) => boardValue(board) === preferred)) gameSelect.value = preferred;
  renderHallOverview();
  render();
}

function showSnapshotNotice(updatedAt) {
  window.gameFrameOffline = true;
  document.body.dataset.gameframeConnectivity = "offline";
  const date = new Date(Number(updatedAt) || 0);
  const stamp = Number.isNaN(date.getTime()) || !Number(updatedAt)
    ? "an earlier session"
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  errorBox.hidden = false;
  errorBox.dataset.offlineSnapshot = "true";
  errorBox.textContent = `Offline · showing the last leaderboard saved ${stamp}.`;
}

async function refresh() {
  const snapshot = readSnapshot();
  if (identity.offline || navigator.onLine === false) {
    if (snapshot) {
      applyLeaderboardBody(snapshot.body);
      showSnapshotNotice(snapshot.updatedAt);
      return;
    }
    errorBox.hidden = false;
    errorBox.textContent = "Leaderboard unavailable offline until it has been loaded online at least once.";
    podium.replaceChildren();
    categories.replaceChildren();
    list.replaceChildren();
    const empty = document.createElement("p");
    empty.className = "platform-empty";
    empty.textContent = "No cached standings are available on this device.";
    list.append(empty);
    return;
  }

  try {
    const response = await gameFrameFetch("/api/leaderboard", {}, identity);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || "Leaderboard could not be loaded.");
    window.gameFrameOffline = false;
    delete errorBox.dataset.offlineSnapshot;
    errorBox.hidden = true;
    applyLeaderboardBody(body);
    writeSnapshot(body);
  } catch (error) {
    if (snapshot) {
      applyLeaderboardBody(snapshot.body);
      showSnapshotNotice(snapshot.updatedAt);
      return;
    }
    errorBox.hidden = false;
    errorBox.textContent = error instanceof Error ? error.message : "Leaderboard could not be loaded.";
    podium.replaceChildren();
    categories.replaceChildren();
    list.replaceChildren();
    const empty = document.createElement("p");
    empty.className = "platform-empty";
    empty.textContent = "Standings are unavailable.";
    list.append(empty);
  }
}

gameSelect.addEventListener("change", render);
await refresh();
