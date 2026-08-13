export function createLocalCheckersBoardRenderer({ board, help, onMove }) {
  let selectedPieceId = null;
  let selectedPath = [];

  function candidates(view) {
    if (!selectedPieceId) return [];
    return view.observation.legalActions.filter((action) =>
      action.pieceId === selectedPieceId
      && selectedPath.every((square, index) => action.path[index] === square)
    );
  }

  function render(view) {
    board.className = "board board-checkers";
    board.setAttribute("aria-label", "American Checkers local board");
    board.replaceChildren();
    const actions = view.observation.legalActions;
    if (selectedPieceId && !actions.some((action) => action.pieceId === selectedPieceId)) {
      selectedPieceId = null;
      selectedPath = [];
    }
    const matching = candidates(view);
    const destinations = new Set(matching.map((action) => action.path[selectedPath.length]).filter(Number.isInteger));
    const previewAction = selectedPath.length ? matching[0] : null;
    const previewCaptures = new Set(previewAction?.capturedPieceIds.slice(0, selectedPath.length) || []);
    const originalPiece = selectedPieceId
      ? view.observation.board.find((piece) => piece?.id === selectedPieceId) || null
      : null;
    const previewSquare = selectedPath.at(-1);

    for (let square = 0; square < 64; square += 1) {
      const row = Math.floor(square / 8);
      const column = square % 8;
      const actualPiece = view.observation.board[square];
      let visualPiece = actualPiece;
      if (actualPiece && previewCaptures.has(actualPiece.id)) visualPiece = null;
      if (selectedPath.length && actualPiece?.id === selectedPieceId) visualPiece = null;
      if (selectedPath.length && square === previewSquare) visualPiece = originalPiece;
      const selectable = selectedPath.length === 0 && actions.some((action) => action.from === square);
      const destination = destinations.has(square);

      const button = document.createElement("button");
      button.type = "button";
      button.className = `cell checkers-cell ${(row + column) % 2 === 1 ? "dark-square" : "light-square"}`;
      button.dataset.cell = String(square);
      button.dataset.pieceId = visualPiece?.id || "";
      button.disabled = !selectable && !destination;
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
      button.setAttribute("aria-label", `${coordinate}: ${visualPiece ? `${visualPiece.color} ${visualPiece.rank}` : "empty"}`);
      if (destination) button.addEventListener("click", () => advance(view, square));
      else if (selectable) button.addEventListener("click", () => {
        selectedPieceId = selectedPieceId === actualPiece.id ? null : actualPiece.id;
        selectedPath = [];
        render(view);
      });
      board.append(button);
    }

    if (view.observation.status.lifecycle !== "active") help.textContent = "This local game is complete.";
    else if (selectedPath.length) help.textContent = "Continue along a highlighted capture path.";
    else if (selectedPieceId) help.textContent = "Choose a highlighted destination.";
    else if (view.observation.mustCapture) help.textContent = "Capture required. Select a highlighted piece.";
    else help.textContent = "Pass the board between turns. Select a piece, then choose its destination.";
  }

  function advance(view, square) {
    const nextPath = [...selectedPath, square];
    const matching = view.observation.legalActions.filter((action) =>
      action.pieceId === selectedPieceId
      && nextPath.every((pathSquare, index) => action.path[index] === pathSquare)
    );
    if (!matching.length) {
      selectedPieceId = null;
      selectedPath = [];
      render(view);
      return;
    }
    const complete = matching.find((action) => action.path.length === nextPath.length);
    const continues = matching.some((action) => action.path.length > nextPath.length);
    if (complete && !continues) {
      selectedPieceId = null;
      selectedPath = [];
      onMove(complete);
      return;
    }
    selectedPath = nextPath;
    render(view);
  }

  return Object.freeze({
    render,
    reset() {
      selectedPieceId = null;
      selectedPath = [];
    },
  });
}
