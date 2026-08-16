(() => {
  const storageKey = "scribbles-gameframe.othello.local-match.v1";
  const remoteRefreshFallbackMs = 60_000;
  const invitationRefreshFallbackMs = 60_000;
  const app = document.querySelector(".othello-app");
  const controls = document.querySelector(".command-bar .controls");
  const demoMove = document.querySelector("#demo-move");
  const darkName = document.querySelector(".score-rail-dark > span");
  const lightName = document.querySelector(".score-rail-light > span");
  const parameters = new URLSearchParams(window.location.search);
  const remoteMatchId = parameters.get("match");
  let mode = null;
  let botTimer = null;
  let remoteTimer = null;
  let remoteView = null;
  let remoteBusy = false;
  let playerEventsConnected = Boolean(window.gameFrameAlerts?.playerEventsConnected?.());
  let rematchBusy = false;
  let rematchSentForMatchId = null;
  let rematchButton = null;
  let invitationTimer = null;
  let pendingInvitation = null;
  let invitationBusy = false;

  function validBoard(board) {
    return Array.isArray(board)
      && board.length === SIZE
      && board.every((row) => Array.isArray(row)
        && row.length === SIZE
        && row.every((cell) => cell === DARK || cell === LIGHT || cell === EMPTY));
  }

  function markStorageUnavailable() {
    document.body.dataset.gameframeStorageUnavailable = "true";
    delete document.body.dataset.gameframeMatchPersisted;
  }

  function readSave() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (!saved || !validBoard(saved.state?.board)) return null;
      if (saved.mode !== "bot" && saved.mode !== "local") return null;
      return saved;
    } catch {
      markStorageUnavailable();
      return null;
    }
  }

  function persist() {
    if (!mode || mode === "remote" || snapshotMode) return false;
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        version: 1,
        mode,
        theme,
        hints,
        state: {
          board: state.board,
          player: state.player,
          move: state.move,
          complete: state.complete,
          lastMove: state.lastMove,
        },
      }));
      document.body.dataset.gameframeMatchPersisted = "true";
      delete document.body.dataset.gameframeStorageUnavailable;
      return true;
    } catch {
      markStorageUnavailable();
      return false;
    }
  }

  function restore(saved) {
    stopRemoteRefresh();
    stopInvitationFollow();
    pendingInvitation = null;
    mode = saved.mode;
    remoteView = null;
    rematchSentForMatchId = null;
    state = {
      board: saved.state.board.map((row) => [...row]),
      player: saved.state.player === LIGHT ? LIGHT : DARK,
      move: Number.isInteger(saved.state.move) ? saved.state.move : 0,
      complete: Boolean(saved.state.complete),
      lastMove: Array.isArray(saved.state.lastMove) ? [...saved.state.lastMove] : null,
    };
    hints = saved.hints !== false;
    flipAnimation = null;
    hover = null;
    setTheme(saved.theme || "obsidian");
    hintButton.querySelector("span").textContent = hints ? "Hints on" : "Hints off";
    hintButton.setAttribute("aria-pressed", String(hints));
    updateUi();
    closeMenu();
    updateModeLabels();
    resetInvitationControls();
    updateRematchControl();
    scheduleBotTurn();
  }

  function currentIdentity() {
    return window.gameFrameIdentity || null;
  }

  function invitationStatusElement() {
    return menu.querySelector("[data-othello-online-status]");
  }

  function invitationPickerElement() {
    return menu.querySelector("[data-othello-player-picker]");
  }

  function stopInvitationFollow() {
    if (invitationTimer !== null) window.clearTimeout(invitationTimer);
    invitationTimer = null;
  }

  function scheduleInvitationRefresh() {
    stopInvitationFollow();
    if (
      !pendingInvitation
      || playerEventsConnected
      || document.visibilityState !== "visible"
    ) return;
    invitationTimer = window.setTimeout(async () => {
      invitationTimer = null;
      await refreshPendingInvitation();
      scheduleInvitationRefresh();
    }, invitationRefreshFallbackMs);
  }

  function setInvitationControlsDisabled(disabled) {
    [
      "#othello-challenge-player",
      "#othello-play-bot",
      "#othello-play-local",
      "#othello-resume",
    ].forEach((selector) => {
      const button = menu.querySelector(selector);
      if (button) button.disabled = disabled;
    });
    const cancel = menu.querySelector("#othello-cancel-challenge");
    if (cancel) {
      cancel.hidden = !disabled;
      cancel.style.display = disabled ? "" : "none";
    }
  }

  function resetInvitationControls() {
    setInvitationControlsDisabled(false);
    const picker = invitationPickerElement();
    if (picker) {
      picker.replaceChildren();
      picker.hidden = true;
    }
    delete document.body.dataset.othelloInvitationStatus;
  }

  function updateInvitationWaitingUi() {
    if (!pendingInvitation) return;
    const status = invitationStatusElement();
    const picker = invitationPickerElement();
    const { playerName, source } = pendingInvitation;
    setInvitationControlsDisabled(true);
    document.body.dataset.othelloInvitationStatus = "pending";
    if (picker) {
      picker.replaceChildren();
      const heading = document.createElement("strong");
      heading.textContent = `Waiting for ${playerName}`;
      const detail = document.createElement("small");
      detail.textContent = "The board will open automatically as soon as they accept.";
      picker.append(heading, detail);
      picker.hidden = false;
    }
    if (status) {
      status.textContent = source === "rematch"
        ? `Rematch sent to ${playerName}. Waiting for them to accept…`
        : `Challenge sent to ${playerName}. Waiting for them to accept…`;
    }
    if (source === "rematch") {
      announcement.textContent = `Rematch challenge sent to ${playerName}. Waiting for them to accept.`;
      announcement.hidden = false;
    }
    updateRematchControl();
  }

  function invitationTerminalMessage(invitationStatus, playerName) {
    if (invitationStatus === "declined") return `${playerName} declined the Othello challenge.`;
    if (invitationStatus === "expired") return `The Othello challenge to ${playerName} expired.`;
    return `The Othello challenge to ${playerName} was cancelled.`;
  }

  function finishPendingInvitation(invitationStatus, message = null) {
    const completed = pendingInvitation;
    if (!completed) return;
    stopInvitationFollow();
    pendingInvitation = null;
    invitationBusy = false;
    if (completed.source === "rematch" && rematchSentForMatchId === completed.originMatchId) {
      rematchSentForMatchId = null;
    }
    resetInvitationControls();
    const finalMessage = message || invitationTerminalMessage(invitationStatus, completed.playerName);
    const status = invitationStatusElement();
    if (status) status.textContent = finalMessage;
    if (completed.source === "rematch") {
      announcement.textContent = finalMessage;
      announcement.hidden = false;
    }
    updateRematchControl();
    void renderOpenGames();
  }

  async function refreshPendingInvitation() {
    if (!pendingInvitation || invitationBusy) return;
    const expectedInvitationId = pendingInvitation.invitationId;
    invitationBusy = true;
    try {
      const body = await responseJson(
        await fetch(`/api/invitations/${encodeURIComponent(expectedInvitationId)}`, {
          credentials: "same-origin",
        }),
        "Othello invitation",
      );
      if (pendingInvitation?.invitationId !== expectedInvitationId) return;
      const invitationStatus = body.invitation?.status;
      if (invitationStatus === "claimed" && body.resumePath) {
        const accepted = pendingInvitation;
        stopInvitationFollow();
        pendingInvitation = null;
        resetInvitationControls();
        document.body.dataset.othelloInvitationStatus = "claimed";
        const status = invitationStatusElement();
        const acceptedMessage = `${accepted.playerName} accepted. Opening the Othello board…`;
        if (status) status.textContent = acceptedMessage;
        if (accepted.source === "rematch") {
          announcement.textContent = acceptedMessage;
          announcement.hidden = false;
        }
        window.location.assign(body.resumePath);
        return;
      }
      if (["declined", "cancelled", "expired"].includes(invitationStatus)) {
        finishPendingInvitation(invitationStatus);
      }
    } catch {
      if (pendingInvitation?.invitationId !== expectedInvitationId) return;
      const status = invitationStatusElement();
      if (status) status.textContent = `Still waiting for ${pendingInvitation.playerName}. Reconnecting…`;
      if (pendingInvitation.source === "rematch") {
        announcement.textContent = `Still waiting for ${pendingInvitation.playerName}. Reconnecting…`;
        announcement.hidden = false;
      }
    } finally {
      if (pendingInvitation?.invitationId === expectedInvitationId) invitationBusy = false;
    }
  }

  function beginInvitationFollow(created, { playerName, source, originMatchId = null }) {
    const invitationId = created?.invitation?.invitationId;
    if (!invitationId) throw new Error("The Othello challenge did not return an invitation ID.");
    stopInvitationFollow();
    pendingInvitation = {
      invitationId,
      playerName,
      source,
      originMatchId,
    };
    invitationBusy = false;
    updateInvitationWaitingUi();
    scheduleInvitationRefresh();
  }

  async function cancelPendingInvitation() {
    if (!pendingInvitation || invitationBusy) return;
    const expectedInvitationId = pendingInvitation.invitationId;
    const playerName = pendingInvitation.playerName;
    stopInvitationFollow();
    invitationBusy = true;
    const status = invitationStatusElement();
    if (status) status.textContent = `Cancelling challenge to ${playerName}…`;
    try {
      await responseJson(await fetch(`/api/invitations/${encodeURIComponent(expectedInvitationId)}/cancel`, {
        method: "POST",
        credentials: "same-origin",
      }), "Cancel Othello challenge");
      if (pendingInvitation?.invitationId === expectedInvitationId) {
        finishPendingInvitation("cancelled", `Challenge to ${playerName} cancelled.`);
      }
    } catch {
      if (pendingInvitation?.invitationId !== expectedInvitationId) return;
      invitationBusy = false;
      if (status) status.textContent = `Could not cancel the challenge to ${playerName}. Checking its status…`;
      await refreshPendingInvitation();
      scheduleInvitationRefresh();
    }
  }

  function remoteOpponentPlayerId() {
    const playerIds = remoteView?.playerIds;
    if (!Array.isArray(playerIds) || playerIds.length !== 2) return null;
    const identity = currentIdentity();
    if (identity?.playerId && playerIds.includes(identity.playerId)) {
      return playerIds.find((playerId) => playerId !== identity.playerId) || null;
    }
    const yourDisc = remoteView?.observation?.yourDisc;
    if (yourDisc === DARK) return playerIds[1] || null;
    if (yourDisc === LIGHT) return playerIds[0] || null;
    return null;
  }

  function remoteOpponentName() {
    const opponentId = remoteOpponentPlayerId();
    if (!opponentId) return "Opponent";
    const directory = window.gameFrameKnownPlayers || [];
    return directory.find((player) => player.playerId === opponentId)?.displayName || "Opponent";
  }

  function updateRematchControl() {
    if (!rematchButton) return;
    const finishedRemoteMatch = mode === "remote" && state.complete && remoteView?.matchId;
    const opponentId = finishedRemoteMatch ? remoteOpponentPlayerId() : null;
    rematchButton.hidden = !finishedRemoteMatch || !opponentId;
    if (rematchButton.hidden) return;
    const waiting = pendingInvitation?.source === "rematch"
      && pendingInvitation.originMatchId === remoteView.matchId;
    const alreadySent = rematchSentForMatchId === remoteView.matchId;
    rematchButton.disabled = rematchBusy || waiting || alreadySent;
    rematchButton.querySelector("span").textContent = rematchBusy
      ? "Sending rematch…"
      : waiting
        ? `Waiting for ${pendingInvitation.playerName}…`
        : alreadySent
          ? "Rematch sent"
          : "Rematch";
  }

  function updateModeLabels() {
    document.body.dataset.othelloMode = mode || "menu";
    if (mode === "remote" && remoteView) {
      const yourDisc = remoteView.observation?.yourDisc;
      const opponent = remoteOpponentName();
      if (darkName) darkName.textContent = yourDisc === DARK ? "You" : opponent;
      if (lightName) lightName.textContent = yourDisc === LIGHT ? "You" : opponent;
    } else {
      if (darkName) darkName.textContent = mode === "bot" ? "You" : "Dark";
      if (lightName) lightName.textContent = mode === "bot" ? "OthelloBot" : "Light";
    }
    updateRematchControl();
    window.gameFrameDestinationBar?.sync?.();
  }

  function closeMenu() {
    document.body.classList.remove("othello-menu-open");
    menu.hidden = true;
  }

  function showMenu() {
    clearTimeout(botTimer);
    document.body.classList.add("othello-menu-open");
    menu.hidden = false;
    const saved = readSave();
    resumeButton.hidden = !saved;
    if (saved) {
      const savedMode = saved.mode === "bot" ? "OthelloBot match" : "local match";
      resumeButton.querySelector("small").textContent = `Continue ${savedMode} from move ${saved.state.move}.`;
    }
    updateModeLabels();
    if (pendingInvitation) updateInvitationWaitingUi();
    void renderOpenGames();
  }

  function startNew(nextMode) {
    if (pendingInvitation) return;
    stopRemoteRefresh();
    clearTimeout(botTimer);
    mode = nextMode;
    remoteView = null;
    rematchSentForMatchId = null;
    state = createState();
    flipAnimation = null;
    hover = null;
    updateUi();
    closeMenu();
    updateModeLabels();
    persist();
  }

  function scheduleBotTurn() {
    clearTimeout(botTimer);
    if (mode !== "bot" || state.complete || state.player !== LIGHT || snapshotMode) return;
    const delay = flipAnimation ? flipAnimation.duration + 100 : 260;
    botTimer = setTimeout(() => {
      if (mode !== "bot" || state.complete || state.player !== LIGHT || flipAnimation) {
        scheduleBotTurn();
        return;
      }
      const move = selectComputerMove();
      if (move) applyMove(move);
    }, delay);
  }

  async function responseJson(response, context) {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || `${context} failed with HTTP ${response.status}.`);
    return body;
  }

  function hydrateRemote(view) {
    if (!view?.observation || !validBoard(view.observation.board)) throw new Error("Othello match returned an invalid board.");
    remoteView = view;
    mode = "remote";
    state = {
      board: view.observation.board.map((row) => [...row]),
      player: view.observation.nextDisc === LIGHT ? LIGHT : DARK,
      move: Number.isInteger(view.observation.move) ? view.observation.move : 0,
      complete: view.observation.status?.lifecycle === "completed",
      lastMove: Array.isArray(view.observation.lastMove) ? [...view.observation.lastMove] : null,
    };
    flipAnimation = null;
    hover = null;
    updateUi();
    closeMenu();
    updateModeLabels();
    document.body.dataset.gameframeRemoteMatch = view.matchId;
    scheduleRemoteRefresh();
  }

  async function loadRemoteMatch() {
    if (!remoteMatchId || remoteBusy) return;
    remoteBusy = true;
    try {
      const view = await responseJson(
        await fetch(`/api/matches/${encodeURIComponent(remoteMatchId)}`, { credentials: "same-origin" }),
        "Othello match",
      );
      hydrateRemote(view);
      await loadKnownPlayers();
      updateModeLabels();
    } catch (error) {
      showMenu();
      const status = invitationStatusElement();
      if (status) status.textContent = error instanceof Error ? error.message : "The online match could not be loaded.";
    } finally {
      remoteBusy = false;
    }
  }

  async function submitRemoteMove(move) {
    if (!remoteView || remoteBusy) return;
    const legal = remoteView.observation.legalActions?.some((action) => action.row === move.row && action.column === move.column);
    if (!legal) return;
    remoteBusy = true;
    try {
      const view = await responseJson(
        await fetch(`/api/matches/${encodeURIComponent(remoteView.matchId)}/actions`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            actionId: crypto.randomUUID(),
            expectedRevision: remoteView.revision,
            action: { type: "place", row: move.row, column: move.column },
          }),
        }),
        "Othello move",
      );
      hydrateRemote(view);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The move could not be submitted.";
      announcement.textContent = message;
      announcement.hidden = false;
      await loadRemoteMatch();
    } finally {
      remoteBusy = false;
    }
  }

  async function sendRematch() {
    if (!remoteView || !state.complete || rematchBusy || rematchSentForMatchId === remoteView.matchId) return;
    const opponentId = remoteOpponentPlayerId();
    if (!opponentId) return;
    rematchBusy = true;
    updateRematchControl();
    try {
      const created = await responseJson(await fetch("/api/invitations", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameId: "othello", targetPlayerId: opponentId }),
      }), "Othello rematch");
      rematchSentForMatchId = remoteView.matchId;
      beginInvitationFollow(created, {
        playerName: remoteOpponentName(),
        source: "rematch",
        originMatchId: remoteView.matchId,
      });
    } catch (error) {
      announcement.textContent = error instanceof Error ? error.message : "The rematch challenge could not be sent.";
      announcement.hidden = false;
    } finally {
      rematchBusy = false;
      updateRematchControl();
    }
  }

  function stopRemoteRefresh() {
    if (remoteTimer !== null) window.clearTimeout(remoteTimer);
    remoteTimer = null;
  }

  function scheduleRemoteRefresh() {
    stopRemoteRefresh();
    if (
      mode !== "remote"
      || state.complete
      || playerEventsConnected
      || document.visibilityState !== "visible"
    ) return;
    remoteTimer = window.setTimeout(async () => {
      remoteTimer = null;
      await loadRemoteMatch();
      scheduleRemoteRefresh();
    }, remoteRefreshFallbackMs);
  }

  async function loadKnownPlayers() {
    try {
      const body = await responseJson(await fetch("/api/players", { credentials: "same-origin" }), "Player directory");
      window.gameFrameKnownPlayers = Array.isArray(body.players) ? body.players : [];
      return window.gameFrameKnownPlayers;
    } catch {
      window.gameFrameKnownPlayers = [];
      return [];
    }
  }

  function playerDiscordId(playerId) {
    const match = /^discord:(\d+)$/.exec(playerId || "");
    return match?.[1] || null;
  }

  async function sendChallenge(player) {
    const status = invitationStatusElement();
    const discordId = playerDiscordId(player.playerId);
    if (!discordId || pendingInvitation) return;
    if (status) status.textContent = `Sending Othello challenge to ${player.displayName || "player"}…`;
    try {
      const created = await responseJson(await fetch("/api/invitations", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameId: "othello", targetDiscordUserId: discordId }),
      }), "Othello challenge");
      beginInvitationFollow(created, {
        playerName: player.displayName || "player",
        source: "challenge",
      });
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : "The challenge could not be sent.";
    }
  }

  async function openPlayerPicker() {
    if (pendingInvitation) {
      updateInvitationWaitingUi();
      return;
    }
    const picker = invitationPickerElement();
    const players = await loadKnownPlayers();
    picker.replaceChildren();
    if (!players.length) {
      const empty = document.createElement("p");
      empty.textContent = "No other signed-in GameFrame players are known yet. Once they sign in, they will appear here.";
      picker.append(empty);
      picker.hidden = false;
      return;
    }
    for (const player of players) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "othello-player-choice";
      button.innerHTML = `<strong>${player.displayName || "GameFrame player"}</strong><small>Challenge to Othello</small>`;
      button.addEventListener("click", () => void sendChallenge(player));
      picker.append(button);
    }
    picker.hidden = false;
  }

  function gameTitle(gameId) {
    if (gameId === "othello") return "Othello";
    if (gameId === "american-checkers") return "Clockwork Checkers";
    if (gameId === "tic-tac-toe") return "Tic-Tac-Toe";
    return gameId;
  }

  async function renderOpenGames() {
    const container = menu.querySelector("[data-othello-open-games]");
    if (!container) return;
    try {
      const feed = await responseJson(await fetch("/api/me/feed", { credentials: "same-origin" }), "Open games");
      const identity = currentIdentity();
      const games = (feed.matches || []).filter((match) => match.gameId === "othello" && match.lifecycle === "active");
      container.replaceChildren();
      if (!games.length) {
        const empty = document.createElement("p");
        empty.textContent = "No open Othello games.";
        container.append(empty);
        return;
      }
      for (const match of games) {
        const link = document.createElement("a");
        link.href = match.resumePath;
        const turn = match.activePlayerId === identity?.playerId ? "YOUR TURN" : "WAITING";
        link.innerHTML = `<strong>${turn}</strong><span>${gameTitle(match.gameId)} · Revision ${match.revision}</span>`;
        container.append(link);
      }
    } catch {
      container.textContent = "Open games unavailable.";
    }
  }

  const baseApplyMove = applyMove;
  applyMove = function applyOthelloMove(move, animate = true) {
    if (mode === "remote") {
      void submitRemoteMove(move);
      return false;
    }
    const changed = baseApplyMove(move, animate);
    if (changed) {
      persist();
      updateModeLabels();
      scheduleBotTurn();
    }
    return changed;
  };

  const menu = document.createElement("section");
  menu.id = "othello-game-menu";
  menu.className = "othello-game-menu";
  menu.setAttribute("aria-labelledby", "othello-game-menu-title");
  menu.innerHTML = `
    <div class="othello-game-menu-card">
      <p class="othello-menu-kicker">OTHELLO</p>
      <h2 id="othello-game-menu-title">Choose how to play</h2>
      <p>Start an online challenge, play OthelloBot, share the board locally, or resume one of your open games.</p>
      <div class="othello-open-games-block">
        <strong>Open games</strong>
        <div class="othello-open-games" data-othello-open-games><p>Loading open games…</p></div>
        <a class="othello-all-matches" href="/matches.html?game=othello">View all matches</a>
      </div>
      <div class="othello-menu-actions">
        <button id="othello-challenge-player" type="button">
          <strong>Challenge a player</strong>
          <small>Start a persistent game and take turns whenever you are available.</small>
        </button>
        <div class="othello-player-picker" data-othello-player-picker hidden></div>
        <button id="othello-cancel-challenge" type="button" hidden style="display:none">
          <strong>Cancel challenge</strong>
          <small>Withdraw this invitation before the other player accepts.</small>
        </button>
        <button id="othello-play-bot" type="button">
          <strong>Challenge OthelloBot</strong>
          <small>Play Dark against a deterministic local opponent.</small>
        </button>
        <button id="othello-play-local" type="button">
          <strong>Pass &amp; play</strong>
          <small>Two players share this board and alternate turns.</small>
        </button>
        <button id="othello-resume" type="button">
          <strong>Resume saved local match</strong>
          <small>Continue the last local game.</small>
        </button>
      </div>
      <p class="othello-online-status" data-othello-online-status role="status" aria-live="polite"></p>
      <a href="/?catalog=1">Back to Games</a>
    </div>
  `;
  app?.prepend(menu);

  const resumeButton = menu.querySelector("#othello-resume");
  menu.querySelector("#othello-challenge-player")?.addEventListener("click", () => void openPlayerPicker());
  menu.querySelector("#othello-cancel-challenge")?.addEventListener("click", () => void cancelPendingInvitation());
  menu.querySelector("#othello-play-bot")?.addEventListener("click", () => startNew("bot"));
  menu.querySelector("#othello-play-local")?.addEventListener("click", () => startNew("local"));
  resumeButton?.addEventListener("click", () => {
    const saved = readSave();
    if (saved) restore(saved);
  });

  demoMove?.remove();
  if (controls && !document.querySelector("#othello-open-menu")) {
    const menuButton = document.createElement("button");
    menuButton.id = "othello-open-menu";
    menuButton.className = "control-button secondary-control";
    menuButton.type = "button";
    menuButton.innerHTML = "<span>Game menu</span>";
    menuButton.addEventListener("click", showMenu);
    controls.prepend(menuButton);
  }
  if (controls && remoteMatchId && !document.querySelector("#othello-rematch")) {
    rematchButton = document.createElement("button");
    rematchButton.id = "othello-rematch";
    rematchButton.className = "control-button";
    rematchButton.type = "button";
    rematchButton.hidden = true;
    rematchButton.innerHTML = "<span>Rematch</span>";
    rematchButton.addEventListener("click", () => void sendRematch());
    controls.prepend(rematchButton);
  } else {
    rematchButton = document.querySelector("#othello-rematch");
  }

  canvas.addEventListener("pointerdown", (event) => {
    const remoteWaiting = mode === "remote" && (!remoteView?.observation?.legalActions?.length || remoteBusy);
    if (document.body.classList.contains("othello-menu-open") || (mode === "bot" && state.player === LIGHT) || remoteWaiting) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  document.querySelector("#new-game")?.addEventListener("click", (event) => {
    if (mode === "remote") {
      event.preventDefault();
      event.stopImmediatePropagation();
      showMenu();
      return;
    }
    clearTimeout(botTimer);
    persist();
    updateModeLabels();
  }, true);
  document.querySelectorAll(".theme-button").forEach((button) => button.addEventListener("click", persist));
  hintButton.addEventListener("click", persist);
  document.addEventListener("gameframe:before-home", persist);

  window.addEventListener("gameframe:player-events-ready", () => {
    playerEventsConnected = true;
    stopRemoteRefresh();
    stopInvitationFollow();
    if (pendingInvitation) void refreshPendingInvitation();
    if (mode === "remote" && !state.complete && document.visibilityState === "visible") {
      void loadRemoteMatch();
    }
  });
  window.addEventListener("gameframe:player-events-disconnected", () => {
    playerEventsConnected = false;
    scheduleInvitationRefresh();
    scheduleRemoteRefresh();
  });
  window.addEventListener("gameframe:player-event", (event) => {
    const topics = Array.isArray(event.detail?.topics) ? event.detail.topics : [];
    if (topics.includes("invitations") && pendingInvitation) {
      void refreshPendingInvitation();
    }
    if (
      topics.includes("matches")
      && mode === "remote"
      && !state.complete
      && document.visibilityState === "visible"
    ) {
      void loadRemoteMatch();
    }
  });
  window.addEventListener("focus", () => {
    if (pendingInvitation) void refreshPendingInvitation();
    if (mode === "remote" && !state.complete) void loadRemoteMatch();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      playerEventsConnected = Boolean(window.gameFrameAlerts?.playerEventsConnected?.());
      if (pendingInvitation) {
        void refreshPendingInvitation();
        scheduleInvitationRefresh();
      }
      if (mode === "remote") {
        void loadRemoteMatch();
        scheduleRemoteRefresh();
      }
      return;
    }
    stopInvitationFollow();
    stopRemoteRefresh();
  });

  if (snapshotMode) {
    menu.remove();
    mode = "local";
    updateModeLabels();
  } else if (remoteMatchId) {
    state = createState();
    flipAnimation = null;
    updateUi();
    mode = "remote";
    closeMenu();
    updateModeLabels();
    void loadRemoteMatch();
  } else {
    state = createState();
    flipAnimation = null;
    updateUi();
    showMenu();
  }

  window.gameFrameOthello = Object.freeze({
    showMenu,
    startBot: () => startNew("bot"),
    startLocal: () => startNew("local"),
    loadRemote: loadRemoteMatch,
    rematch: sendRematch,
    refreshInvitation: refreshPendingInvitation,
    cancelInvitation: cancelPendingInvitation,
    resume: () => {
      const saved = readSave();
      if (saved) restore(saved);
    },
    persist,
  });
})();