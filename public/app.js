const board = document.querySelector("#board");
const status = document.querySelector("#status");
const revision = document.querySelector("#revision");
const details = document.querySelector("#details");
const lobby = document.querySelector("#lobby");
const matchPanel = document.querySelector("#match-panel");
const matchIdLabel = document.querySelector("#match-id");
const connectionLabel = document.querySelector("#connection");
const playerX = document.querySelector("#player-x");
const playerO = document.querySelector("#player-o");
const playerXName = document.querySelector("#player-x-name");
const playerOName = document.querySelector("#player-o-name");
const challengeTheo = document.querySelector("#challenge-theo");
const createHumanMatch = document.querySelector("#create-human-match");
const newMatch = document.querySelector("#new-match");
const copyInvite = document.querySelector("#copy-invite");
const invitePanel = document.querySelector("#invite-panel");
const inviteLink = document.querySelector("#invite-link");
const lobbyMessage = document.querySelector("#lobby-message");
const errorBanner = document.querySelector("#error-banner");

const primaryPlayerStorageKey = "scribbles-gameframe.player-id";
const recentMatchStorageKey = "scribbles-gameframe.recent-match";
const theoPlayerId = "theo";
const urlState = new URLSearchParams(window.location.search);
const explicitPlayerId = normalizeIdentity(urlState.get("player"));
const playerId = explicitPlayerId ?? getOrCreatePrimaryPlayerId();

let current = null;
let realtimeEnabled = false;
let socket = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
let pollTimer = null;
let requestPending = false;
let invitePlayerId = null;

function normalizeIdentity(value) {
  const normalized = value?.trim();
  if (!normalized || normalized.length > 120) return null;
  return normalized;
}

function getOrCreatePrimaryPlayerId() {
  const existing = normalizeIdentity(window.localStorage.getItem(primaryPlayerStorageKey));
  if (existing) return existing;
  const created = `browser-${crypto.randomUUID()}`;
  window.localStorage.setItem(primaryPlayerStorageKey, created);
  return created;
}

function displayName(id) {
  if (id === theoPlayerId) return "Theo";
  if (id === playerId) return "You";
  return "Opponent";
}

function activePlayerName(observation) {
  return observation.nextPlayerId ? displayName(observation.nextPlayerId) : "—";
}

function statusText(view) {
  const observation = view.observation;
  if (observation.status.draw) return "Draw. The board is locked.";
  if (observation.status.winnerPlayerId) {
    return observation.status.winnerPlayerId === playerId
      ? "You won. Match complete."
      : `${displayName(observation.status.winnerPlayerId)} won. Match complete.`;
  }
  if (observation.nextPlayerId === playerId) {
    return `Your turn — you are ${view.playerIds[0] === playerId ? "X" : "O"}.`;
  }
  return `${activePlayerName(observation)} is up.`;
}

function setBusy(busy) {
  requestPending = busy;
  challengeTheo.disabled = busy;
  createHumanMatch.disabled = busy;
  newMatch.disabled = busy;
  for (const cell of board.querySelectorAll(".cell")) {
    const index = Number(cell.dataset.cell);
    const legal = current?.observation.legalActions.some((action) => action.cell === index) ?? false;
    cell.disabled = busy || !legal;
  }
}

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.hidden = false;
}

function clearError() {
  errorBanner.textContent = "";
  errorBanner.hidden = true;
}

function updateUrl(matchId, identity = playerId) {
  const url = new URL(window.location.href);
  if (matchId) {
    url.searchParams.set("match", matchId);
    url.searchParams.set("player", identity);
  } else {
    url.searchParams.delete("match");
    url.searchParams.delete("player");
  }
  window.history.replaceState({}, "", url);
}

function persistRecentMatch(matchId) {
  if (!explicitPlayerId) window.localStorage.setItem(recentMatchStorageKey, matchId);
}

function clearRecentMatch() {
  if (!explicitPlayerId) window.localStorage.removeItem(recentMatchStorageKey);
}

function buildInviteUrl(view) {
  if (view.playerIds.includes(theoPlayerId) || view.playerIds[0] !== playerId) return null;
  const invitedPlayer = view.playerIds[1];
  const url = new URL(window.location.href);
  url.searchParams.set("match", view.matchId);
  url.searchParams.set("player", invitedPlayer);
  return { url: url.toString(), playerId: invitedPlayer };
}

