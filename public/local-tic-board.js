export function renderLocalTicBoard({ board, help, view, onMove }) {
  board.className = "board board-tic-tac-toe";
  board.setAttribute("aria-label", "Tic-tac-toe local board");
  board.replaceChildren();
  view.observation.board.forEach((mark, cell) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell tic-cell";
    button.dataset.cell = String(cell);
    button.dataset.mark = mark || "";
    button.textContent = mark || "";
    button.setAttribute("aria-label", mark ? `Cell ${cell + 1}: ${mark}` : `Cell ${cell + 1}: empty`);
    const legal = view.observation.legalActions.some((action) => action.cell === cell);
    button.disabled = !legal;
    if (mark) button.classList.add(mark === "X" ? "mark-x" : "mark-o");
    if (legal) button.addEventListener("click", () => onMove({ type: "place", cell }));
    board.append(button);
  });
  help.textContent = view.observation.status.lifecycle === "active"
    ? "Pass the board between turns and choose any open cell."
    : "This local game is complete.";
}
