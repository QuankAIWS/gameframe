import { gameFrameFetch } from "./gameframe-auth.js";

const identity = window.gameFrameIdentity;
const gameGrid = document.querySelector("#game-grid");
const lobby = document.querySelector("#lobby");
const sectionLabel = document.querySelector("#lobby .section-label");
const lobbyTitle = document.querySelector("#lobby-title");
const lobbyMessage = document.querySelector("#lobby-message");
if (!identity || !gameGrid || !lobby) throw new Error("GameFrame Home requires the authenticated hub shell.");

if (!document.head.querySelector('link[href="/home-dashboard.css"]')) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "/home-dashboard.css";
  document.head.append(stylesheet);
}

const FAVORITE_GAMES = new Map([
  ["cascade", { name: "Cascade", detail: "Match-3 puzzle", href: "/cascade.html" }],
  ["othello", { name: "Othello", detail: "Strategy", href: "/othello.html" }],
  ["american-checkers", { name: "Clockwork Checkers", detail: "Strategy", href: "/?game=american-checkers&menu=1" }],
  ["tic-tac-toe", { name: "Tic-Tac-Toe", detail: "Quick game", href: "/?game=tic-tac-toe&menu=1" }],
  ["monster-master-duel", { name: "Monster Master Arena", detail: "Tactical battle", href: "/monster-master.html" }],
  ["monster-master-rpg", { name: "Monster Master RPG", detail: "Campaign", href: "/gameframe-rpg.html" }],
]);

function gameName(gameId) {
  if (gameId === "othello") return "Othello";
  if (gameId === "american-checkers") return "Clockwork Checkers";
  if (gameId === "tic-tac-toe") return "Tic-Tac-Toe";
  if (gameId === "monster-master-duel") return "Monster Master Arena Battles";
  return gameId;
}

