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

const CASCADE_STATE_KEY = "scribbles-gameframe.cascade-state:v1";
const CASCADE_PERFORMANCE_KEY = "scribbles-gameframe.cascade-performance:v1";
const CASCADE_OWNER_KEY = "scribbles-gameframe.cascade-progression-owner:v1";
const CASCADE_CANDIDATE_KEY = "scribbles-gameframe.cascade-progression-candidate:v1";

const GAMES = new Map([
  ["cascade", { name: "Cascade Crush", kicker: "MATCH-3", href: "/cascade.html", hubId: "casual-games", detail: "Keep the run moving." }],
  ["othello", { name: "Othello", kicker: "STRATEGY", href: "/othello.html", hubId: "othello", detail: "Control the board." }],
  ["american-checkers", { name: "Clockwork Checkers", kicker: "CLOCKWORK ECLIPSE", href: "/?game=american-checkers&menu=1", hubId: "american-checkers", detail: "Mandatory captures. No mercy." }],
  ["tic-tac-toe", { name: "Tic-Tac-Toe", kicker: "QUICK MATCH", href: "/?game=tic-tac-toe&menu=1", hubId: "tic-tac-toe", detail: "A fast duel." }],
  ["monster-master-duel", { name: "Monster Master Arena", kicker: "TACTICAL BATTLE", href: "/monster-master.html", hubId: "battle-simulator", detail: "Return to the arena." }],
  ["monster-master-rpg", { name: "Monster Master RPG", kicker: "PERSISTENT WORLD", href: "/gameframe-rpg.html", hubId: "role-playing-games", detail: "Continue the campaign." }],
]);

