import { establishGameFrameIdentity, gameFrameFetch } from "./gameframe-auth.js";

const query = new URLSearchParams(window.location.search);
const identity = await establishGameFrameIdentity({
  preferredDevelopmentPlayerId: query.get("player"),
});
window.gameFrameIdentity = identity;
await import("./gameframe-nav.js");

const gameFilter = query.get("game");
const filterLabel = document.querySelector("#matches-filter");
const errorBox = document.querySelector("#matches-error");
const lists = {
  turn: document.querySelector("#your-turn-list"),
  challenges: document.querySelector("#challenges-list"),
  waiting: document.querySelector("#waiting-list"),
  completed: document.querySelector("#completed-list"),
};
const counts = {
  turn: document.querySelector("#your-turn-count"),
  challenges: document.querySelector("#challenges-count"),
  waiting: document.querySelector("#waiting-count"),
  completed: document.querySelector("#completed-count"),
};
let knownPlayers = [];
let acceptingInvitationId = null;
let cancellingInvitationId = null;
let decliningInvitationId = null;
let resigningMatchId = null;

function challengeMutationPending() {
  return acceptingInvitationId !== null || cancellingInvitationId !== null || decliningInvitationId !== null;
}

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

function playerName(playerId) {
  if (playerId === identity.playerId) return "You";
  return knownPlayers.find((player) => player.playerId === playerId)?.displayName || "Opponent";
}

function opponentFor(match) {
  return match.playerIds.find((playerId) => playerId !== identity.playerId) || "opponent";
}

function empty(container, text) {
  container.replaceChildren();
  const paragraph = document.createElement("p");
  paragraph.className = "platform-empty";
  paragraph.textContent = text;
  container.append(paragraph);
}

function matchRow(match, mode) {
  const row = document.createElement("article");
  row.className = `platform-row ${mode === "turn" ? "is-turn" : mode === "completed" ? "is-complete" : ""}`;
  const copy = document.createElement("div");
  copy.className = "platform-row-copy";
  const kicker = document.createElement("span");
  kicker.className = "platform-row-kicker";
  kicker.textContent = mode === "turn" ? "YOUR TURN" : mode === "waiting" ? "WAITING" : "COMPLETE";
  const title = document.createElement("strong");
  title.textContent = `${gameName(match.gameId)} vs ${playerName(opponentFor(match))}`;
  const detail = document.createElement("p");
  if (mode === "completed") {
    detail.textContent = match.draw
      ? `Draw · ${relativeTime(match.updatedAt)}`
      : match.winnerPlayerId === identity.playerId
        ? `Won · ${relativeTime(match.updatedAt)}`
        : `Lost · ${relativeTime(match.updatedAt)}`;
  } else {
    detail.textContent = `Revision ${match.revision} · ${relativeTime(match.updatedAt)}`;
  }
  copy.append(kicker, title, detail);

  const actions = document.createElement("div");
  actions.className = "platform-actions";
  const open = document.createElement("a");
  open.className = `platform-button ${mode === "turn" ? "primary" : ""}`;
  open.href = match.resumePath;
  open.textContent = mode === "turn" ? "Play move" : mode === "completed" ? "View" : "Open";
  actions.append(open);
  if (mode !== "completed") {
    const leave = document.createElement("button");
    leave.className = "platform-button danger";
    leave.type = "button";
    leave.textContent = resigningMatchId === match.matchId ? "Leaving…" : "Leave match";
    leave.disabled = resigningMatchId !== null;
    leave.addEventListener("click", () => void resignMatch(match));
    actions.append(leave);
  }
  row.append(copy, actions);
  return row;
}

function challengeRow(invitation) {
  const incoming = invitation.inviter.playerId !== identity.playerId;
  const row = document.createElement("article");
  row.className = "platform-row is-challenge";
  const copy = document.createElement("div");
  copy.className = "platform-row-copy";
  const kicker = document.createElement("span");
  kicker.className = "platform-row-kicker";
  kicker.textContent = incoming ? "NEW CHALLENGE" : "SENT";
  const title = document.createElement("strong");
  title.textContent = incoming
    ? `${invitation.inviter.displayName || "A player"} challenged you to ${gameName(invitation.gameId)}`
    : `${gameName(invitation.gameId)} challenge sent`;
  const detail = document.createElement("p");
  detail.textContent = incoming
    ? `Waiting for your answer · ${relativeTime(invitation.updatedAt)}`
    : `Waiting for another player · ${relativeTime(invitation.updatedAt)}`;
  copy.append(kicker, title, detail);

  const actions = document.createElement("div");
  actions.className = "platform-actions";
  if (incoming) {
    if (invitation.claimToken) {
      const accept = document.createElement("button");
      accept.className = "platform-button primary";
      accept.type = "button";
      accept.textContent = acceptingInvitationId === invitation.invitationId ? "Accepting…" : "Accept";
      accept.disabled = challengeMutationPending();
      accept.addEventListener("click", () => void acceptChallenge(invitation));
      actions.append(accept);
    }
    const decline = document.createElement("button");
    decline.className = "platform-button";
    decline.type = "button";
    decline.textContent = decliningInvitationId === invitation.invitationId ? "Declining…" : "Decline";
    decline.disabled = challengeMutationPending();
    decline.addEventListener("click", () => void declineChallenge(invitation));
    actions.append(decline);
  } else {
    const cancel = document.createElement("button");
    cancel.className = "platform-button";
    cancel.type = "button";
    cancel.textContent = cancellingInvitationId === invitation.invitationId ? "Cancelling…" : "Cancel";
    cancel.disabled = challengeMutationPending();
    cancel.addEventListener("click", () => void cancelChallenge(invitation));
    actions.append(cancel);
  }
  row.append(copy, actions);
  return row;
}