function relativeTime(value) {
  const elapsed = Math.max(0, Date.now() - Number(value || 0));
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function rowFor(match, waiting = false) {
  const row = document.createElement("article");
  row.className = `home-match-row${waiting ? " waiting" : ""}`;
  const copy = document.createElement("div");
  copy.className = "home-match-copy";
  const kicker = document.createElement("small");
  kicker.textContent = waiting ? "WAITING" : "YOUR TURN";
  const title = document.createElement("strong");
  title.textContent = gameName(match.gameId);
  const detail = document.createElement("span");
  detail.textContent = `Revision ${match.revision} · ${relativeTime(match.updatedAt)}`;
  copy.append(kicker, title, detail);
  const open = document.createElement("a");
  open.href = match.resumePath;
  open.textContent = waiting ? "Open" : "Play move";
  row.append(copy, open);
  return row;
}

function section(title, items, emptyText, waiting = false) {
  const wrapper = document.createElement("section");
  wrapper.className = "home-section";
  const heading = document.createElement("header");
  heading.className = "home-section-heading";
  const label = document.createElement("strong");
  label.textContent = title;
  const count = document.createElement("span");
  count.textContent = String(items.length);
  heading.append(label, count);
  const list = document.createElement("div");
  list.className = "home-match-list";
  if (items.length) list.append(...items.slice(0, 4).map((match) => rowFor(match, waiting)));
  else {
    const empty = document.createElement("p");
    empty.className = "home-dashboard-empty";
    empty.textContent = emptyText;
    list.append(empty);
  }
  wrapper.append(heading, list);
  return wrapper;
}

function newsStrip() {
  const strip = document.createElement("section");
  strip.className = "home-news-strip";
  strip.setAttribute("aria-label", "What's new in GameFrame");
  strip.innerHTML = `
    <strong>WHAT'S NEW</strong>
    <span><b>ASYNC PLAY</b> Othello matches stay saved between visits.</span>
    <span><b>PLAYER HUB</b> Matches, profiles, favorites, and standings now travel with your player.</span>
  `;
  return strip;
}

function favoritesSection(favoriteGameIds) {
  const wrapper = document.createElement("section");
  wrapper.className = "home-section home-favorites-section";
  const heading = document.createElement("header");
  heading.className = "home-section-heading";
  heading.innerHTML = `<strong>Favorites</strong><span>${favoriteGameIds.length}</span>`;
  const list = document.createElement("div");
  list.className = "home-favorite-grid";
  const games = favoriteGameIds.map((gameId) => ({ gameId, ...FAVORITE_GAMES.get(gameId) })).filter((game) => game.name);
  if (!games.length) {
    const empty = document.createElement("p");
    empty.className = "home-dashboard-empty";
    empty.innerHTML = 'Pin favorite games from <a href="/profile.html">Profile</a> and they will appear here.';
    list.append(empty);
  } else {
    for (const game of games) {
      const link = document.createElement("a");
      link.className = "home-favorite-card";
      link.href = game.href;
      link.innerHTML = `<span aria-hidden="true">★</span><strong>${game.name}</strong><small>${game.detail}</small>`;
      list.append(link);
    }
  }
  wrapper.append(heading, list);
  return wrapper;
}

const dashboard = document.createElement("div");
dashboard.className = "gameframe-home-dashboard";
dashboard.innerHTML = '<p class="home-dashboard-empty">Loading your GameFrame activity…</p>';
gameGrid.before(dashboard);
gameGrid.hidden = true;
if (sectionLabel) sectionLabel.textContent = "HOME";
if (lobbyTitle) lobbyTitle.textContent = "Ready when you are";
if (lobbyMessage) lobbyMessage.textContent = "Your games, open matches, and anything that needs your attention.";
document.title = "Home · Scribbles GameFrame";

async function refresh() {
  try {
    const response = await gameFrameFetch("/api/me/feed", {}, identity);
    const feed = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(feed.message || "GameFrame activity could not be loaded.");
    const matches = Array.isArray(feed.matches) ? feed.matches : [];
    const favoriteGameIds = Array.isArray(feed.favoriteGameIds) ? feed.favoriteGameIds : [];
    const active = matches.filter((match) => match.lifecycle === "active");
    const yourTurn = active.filter((match) => match.activePlayerId === identity.playerId);
    const waiting = active.filter((match) => match.activePlayerId !== identity.playerId);
    const incomingChallenges = (Array.isArray(feed.invitations) ? feed.invitations : [])
      .filter((invitation) => invitation.status === "pending" && invitation.inviter?.playerId !== identity.playerId);

    dashboard.replaceChildren(
      newsStrip(),
      section("Your turn", yourTurn, "Nothing needs your move right now."),
      section("Waiting", waiting, "No open games are waiting on another player.", true),
      favoritesSection(favoriteGameIds),
    );

    if (incomingChallenges.length) {
      const challenges = document.createElement("section");
      challenges.className = "home-section";
      const heading = document.createElement("header");
      heading.className = "home-section-heading";
      heading.innerHTML = `<strong>Challenges</strong><span>${incomingChallenges.length}</span>`;
      const list = document.createElement("div");
      list.className = "home-match-list";
      for (const invitation of incomingChallenges.slice(0, 3)) {
        const row = document.createElement("article");
        row.className = "home-match-row challenge";
        const copy = document.createElement("div");
        copy.className = "home-match-copy";
        const kicker = document.createElement("small");
        kicker.textContent = "NEW CHALLENGE";
        const title = document.createElement("strong");
        title.textContent = `${invitation.inviter?.displayName || "A player"} · ${gameName(invitation.gameId)}`;
        const detail = document.createElement("span");
        detail.textContent = relativeTime(invitation.updatedAt);
        copy.append(kicker, title, detail);
        const open = document.createElement("a");
        open.href = "/matches.html";
        open.textContent = "View";
        row.append(copy, open);
        list.append(row);
      }
      challenges.append(heading, list);
      dashboard.insertBefore(challenges, dashboard.querySelector(".home-favorites-section"));
    }

    const footer = document.createElement("div");
    footer.className = "home-dashboard-footer";
    const games = document.createElement("a");
    games.className = "home-dashboard-action primary";
    games.href = "/?catalog=1";
    games.textContent = "Browse Games";
    const matchesLink = document.createElement("a");
    matchesLink.className = "home-dashboard-action secondary";
    matchesLink.href = "/matches.html";
    matchesLink.textContent = "All Matches";
    const leaderboard = document.createElement("a");
    leaderboard.className = "home-dashboard-action secondary";
    leaderboard.href = "/leaderboard.html";
    leaderboard.textContent = "Leaderboard";
    footer.append(games, matchesLink, leaderboard);
    dashboard.append(footer);
  } catch (error) {
    dashboard.replaceChildren();
    const message = document.createElement("p");
    message.className = "home-dashboard-empty";
    message.textContent = error instanceof Error ? error.message : "GameFrame activity could not be loaded.";
    dashboard.append(message);
  }
}

await refresh();
window.addEventListener("focus", () => void refresh());
