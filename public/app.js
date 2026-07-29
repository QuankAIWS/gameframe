const board = document.querySelector("#board");
const boardHelp = document.querySelector("#board-help");
const status = document.querySelector("#status");
const revision = document.querySelector("#revision");
const details = document.querySelector("#details");
const lobby = document.querySelector("#lobby");
const matchPanel = document.querySelector("#match-panel");
const matchIdLabel = document.querySelector("#match-id");
const matchGameLabel = document.querySelector("#match-game");
const connectionLabel = document.querySelector("#connection");
const gameTitle = document.querySelector("#game-title");
const heroCopy = document.querySelector("#hero-copy");
const matchTitle = document.querySelector("#match-title");
const matchLabel = document.querySelector("#match-label");
const playerX = document.querySelector("#player-x");
const playerO = document.querySelector("#player-o");
const playerXName = document.querySelector("#player-x-name");
const playerOName = document.querySelector("#player-o-name");
const playerXSeat = document.querySelector("#player-x-seat");
const playerOSeat = document.querySelector("#player-o-seat");
const playerXBadge = document.querySelector("#player-x-badge");
const playerOBadge = document.querySelector("#player-o-badge");
const challengeTheo = document.querySelector("#challenge-theo");
const createHumanMatch = document.querySelector("#create-human-match");
const theoDescription = document.querySelector("#theo-description");
const humanDescription = document.querySelector("#human-description");
const newMatch = document.querySelector("#new-match");
const copyInvite = document.querySelector("#copy-invite");
const invitePanel = document.querySelector("#invite-panel");
const inviteLink = document.querySelector("#invite-link");
const lobbyMessage = document.querySelector("#lobby-message");
const errorBanner = document.querySelector("#error-banner");
const gameButtons = [...document.querySelectorAll("[data-game-id]")];

const primaryPlayerStorageKey = "scribbles-gameframe.player-id";
const recentMatchStorageKey = "scribbles-gameframe.recent-match";
const theoPlayerId = "theo";
const ticTacToeGameId = "tic-tac-toe";
const checkersGameId = "american-checkers";

const games = {
  [ticTacToeGameId]: {
    title: "Tic-Tac-Toe",
    shortTitle: "Tic-Tac-Toe",
    hero: "A small complete game proving authoritative turns, deterministic opponents, resumable browser play, and the same match contracts intended for larger GameFrame modules.",
    matchTitle: "Authoritative Tic-Tac-Toe board",
    theo: "Play X against the perfect deterministic fallback opponent.",
    human: "Create a second seat and share a resumable development invite.",
    seats: ["First seat · X", "Second seat · O"],
    badges: ["X", "O"],
  },
  [checkersGameId]: {
    title: "American Checkers",
    shortTitle: "Checkers",
    hero: "The first nontrivial GameFrame module: mandatory captures, complete multi-jump turns, kings, deterministic agents, replay, and the same authoritative contracts used by every game.",
    matchTitle: "Authoritative Checkers board",
    theo: "Play Black against Theo's deterministic Checkers opponent.",
    human: "Create Black and Red seats and share a resumable development invite.",
    seats: ["First seat · Black", "Second seat · Red"],
    badges: ["B", "R"],
  },
};

const urlState = new URLSearchParams(window.location.search);
const explicitPlayerId = normalizeIdentity(urlState.get("player"));
const playerId = explicitPlayerId ?? getOrCreatePrimaryPlayerId();
let selectedGameId = normalizeGameId(urlState.get("game")) ?? ticTacToeGameId;

let current = null;
let realtimeEnabled = false;
let socket = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
let pollTimer = null;
let requestPending = false;
let invitePlayerId = null;
let selectedPieceId = null;
let selectedPath = [];

function normalizeIdentity(value) {
  const normalized = value?.trim();
  if (!normalized || normalized.length > 120) return null;
  return normalized;
}

function normalizeGameId(value) {
  return value === ticTacToeGameId || value === checkersGameId ? value : null;
}