function renderList(key, items, emptyText, rowFactory) {
  counts[key].textContent = String(items.length);
  if (!items.length) {
    empty(lists[key], emptyText);
    return;
  }
  lists[key].replaceChildren(...items.map(rowFactory));
}

async function resignMatch(match) {
  if (resigningMatchId) return;
  const opponent = playerName(opponentFor(match));
  if (!window.confirm(`Leave this ${gameName(match.gameId)} match against ${opponent}? This counts as a loss for you and a win for your opponent.`)) return;
  resigningMatchId = match.matchId;
  try {
    await refresh();
    const response = await gameFrameFetch(`/api/matches/${encodeURIComponent(match.matchId)}/resign`, {
      method: "POST",
    }, identity);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || `Leaving the match failed with ${response.status}.`);
    resigningMatchId = null;
    await refresh();
  } catch (error) {
    resigningMatchId = null;
    errorBox.hidden = false;
    errorBox.textContent = error instanceof Error ? error.message : "The match could not be left.";
    await refresh();
  }
}

async function acceptChallenge(invitation) {
  if (!invitation.claimToken || challengeMutationPending()) return;
  acceptingInvitationId = invitation.invitationId;
  try {
    const response = await gameFrameFetch("/api/invitations/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: invitation.claimToken }),
    }, identity);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || `Challenge acceptance failed with ${response.status}.`);
    window.location.assign(body.resumePath || "/matches.html");
  } catch (error) {
    acceptingInvitationId = null;
    errorBox.hidden = false;
    errorBox.textContent = error instanceof Error ? error.message : "The challenge could not be accepted.";
    await refresh();
  }
}

async function cancelChallenge(invitation) {
  if (challengeMutationPending()) return;
  cancellingInvitationId = invitation.invitationId;
  try {
    const response = await gameFrameFetch(
      `/api/invitations/${encodeURIComponent(invitation.invitationId)}/cancel`,
      { method: "POST" },
      identity,
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || `Challenge cancellation failed with ${response.status}.`);
    cancellingInvitationId = null;
    await refresh();
  } catch (error) {
    cancellingInvitationId = null;
    errorBox.hidden = false;
    errorBox.textContent = error instanceof Error ? error.message : "The challenge could not be cancelled.";
    await refresh();
  }
}

async function declineChallenge(invitation) {
  if (challengeMutationPending()) return;
  decliningInvitationId = invitation.invitationId;
  try {
    const response = await gameFrameFetch(
      `/api/invitations/${encodeURIComponent(invitation.invitationId)}/decline`,
      { method: "POST" },
      identity,
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || `Challenge decline failed with ${response.status}.`);
    decliningInvitationId = null;
    await refresh();
  } catch (error) {
    decliningInvitationId = null;
    errorBox.hidden = false;
    errorBox.textContent = error instanceof Error ? error.message : "The challenge could not be declined.";
    await refresh();
  }
}

async function refresh() {
  try {
    errorBox.hidden = true;
    const [playersResponse, feedResponse] = await Promise.all([
      gameFrameFetch("/api/players", {}, identity),
      gameFrameFetch("/api/me/feed", {}, identity),
    ]);
    const players = await playersResponse.json().catch(() => ({}));
    const feed = await feedResponse.json().catch(() => ({}));
    if (!playersResponse.ok) throw new Error(players.message || "Player directory could not be loaded.");
    if (!feedResponse.ok) throw new Error(feed.message || "Matches could not be loaded.");
    knownPlayers = Array.isArray(players.players) ? players.players : [];

    const matches = (Array.isArray(feed.matches) ? feed.matches : [])
      .filter((match) => !gameFilter || match.gameId === gameFilter);
    const invitations = (Array.isArray(feed.invitations) ? feed.invitations : [])
      .filter((invitation) => (!gameFilter || invitation.gameId === gameFilter) && invitation.status === "pending");
    const active = matches.filter((match) => match.lifecycle === "active");
    const yourTurn = active.filter((match) => match.activePlayerId === identity.playerId);
    const waiting = active.filter((match) => match.activePlayerId !== identity.playerId);
    const completed = matches.filter((match) => match.lifecycle === "completed");

    renderList("turn", yourTurn, "Nothing needs your move right now.", (match) => matchRow(match, "turn"));
    renderList("waiting", waiting, "No games are waiting on another player.", (match) => matchRow(match, "waiting"));
    renderList("completed", completed, "No completed matches yet.", (match) => matchRow(match, "completed"));
    renderList("challenges", invitations, "No pending challenges.", challengeRow);
  } catch (error) {
    errorBox.hidden = false;
    errorBox.textContent = error instanceof Error ? error.message : "Matches could not be loaded.";
  }
}

if (gameFilter) filterLabel.textContent = `Showing ${gameName(gameFilter)} only.`;
await refresh();
window.addEventListener("focus", () => void refresh());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void refresh();
});
