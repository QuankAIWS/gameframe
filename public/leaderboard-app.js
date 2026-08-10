import { establishGameFrameIdentity, gameFrameFetch } from "./gameframe-auth.js";

const query = new URLSearchParams(window.location.search);
const identity = await establishGameFrameIdentity({
  preferredDevelopmentPlayerId: query.get("player"),
});
window.gameFrameIdentity = identity;
await import("./gameframe-nav.js");

const errorBox = document.querySelector("#leaderboard-error");
const gameSelect = document.querySelector("#leaderboard-game");
const list = document.querySelector("#leaderboard-list");
let games = [];

function gameName(gameId) {
  if (gameId === "othello") return "Othello";
  if (gameId === "american-checkers") return "Clockwork Checkers";
  if (gameId === "tic-tac-toe") return "Tic-Tac-Toe";
  return gameId;
}

function render() {
  const game = games.find((candidate) => candidate.gameId === gameSelect.value) ?? games[0];
  list.replaceChildren();
  if (!game || !Array.isArray(game.entries) || !game.entries.length) {
    const empty = document.createElement("p");
    empty.className = "platform-empty";
    empty.textContent = "No completed shared board-game results yet.";
    list.append(empty);
    return;
  }

  game.entries.forEach((entry, index) => {
    const row = document.createElement("article");
    row.className = `leaderboard-row${entry.playerId === identity.playerId ? " is-you" : ""}`;
    const rank = document.createElement("strong");
    rank.className = "leaderboard-rank";
    rank.textContent = String(index + 1);

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
    const record = document.createElement("span");
    record.textContent = `${entry.wins}W · ${entry.losses}L${entry.draws ? ` · ${entry.draws}D` : ""} · ${entry.played} played`;
    copy.append(name, record);
    player.append(copy);

    const points = document.createElement("div");
    points.className = "leaderboard-points";
    points.innerHTML = `<strong>${entry.points}</strong><span>PTS</span>`;
    row.append(rank, player, points);
    list.append(row);
  });
}

async function refresh() {
  try {
    const response = await gameFrameFetch("/api/leaderboard", {}, identity);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || "Leaderboard could not be loaded.");
    games = Array.isArray(body.games) ? body.games : [];
    gameSelect.replaceChildren();
    if (!games.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Board games";
      gameSelect.append(option);
    } else {
      for (const game of games) {
        const option = document.createElement("option");
        option.value = game.gameId;
        option.textContent = gameName(game.gameId);
        gameSelect.append(option);
      }
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