function readJson(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function cascadeSnapshot() {
  const state = readJson(CASCADE_STATE_KEY) || {};
  const performance = readJson(CASCADE_PERFORMANCE_KEY) || {};
  const starsByLevel = performance.starsByLevel && typeof performance.starsByLevel === "object"
    ? performance.starsByLevel
    : {};
  const starLevels = Object.keys(starsByLevel)
    .map(Number)
    .filter((level) => Number.isInteger(level) && level > 0);
  const highestStarLevel = starLevels.length ? Math.max(...starLevels) : 0;
  const unlockedLevel = Math.max(1, Math.floor(Number(state.level) || 1));
  const highestCompletedLevel = Math.max(highestStarLevel, unlockedLevel - 1);
  const totalBestStars = Object.values(starsByLevel)
    .reduce((total, value) => total + Math.max(0, Math.min(3, Math.floor(Number(value) || 0))), 0);
  return { unlockedLevel, highestCompletedLevel, totalBestStars, starsByLevel };
}

function gameFor(gameId) {
  return GAMES.get(gameId) || { name: gameId, kicker: "GAMEFRAME", href: "/?catalog=1", hubId: "role-playing-games", detail: "Open GameFrame." };
}

function gameVisual(game) {
  const source = document.querySelector(`#game-card-${game.hubId} .game-card-visual`);
  if (!source) return '<span class="home-visual-fallback" aria-hidden="true">GF</span>';
  const clone = source.cloneNode(true);
  clone.removeAttribute("id");
  return clone.outerHTML;
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

function chooseContinue(yourTurn, favorites, cascade) {
  if (yourTurn.length) {
    const match = yourTurn[0];
    const game = gameFor(match.gameId);
    return {
      ...game,
      href: match.resumePath || game.href,
      eyebrow: "YOUR TURN",
      title: game.name,
      detail: `A move is waiting for you · ${relativeTime(match.updatedAt)}`,
      action: "Play move",
    };
  }
  if (cascade.highestCompletedLevel > 0 || cascade.totalBestStars > 0) {
    const game = gameFor("cascade");
    return {
      ...game,
      eyebrow: "CONTINUE PLAYING",
      title: game.name,
      detail: `Level ${cascade.unlockedLevel} · ${cascade.totalBestStars} best stars`,
      action: "Continue run",
    };
  }
  const favorite = favorites.map((id) => GAMES.get(id)).find(Boolean);
  if (favorite) {
    return { ...favorite, eyebrow: "JUMP BACK IN", title: favorite.name, detail: favorite.detail, action: "Play" };
  }
  const game = gameFor("cascade");
  return { ...game, eyebrow: "START HERE", title: game.name, detail: "A quick run is waiting.", action: "Play Cascade" };
}

function continueCard(choice) {
  const card = document.createElement("a");
  card.className = "home-continue-card";
  card.href = choice.href;
  card.innerHTML = `
    <div class="home-continue-art">${gameVisual(choice)}</div>
    <div class="home-continue-shade"></div>
    <div class="home-continue-copy">
      <small>${choice.eyebrow}</small>
      <h2>${choice.title}</h2>
      <p>${choice.detail}</p>
      <span>${choice.action}<b aria-hidden="true">→</b></span>
    </div>
  `;
  return card;
}

function progressionCard(progression) {
  const card = document.createElement("a");
  card.className = "home-level-card";
  card.href = "/profile.html";
  card.dataset.gamerProgression = "true";
  updateProgressionCard(card, progression);
  return card;
}

function updateProgressionCard(card, progression) {
  const level = Math.max(1, Math.floor(Number(progression?.gamerLevel) || 1));
  const xp = Math.max(0, Math.floor(Number(progression?.gamerXp) || 0));
  const toNext = Math.max(0, Math.floor(Number(progression?.xpToNextLevel) || 0));
  const progress = Math.max(0, Math.min(1, Number(progression?.progress) || 0));
  card.innerHTML = `
    <div class="home-level-topline"><span>GAMER LEVEL</span><b>PROFILE ↗</b></div>
    <div class="home-level-number"><small>LV</small><strong>${level}</strong></div>
    <div class="home-level-name">${identity.displayName || "GameFrame Player"}</div>
    <div class="home-xp-track" aria-label="${Math.round(progress * 100)} percent to next Gamer Level"><i style="width:${(progress * 100).toFixed(2)}%"></i></div>
    <div class="home-level-meta"><span>${xp.toLocaleString()} XP</span><span>${toNext.toLocaleString()} to LV ${level + 1}</span></div>
  `;
}

function importPrompt(cascade, progression) {
  const owner = localStorage.getItem(CASCADE_OWNER_KEY);
  if (cascade.highestCompletedLevel <= 0 && cascade.totalBestStars <= 0) {
    if (owner) localStorage.removeItem(CASCADE_CANDIDATE_KEY);
    else localStorage.setItem(CASCADE_CANDIDATE_KEY, identity.playerId);
    return null;
  }
  if (owner === identity.playerId) {
    localStorage.removeItem(CASCADE_CANDIDATE_KEY);
    return null;
  }

  const prompt = document.createElement("section");
  prompt.className = "home-cascade-import";
  if (owner) {
    localStorage.removeItem(CASCADE_CANDIDATE_KEY);
    prompt.innerHTML = `
      <div><small>CASCADE PROFILE LINK</small><strong>This browser's Cascade progress belongs to another player.</strong><span>It will stay local and will not be added to ${identity.displayName || "this player"}.</span></div>
    `;
    return prompt;
  }

  prompt.innerHTML = `
    <div><small>CASCADE PROGRESS FOUND</small><strong>Level ${cascade.highestCompletedLevel} · ${cascade.totalBestStars} best stars</strong><span>Add this browser's existing run to ${identity.displayName || "your GameFrame player"}?</span></div>
  `;
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Add to this player";
  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Adding…";
    try {
      const response = await gameFrameFetch("/api/me/cascade/progression", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          highestCompletedLevel: cascade.highestCompletedLevel,
          starsByLevel: cascade.starsByLevel,
        }),
      }, identity);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Cascade progress could not be added.");
      localStorage.setItem(CASCADE_OWNER_KEY, identity.playerId);
      localStorage.removeItem(CASCADE_CANDIDATE_KEY);
      const levelCard = document.querySelector("[data-gamer-progression]");
      if (levelCard) updateProgressionCard(levelCard, body);
      prompt.remove();
    } catch (error) {
      button.disabled = false;
      button.textContent = error instanceof Error ? error.message : "Try again";
    }
  });
  prompt.append(button);
  return prompt;
}

function jumpBackIn(favoriteGameIds, cascade) {
  const section = document.createElement("section");
  section.className = "home-content-section";
  const heading = document.createElement("header");
  heading.className = "home-content-heading";
  heading.innerHTML = '<div><small>YOUR GAMES</small><h2>Jump back in</h2></div><a href="/?catalog=1">All games →</a>';
  const grid = document.createElement("div");
  grid.className = "home-jump-grid";
  const ordered = [...new Set([...favoriteGameIds, "cascade", "othello", "monster-master-rpg"])]
    .map((id) => [id, GAMES.get(id)])
    .filter(([, game]) => Boolean(game))
    .slice(0, 3);
  for (const [id, game] of ordered) {
    const link = document.createElement("a");
    link.className = "home-jump-card";
    link.href = game.href;
    let detail = game.detail;
    if (id === "cascade" && (cascade.highestCompletedLevel || cascade.totalBestStars)) {
      detail = `Level ${cascade.unlockedLevel} · ${cascade.totalBestStars} stars`;
    }
    link.innerHTML = `
      <div class="home-jump-art">${gameVisual(game)}</div>
      <div class="home-jump-copy"><small>${game.kicker}</small><strong>${game.name}</strong><span>${detail}</span></div>
      <b aria-hidden="true">↗</b>
    `;
    grid.append(link);
  }
  section.append(heading, grid);
  return section;
}