function gameIdOf(view) {
  return normalizeGameId(view?.gameId) ?? ticTacToeGameId;
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

function activePlayerId(view) {
  return gameIdOf(view) === checkersGameId
    ? view.observation.activePlayerId
    : view.observation.nextPlayerId;
}

function playerRole(view, index) {
  if (gameIdOf(view) === checkersGameId) return index === 0 ? "Black" : "Red";
  return index === 0 ? "X" : "O";
}

function statusText(view) {
  const observation = view.observation;
  if (observation.status.draw) return "Draw. The board is locked.";
  if (observation.status.winnerPlayerId) {
    return observation.status.winnerPlayerId === playerId
      ? "You won. Match complete."
      : `${displayName(observation.status.winnerPlayerId)} won. Match complete.`;
  }

  const active = activePlayerId(view);
  if (active === playerId) {
    if (gameIdOf(view) === checkersGameId) {
      if (selectedPath.length > 0) return "Continue the capture sequence.";
      if (selectedPieceId) return "Choose a highlighted destination.";
      const capture = observation.mustCapture ? " Capture required." : "";
      return `Your turn — you are ${playerRole(view, view.playerIds.indexOf(playerId))}.${capture}`;
    }
    return `Your turn — you are ${playerRole(view, view.playerIds.indexOf(playerId))}.`;
  }
  return active ? `${displayName(active)} is up.` : "Match complete.";
}

function setBusy(busy) {
  requestPending = busy;
  challengeTheo.disabled = busy;
  createHumanMatch.disabled = busy;
  newMatch.disabled = busy;
  for (const gameButton of gameButtons) gameButton.disabled = busy;
  if (current) renderBoard(current);
}

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.hidden = false;
}

function clearError() {
  errorBanner.textContent = "";
  errorBanner.hidden = true;
}

