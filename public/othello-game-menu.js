(() => {
  const storageKey = "scribbles-gameframe.othello.local-match.v1";
  const app = document.querySelector(".othello-app");
  const controls = document.querySelector(".command-bar .controls");
  const demoMove = document.querySelector("#demo-move");
  const darkName = document.querySelector(".score-rail-dark > span");
  const lightName = document.querySelector(".score-rail-light > span");
  let mode = null;
  let botTimer = null;

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
    if (!mode || snapshotMode) return false;
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
    mode = saved.mode;
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
    scheduleBotTurn();
  }

  function updateModeLabels() {
    document.body.dataset.othelloMode = mode || "menu";
    if (darkName) darkName.textContent = mode === "bot" ? "You" : "Dark";
    if (lightName) lightName.textContent = mode === "bot" ? "OthelloBot" : "Light";
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
  }

  function startNew(nextMode) {
    clearTimeout(botTimer);
    mode = nextMode;
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

  const baseApplyMove = applyMove;
  applyMove = function applyOthelloMove(move, animate = true) {
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
      <p>Begin from the standard opening position. Local matches are saved automatically when browser storage is available.</p>
      <div class="othello-menu-actions">
        <button id="othello-play-bot" type="button">
          <strong>Challenge OthelloBot</strong>
          <small>Play Dark against a deterministic local opponent.</small>
        </button>
        <button id="othello-play-local" type="button">
          <strong>Pass &amp; play</strong>
          <small>Two players share this board and alternate turns.</small>
        </button>
        <button id="othello-resume" type="button">
          <strong>Resume saved match</strong>
          <small>Continue the last local game.</small>
        </button>
      </div>
      <a href="/">Back to game library</a>
    </div>
  `;
  app?.prepend(menu);

  const resumeButton = menu.querySelector("#othello-resume");
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

  canvas.addEventListener("pointerdown", (event) => {
    if (document.body.classList.contains("othello-menu-open") || (mode === "bot" && state.player === LIGHT)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  document.querySelector("#new-game")?.addEventListener("click", () => {
    clearTimeout(botTimer);
    persist();
    updateModeLabels();
  });
  document.querySelectorAll(".theme-button").forEach((button) => button.addEventListener("click", persist));
  hintButton.addEventListener("click", persist);
  document.addEventListener("gameframe:before-home", persist);

  if (snapshotMode) {
    menu.remove();
    mode = "local";
    updateModeLabels();
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
    resume: () => {
      const saved = readSave();
      if (saved) restore(saved);
    },
    persist,
  });
})();