function activitySection(yourTurn, waiting, challenges) {
  if (!yourTurn.length && !waiting.length && !challenges.length) return null;
  const section = document.createElement("section");
  section.className = "home-content-section home-activity-section";
  const heading = document.createElement("header");
  heading.className = "home-content-heading";
  heading.innerHTML = '<div><small>LIVE ACTIVITY</small><h2>In play</h2></div><a href="/matches.html">All matches →</a>';
  const list = document.createElement("div");
  list.className = "home-activity-list";

  const rows = [
    ...challenges.slice(0, 2).map((invitation) => ({
      tone: "challenge",
      kicker: "NEW CHALLENGE",
      title: `${invitation.inviter?.displayName || "A player"} · ${gameFor(invitation.gameId).name}`,
      detail: relativeTime(invitation.updatedAt),
      href: "/matches.html",
      action: "View",
    })),
    ...yourTurn.slice(0, 3).map((match) => ({
      tone: "turn",
      kicker: "YOUR TURN",
      title: gameFor(match.gameId).name,
      detail: relativeTime(match.updatedAt),
      href: match.resumePath,
      action: "Play move",
    })),
    ...waiting.slice(0, 2).map((match) => ({
      tone: "waiting",
      kicker: "IN PROGRESS",
      title: gameFor(match.gameId).name,
      detail: `Waiting on the other player · ${relativeTime(match.updatedAt)}`,
      href: match.resumePath,
      action: "Open",
    })),
  ].slice(0, 5);

  for (const item of rows) {
    const row = document.createElement("article");
    row.className = `home-activity-row is-${item.tone}`;
    row.innerHTML = `<div><small>${item.kicker}</small><strong>${item.title}</strong><span>${item.detail}</span></div><a href="${item.href}">${item.action}</a>`;
    list.append(row);
  }
  section.append(heading, list);
  return section;
}

const dashboard = document.createElement("div");
dashboard.className = "gameframe-home-dashboard";
dashboard.innerHTML = '<p class="home-dashboard-loading">Loading your GameFrame…</p>';
gameGrid.before(dashboard);
gameGrid.hidden = true;
if (sectionLabel) sectionLabel.textContent = "HOME";
if (lobbyTitle) lobbyTitle.textContent = `Good to see you${identity.displayName ? `, ${identity.displayName}` : ""}.`;
if (lobbyMessage) lobbyMessage.textContent = "Pick up where you left off, see what needs you, and keep your Gamer Level moving.";
document.title = "Home · Scribbles GameFrame";

async function refresh() {
  try {
    const [feedResponse, progressionResponse] = await Promise.all([
      gameFrameFetch("/api/me/feed", {}, identity),
      gameFrameFetch("/api/me/progression", {}, identity),
    ]);
    const feed = await feedResponse.json().catch(() => ({}));
    const progression = await progressionResponse.json().catch(() => ({}));
    if (!feedResponse.ok) throw new Error(feed.message || "GameFrame activity could not be loaded.");
    if (!progressionResponse.ok) throw new Error(progression.message || "Gamer Level could not be loaded.");

    const matches = Array.isArray(feed.matches) ? feed.matches : [];
    const favoriteGameIds = Array.isArray(feed.favoriteGameIds) ? feed.favoriteGameIds : [];
    const active = matches.filter((match) => match.lifecycle === "active");
    const yourTurn = active.filter((match) => match.activePlayerId === identity.playerId);
    const waiting = active.filter((match) => match.activePlayerId !== identity.playerId);
    const challenges = (Array.isArray(feed.invitations) ? feed.invitations : [])
      .filter((invitation) => invitation.status === "pending" && invitation.inviter?.playerId !== identity.playerId);
    const cascade = cascadeSnapshot();
    const hero = document.createElement("section");
    hero.className = "home-hero-grid";
    hero.append(continueCard(chooseContinue(yourTurn, favoriteGameIds, cascade)), progressionCard(progression));

    dashboard.replaceChildren(hero);
    const claim = importPrompt(cascade, progression);
    if (claim) dashboard.append(claim);
    dashboard.append(jumpBackIn(favoriteGameIds, cascade));
    const activity = activitySection(yourTurn, waiting, challenges);
    if (activity) dashboard.append(activity);

    const footer = document.createElement("footer");
    footer.className = "home-dashboard-footer";
    footer.innerHTML = '<a href="/?catalog=1">Browse Games</a><a href="/matches.html">Matches</a><a href="/leaderboard.html">Hall of Fame</a>';
    dashboard.append(footer);
  } catch (error) {
    dashboard.replaceChildren();
    const message = document.createElement("p");
    message.className = "home-dashboard-loading";
    message.textContent = error instanceof Error ? error.message : "GameFrame could not be loaded.";
    dashboard.append(message);
  }
}

await refresh();
window.addEventListener("focus", () => void refresh());