function updateUrl(matchId, identity = playerId, gameId = selectedGameId) {
  const url = new URL(window.location.href);
  if (matchId) {
    url.searchParams.set("match", matchId);
    url.searchParams.set("player", identity);
    url.searchParams.set("game", gameId);
  } else {
    url.searchParams.delete("match");
    url.searchParams.delete("player");
    if (gameId === ticTacToeGameId) url.searchParams.delete("game");
    else url.searchParams.set("game", gameId);
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
  url.searchParams.set("game", gameIdOf(view));
  return { url: url.toString(), playerId: invitedPlayer };
}

function updateGamePresentation() {
  const game = games[selectedGameId];
  gameTitle.textContent = game.title;
  heroCopy.textContent = game.hero;
  theoDescription.textContent = game.theo;
  humanDescription.textContent = game.human;
  document.title = `${game.title} · Scribbles GameFrame`;
  for (const button of gameButtons) {
    const selected = button.dataset.gameId === selectedGameId;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
  if (!current) renderPlaceholderBoard();
}

function selectGame(gameId) {
  if (current || requestPending || !normalizeGameId(gameId)) return;
  selectedGameId = gameId;
  selectedPieceId = null;
  selectedPath = [];
  updateGamePresentation();
  updateUrl(null);
  lobbyMessage.textContent = `${games[gameId].title} selected. Choose how you want to play.`;
}

function renderPlayerCards(view) {
  const [firstId, secondId] = view.playerIds;
  const game = games[gameIdOf(view)];
  playerXName.textContent = displayName(firstId);
  playerOName.textContent = displayName(secondId);
  playerXSeat.textContent = game.seats[0];
  playerOSeat.textContent = game.seats[1];
  playerXBadge.textContent = game.badges[0];
  playerOBadge.textContent = game.badges[1];
  playerXBadge.className = `mark-badge ${gameIdOf(view) === checkersGameId ? "black" : "x"}`;
  playerOBadge.className = `mark-badge ${gameIdOf(view) === checkersGameId ? "red" : "o"}`;
  playerX.dataset.playerId = firstId;
  playerO.dataset.playerId = secondId;
  const active = activePlayerId(view);
  playerX.classList.toggle("is-active", active === firstId);
  playerO.classList.toggle("is-active", active === secondId);
  playerX.classList.toggle("is-you", firstId === playerId);
  playerO.classList.toggle("is-you", secondId === playerId);
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
  const previous = current;
  const authoritativeChange = !previous
    || previous.matchId !== view.matchId
    || previous.revision !== view.revision;
  current = view;
  selectedGameId = gameIdOf(view);
  if (authoritativeChange) {
    selectedPieceId = null;
    selectedPath = [];
  }

  updateGamePresentation();
  lobby.hidden = true;
  matchPanel.hidden = false;
  clearError();

  const game = games[selectedGameId];
  matchLabel.textContent = selectedGameId === checkersGameId ? "ACTIVE CHECKERS MATCH" : "ACTIVE MATCH";
  matchTitle.textContent = game.matchTitle;
  status.textContent = statusText(view);
  revision.textContent = `Revision ${view.revision}`;
  matchGameLabel.textContent = game.title;
  matchIdLabel.textContent = view.matchId;
  connectionLabel.textContent = realtimeEnabled
    ? (socket?.readyState === WebSocket.OPEN ? "Live connection" : "Connecting…")
    : "HTTP refresh";

  renderPlayerCards(view);
  renderInvite(view);
  renderBoard(view);
  details.textContent = JSON.stringify({
    gameId: selectedGameId,
    matchId: view.matchId,
    playerId,
    playerIds: view.playerIds,
    eventCount: view.eventCount,
    activePlayerId: activePlayerId(view),
    legalActionCount: view.observation.legalActions.length,
    selectedPieceId,
    selectedPath,
    realtime: realtimeEnabled ? (socket?.readyState === WebSocket.OPEN ? "connected" : "enabled") : "http-polling",
  }, null, 2);

  persistRecentMatch(view.matchId);
  updateUrl(view.matchId, playerId, selectedGameId);
  startProjection(view.matchId);
}

function renderBoard(view) {
  if (gameIdOf(view) === checkersGameId) renderCheckersBoard(view);
  else renderTicTacToeBoard(view);
}

function renderTicTacToeBoard(view) {
  board.className = "board board-tic-tac-toe";
  board.setAttribute("aria-label", "Tic-tac-toe board");
  board.replaceChildren();
  view.observation.board.forEach((mark, cell) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell tic-cell";
    button.dataset.cell = String(cell);
    button.dataset.mark = mark ?? "";
    button.textContent = mark ?? "";
    button.setAttribute("aria-label", mark ? `Cell ${cell + 1}: ${mark}` : `Cell ${cell + 1}: empty`);
    const legal = view.observation.legalActions.some((action) => action.cell === cell);
    button.disabled = requestPending || !legal;
    if (mark) button.classList.add(mark === "X" ? "mark-x" : "mark-o");
    button.addEventListener("click", () => submitAction({ type: "place", cell }));
    board.append(button);
  });
  boardHelp.textContent = activePlayerId(view) === playerId
    ? "Choose an open cell."
    : "The board updates when the active player moves.";
}

function checkersCandidates(view) {
  if (!selectedPieceId) return [];
  return view.observation.legalActions.filter((action) =>
    action.pieceId === selectedPieceId
    && selectedPath.every((square, index) => action.path[index] === square)
  );
}

function renderCheckersBoard(view) {
  board.className = "board board-checkers";
  board.setAttribute("aria-label", "American Checkers board");
  board.replaceChildren();

  const actions = view.observation.legalActions;
  if (selectedPieceId && !actions.some((action) => action.pieceId === selectedPieceId)) {
    selectedPieceId = null;
    selectedPath = [];
  }
  const candidates = checkersCandidates(view);
  const nextDestinations = new Set(
    candidates
      .map((action) => action.path[selectedPath.length])
      .filter((square) => Number.isInteger(square)),
  );
  const previewAction = selectedPath.length > 0 ? candidates[0] : null;
  const capturedPreviewIds = new Set(
    previewAction?.capturedPieceIds.slice(0, selectedPath.length) ?? [],
  );
  const originalPiece = selectedPieceId
    ? view.observation.board.find((piece) => piece?.id === selectedPieceId) ?? null
    : null;
  const previewSquare = selectedPath.at(-1);

  for (let square = 0; square < 64; square += 1) {
    const row = Math.floor(square / 8);
    const column = square % 8;
    const playable = (row + column) % 2 === 1;
    const actualPiece = view.observation.board[square];
    let visualPiece = actualPiece;
    if (actualPiece && capturedPreviewIds.has(actualPiece.id)) visualPiece = null;
    if (selectedPath.length > 0 && actualPiece?.id === selectedPieceId) visualPiece = null;
    if (selectedPath.length > 0 && square === previewSquare) visualPiece = originalPiece;

    const selectable = selectedPath.length === 0
      && actions.some((action) => action.from === square);
    const destination = nextDestinations.has(square);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `cell checkers-cell ${playable ? "dark-square" : "light-square"}`;
    button.dataset.cell = String(square);
    button.dataset.pieceId = visualPiece?.id ?? "";
    button.disabled = requestPending || (!selectable && !destination);
    button.classList.toggle("selectable-piece", selectable);
    button.classList.toggle("selected-piece", visualPiece?.id === selectedPieceId || square === previewSquare);
    button.classList.toggle("legal-destination", destination);
    button.classList.toggle("selected-path", selectedPath.includes(square));

    if (visualPiece) {
      const token = document.createElement("span");
      token.className = `checkers-piece piece-${visualPiece.color}${visualPiece.rank === "king" ? " is-king" : ""}`;
      token.textContent = visualPiece.rank === "king" ? "K" : "";
      token.setAttribute("aria-hidden", "true");
      button.append(token);
    }

    const coordinate = `${String.fromCharCode(65 + column)}${8 - row}`;
    const pieceLabel = visualPiece
      ? `${visualPiece.color} ${visualPiece.rank} ${visualPiece.id}`
      : "empty";
    button.setAttribute("aria-label", `${coordinate}: ${pieceLabel}`);
    if (destination) {
      button.addEventListener("click", () => advanceCheckersPath(square));
    } else if (selectable) {
      button.addEventListener("click", () => selectCheckersPiece(actualPiece.id));
    }
    board.append(button);
  }

  if (view.observation.status.lifecycle !== "active") {
    boardHelp.textContent = "This match is complete.";
  } else if (activePlayerId(view) !== playerId) {
    boardHelp.textContent = "The board updates when the active player moves.";
  } else if (selectedPath.length > 0) {
    boardHelp.textContent = "Continue along a highlighted capture path.";
  } else if (selectedPieceId) {
    boardHelp.textContent = "Choose a highlighted destination.";
  } else if (view.observation.mustCapture) {
    boardHelp.textContent = "Capture required. Select a highlighted piece.";
  } else {
    boardHelp.textContent = "Select a highlighted piece, then choose its destination.";
  }
}

function renderInteractionState() {
  if (!current) return;
  status.textContent = statusText(current);
  renderBoard(current);
}

function selectCheckersPiece(pieceId) {
  if (!current || requestPending || activePlayerId(current) !== playerId) return;
  selectedPieceId = selectedPieceId === pieceId ? null : pieceId;
  selectedPath = [];
  clearError();
  renderInteractionState();
}

function advanceCheckersPath(square) {
  if (!current || !selectedPieceId || requestPending) return;
  const nextPath = [...selectedPath, square];
  const matching = current.observation.legalActions.filter((action) =>
    action.pieceId === selectedPieceId
    && nextPath.every((pathSquare, index) => action.path[index] === pathSquare)
  );
  if (matching.length === 0) {
    selectedPieceId = null;
    selectedPath = [];
    showError("That Checkers path is no longer legal. Select a piece again.");
    renderInteractionState();
    return;
  }

  const complete = matching.find((action) => action.path.length === nextPath.length);
  const continues = matching.some((action) => action.path.length > nextPath.length);
  if (complete && !continues) {
    selectedPieceId = null;
    selectedPath = [];
    void submitAction(complete);
    return;
  }

  selectedPath = nextPath;
  renderInteractionState();
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
  lobbyMessage.textContent = `Creating an authoritative ${games[selectedGameId].shortTitle} match…`;
  setBusy(true);
  try {
    const view = await request("/api/matches", {
      method: "POST",
      body: JSON.stringify({
        gameId: selectedGameId,
        playerIds: [playerId, opponentId],
      }),
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

async function submitAction(action) {
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
        action,
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
  selectedPieceId = null;
  selectedPath = [];
  clearRecentMatch();
  clearError();
  updateUrl(null);
  matchPanel.hidden = true;
  lobby.hidden = false;
  lobbyMessage.textContent = `${games[selectedGameId].title} selected. Choose how you want to play.`;
  updateGamePresentation();
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
  if (selectedGameId === checkersGameId) {
    board.className = "board board-checkers placeholder-board";
    board.setAttribute("aria-label", "American Checkers board preview");
    for (let square = 0; square < 64; square += 1) {
      const row = Math.floor(square / 8);
      const column = square % 8;
      const placeholder = document.createElement("button");
      placeholder.type = "button";
      placeholder.className = `cell checkers-cell ${(row + column) % 2 === 1 ? "dark-square" : "light-square"}`;
      placeholder.dataset.cell = String(square);
      placeholder.disabled = true;
      placeholder.setAttribute("aria-label", `Checkers preview square ${square + 1}`);
      board.append(placeholder);
    }
    boardHelp.textContent = "Select an opponent to begin Checkers.";
    return;
  }

  board.className = "board board-tic-tac-toe placeholder-board";
  board.setAttribute("aria-label", "Tic-tac-toe board preview");
  for (let index = 0; index < 9; index += 1) {
    const placeholder = document.createElement("button");
    placeholder.type = "button";
    placeholder.className = "cell tic-cell";
    placeholder.dataset.cell = String(index);
    placeholder.dataset.mark = "";
    placeholder.disabled = true;
    placeholder.setAttribute("aria-label", `Cell ${index + 1}: unavailable`);
    board.append(placeholder);
  }
  boardHelp.textContent = "Select an opponent to begin Tic-Tac-Toe.";
}

for (const gameButton of gameButtons) {
  gameButton.addEventListener("click", () => selectGame(gameButton.dataset.gameId));
}
challengeTheo.addEventListener("click", () => createMatch(theoPlayerId));
createHumanMatch.addEventListener("click", () => createMatch(`guest-${crypto.randomUUID()}`));
newMatch.addEventListener("click", leaveMatch);
copyInvite.addEventListener("click", copyInviteLink);
window.addEventListener("beforeunload", stopProjection);

updateGamePresentation();
await detectRuntime();

const requestedMatchId = normalizeIdentity(urlState.get("match"));
const recentMatchId = explicitPlayerId ? null : normalizeIdentity(window.localStorage.getItem(recentMatchStorageKey));
if (requestedMatchId ?? recentMatchId) {
  await loadMatch(requestedMatchId ?? recentMatchId);
} else {
  lobbyMessage.textContent = `${games[selectedGameId].title} selected. Choose how you want to play.`;
}
