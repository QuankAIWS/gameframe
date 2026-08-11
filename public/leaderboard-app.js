import { establishGameFrameIdentity, gameFrameFetch } from "./gameframe-auth.js";

const query = new URLSearchParams(window.location.search);
const identity = await establishGameFrameIdentity({
  preferredDevelopmentPlayerId: query.get("player"),
});
window.gameFrameIdentity = identity;
await import("./gameframe-nav.js");

const errorBox = document.querySelector("#leaderboard-error");
const gameSelect = document.querySelector("#leaderboard-game");
const rule = document.querySelector("#leaderboard-rule");
const list = document.querySelector("#leaderboard-list");
let boards = [];

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
  return board.kind === "score"
    ? `score|${board.gameId}|${board.modeId}|${encodeURIComponent(board.eventId)}`
    : `board|${board.gameId}`;
}

function boardLabel(board) {
  if (board.kind === "score") {
    return `${gameName(board.gameId)} · ${scoredModeName(board.modeId)} · ${eventDateLabel(board.eventId)}`;
  }
  return gameName(board.gameId);
}

function selectedBoard() {
  return boards.find((candidate) => boardValue(candidate) === gameSelect.value) ?? boards[0];
}

function playerCell(entry) {
  const player = document.createElement("div");
  player.className = "leaderboard-player";
  if (entry.avatarUrl) {
    const avatar = document.createElement("img");
    avatar.src = entry.avatarUrl;
    avatar.alt = "";
    player.append(avatar);
  } else {
    const avatar = document.createElement("span");
    avatar.className = "leaderboard-avatar-fallback";
    avatar.textContent = String(entry.displayName || "GF").slice(0, 2).toUpperCase();
    player.append(avatar);
  }
  const copy = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = entry.playerId === identity.playerId ? `${entry.displayName || "You"} · You` : entry.displayName || "GameFrame Player";
  const detail = document.createElement("span");
  copy.append(name, detail);
  player.append(copy);
  return { player, detail };
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

  const rendered = board.kind === "score" ? renderScoredGame(board) : renderBoardGame(board);
  if (rendered) return;
  const empty = document.createElement("p");
  empty.className = "platform-empty";
  empty.textContent = board.kind === "score" ? "No scores have been submitted for this event yet." : "No completed shared board-game results yet.";
  list.append(empty);
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
  return null;
}

async function refresh() {
  try {
    const response = await gameFrameFetch("/api/leaderboard", {}, identity);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || "Leaderboard could not be loaded.");
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
    boards = [...scoredGames, ...boardGames];
    gameSelect.replaceChildren();
    if (!boards.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No results yet";
      gameSelect.append(option);
    } else {
      for (const board of boards) {
        const option = document.createElement("option");
        option.value = boardValue(board);
        option.textContent = boardLabel(board);
        gameSelect.append(option);
      }
      const preferred = preferredBoardValue();
      if (preferred) gameSelect.value = preferred;
    }
    render();
  } catch (error) {
    errorBox.hidden = false;
    errorBox.textContent = error instanceof Error ? error.message : "Leaderboard could not be loaded.";
    list.replaceChildren();
    const empty = document.createElement("p");
    empty.className = "platform-empty";
    empty.textContent = "Standings are unavailable.";
    list.append(empty);
  }
}

gameSelect.addEventListener("change", render);
await refresh();