function renderPlayerCards(view) {
  const [xId, oId] = view.playerIds;
  playerXName.textContent = displayName(xId);
  playerOName.textContent = displayName(oId);
  playerX.dataset.playerId = xId;
  playerO.dataset.playerId = oId;
  const next = view.observation.nextPlayerId;
  playerX.classList.toggle("is-active", next === xId);
  playerO.classList.toggle("is-active", next === oId);
  playerX.classList.toggle("is-you", xId === playerId);
  playerO.classList.toggle("is-you", oId === playerId);
}

function renderInvite(view) {
  const invite = buildInviteUrl(view);
  invitePlayerId = invite?.playerId ?? null;
  if (!invite) {
    invitePanel.hidden = true;
    inviteLink.value = "";
    return;
  }
  invitePanel.hidden = false;
  inviteLink.value = invite.url;
}

function render(view) {
  current = view;
  lobby.hidden = true;
  matchPanel.hidden = false;
  clearError();

  status.textContent = statusText(view);
  revision.textContent = `Revision ${view.revision}`;
  matchIdLabel.textContent = view.matchId;
  connectionLabel.textContent = realtimeEnabled
    ? (socket?.readyState === WebSocket.OPEN ? "Live connection" : "Connecting…")
    : "HTTP refresh";

  renderPlayerCards(view);
  renderInvite(view);
  details.textContent = JSON.stringify({
    matchId: view.matchId,
    playerId,
    playerIds: view.playerIds,
    eventCount: view.eventCount,
    nextPlayerId: view.observation.nextPlayerId,
    realtime: realtimeEnabled ? (socket?.readyState === WebSocket.OPEN ? "connected" : "enabled") : "http-polling",
  }, null, 2);

  board.replaceChildren();
  view.observation.board.forEach((mark, cell) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell";
    button.dataset.cell = String(cell);
    button.dataset.mark = mark ?? "";
    button.textContent = mark ?? "";
    button.setAttribute("aria-label", mark ? `Cell ${cell + 1}: ${mark}` : `Cell ${cell + 1}: empty`);
    const legal = view.observation.legalActions.some((action) => action.cell === cell);
    button.disabled = !legal || requestPending;
    if (mark) button.classList.add(mark === "X" ? "mark-x" : "mark-o");
    button.addEventListener("click", () => move(cell));
    board.append(button);
  });

  persistRecentMatch(view.matchId);
  updateUrl(view.matchId);
  startProjection(view.matchId);
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-gameframe-player-id": playerId,
      ...(options.headers ?? {}),
    },
  });

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : { message: await response.text() };

  if (!response.ok) {
    const error = new Error(body.message ?? body.error ?? `Request failed with ${response.status}.`);
    error.code = body.error;
    error.revision = body.revision;
    throw error;
  }
  return body;
}

async function detectRuntime() {
  try {
    const health = await request("/api/health");
    realtimeEnabled = health.realtime === "websocket-hibernation";
  } catch {
    realtimeEnabled = false;
  }
}

function stopProjection() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (pollTimer) clearInterval(pollTimer);
  reconnectTimer = null;
  pollTimer = null;
  reconnectAttempt = 0;
  if (socket) {
    socket.onclose = null;
    socket.close();
  }
  socket = null;
}

function scheduleReconnect(matchId) {
  if (!realtimeEnabled || !current || current.matchId !== matchId || current.observation.status.lifecycle !== "active") return;
  const delay = Math.min(1000 * (2 ** reconnectAttempt), 15_000);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => connectRealtime(matchId), delay);
}

function connectRealtime(matchId) {
  if (!realtimeEnabled || !current || current.matchId !== matchId) return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  const url = new URL(`/api/matches/${encodeURIComponent(matchId)}/events`, window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(url);

  socket.onopen = () => {
    reconnectAttempt = 0;
    connectionLabel.textContent = "Live connection";
    socket.send(JSON.stringify({ type: "refresh" }));
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === "match_state" && message.view.matchId === matchId) {
        if (!current || message.view.revision >= current.revision) render(message.view);
      }
    } catch {
      // Malformed projection messages do not change authoritative client state.
    }
  };

  socket.onclose = () => {
    socket = null;
    connectionLabel.textContent = "Reconnecting…";
    scheduleReconnect(matchId);
  };

  socket.onerror = () => socket?.close();
}

async function refreshCurrent({ quiet = false } = {}) {
  if (!current) return;
  try {
    const view = await request(`/api/matches/${encodeURIComponent(current.matchId)}`);
    if (!current || view.revision >= current.revision) render(view);
  } catch (error) {
    if (!quiet) showError(error.message);
  }
}

function startHttpPolling(matchId) {
  if (pollTimer || !current || current.matchId !== matchId) return;
  pollTimer = setInterval(() => {
    if (!requestPending && current?.observation.status.lifecycle === "active") {
      void refreshCurrent({ quiet: true });
    }
  }, 900);
}

function startProjection(matchId) {
  if (!current || current.matchId !== matchId) return;
  if (realtimeEnabled) {
    if (!socket) connectRealtime(matchId);
  } else {
    connectionLabel.textContent = "HTTP refresh";
    startHttpPolling(matchId);
  }
}

async function createMatch(opponentId) {
  stopProjection();
  clearError();
  lobbyMessage.textContent = "Creating an authoritative match…";
  setBusy(true);
  try {
    const view = await request("/api/matches", {
      method: "POST",
      body: JSON.stringify({ playerIds: [playerId, opponentId] }),
    });
    render(view);
  } catch (error) {
    showError(error.message);
    lobbyMessage.textContent = "Match creation failed.";
  } finally {
    setBusy(false);
  }
}

async function loadMatch(matchId) {
  clearError();
  lobbyMessage.textContent = "Resuming match…";
  setBusy(true);
  try {
    render(await request(`/api/matches/${encodeURIComponent(matchId)}`));
  } catch (error) {
    clearRecentMatch();
    updateUrl(null);
    showError(error.message);
    lobby.hidden = false;
    matchPanel.hidden = true;
    lobbyMessage.textContent = "That match could not be resumed with this seat.";
  } finally {
    setBusy(false);
  }
}

async function move(cell) {
  if (!current || requestPending) return;
  clearError();
  status.textContent = "Submitting move…";
  setBusy(true);
  try {
    render(await request(`/api/matches/${encodeURIComponent(current.matchId)}/actions`, {
      method: "POST",
      body: JSON.stringify({
        actionId: crypto.randomUUID(),
        expectedRevision: current.revision,
        action: { type: "place", cell },
      }),
    }));
  } catch (error) {
    showError(error.message);
    if (error.code === "stale_revision") await refreshCurrent({ quiet: true });
    else status.textContent = error.message;
  } finally {
    setBusy(false);
  }
}

function leaveMatch() {
  stopProjection();
  current = null;
  invitePlayerId = null;
  clearRecentMatch();
  clearError();
  updateUrl(null);
  matchPanel.hidden = true;
  lobby.hidden = false;
  lobbyMessage.textContent = "Choose how you want to play.";
  renderPlaceholderBoard();
}

async function copyInviteLink() {
  if (!inviteLink.value || !invitePlayerId) return;
  try {
    await navigator.clipboard.writeText(inviteLink.value);
    copyInvite.textContent = "Copied";
    setTimeout(() => { copyInvite.textContent = "Copy invite"; }, 1400);
  } catch {
    inviteLink.focus();
    inviteLink.select();
    showError("Copy was blocked. The invite link is selected for manual copying.");
  }
}

function renderPlaceholderBoard() {
  board.replaceChildren();
  for (let index = 0; index < 9; index += 1) {
    const placeholder = document.createElement("button");
    placeholder.type = "button";
    placeholder.className = "cell";
    placeholder.dataset.cell = String(index);
    placeholder.disabled = true;
    placeholder.setAttribute("aria-label", `Cell ${index + 1}: unavailable`);
    board.append(placeholder);
  }
}

challengeTheo.addEventListener("click", () => createMatch(theoPlayerId));
createHumanMatch.addEventListener("click", () => createMatch(`guest-${crypto.randomUUID()}`));
newMatch.addEventListener("click", leaveMatch);
copyInvite.addEventListener("click", copyInviteLink);
window.addEventListener("beforeunload", stopProjection);

renderPlaceholderBoard();
await detectRuntime();

const requestedMatchId = normalizeIdentity(urlState.get("match"));
const recentMatchId = explicitPlayerId ? null : normalizeIdentity(window.localStorage.getItem(recentMatchStorageKey));
if (requestedMatchId ?? recentMatchId) {
  await loadMatch(requestedMatchId ?? recentMatchId);
} else {
  lobbyMessage.textContent = "Choose how you want to play.";
}
