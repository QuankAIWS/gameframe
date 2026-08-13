const board = document.querySelector("#board");
const hammerCount = document.querySelector("#hammer-count");

function showCommittedHammerUse(event) {
  const tile = event.target instanceof Element
    ? event.target.closest(".cascade-tile.is-hammer-target")
    : null;
  if (!tile || !board?.contains(tile) || !hammerCount) return;

  const visibleCount = Number.parseInt(hammerCount.textContent || "", 10);
  if (!Number.isFinite(visibleCount) || visibleCount <= 0) return;

  // The runtime owns canonical inventory. This only closes the presentation gap
  // between a valid hammer target click and the runtime's next status render.
  hammerCount.textContent = String(visibleCount - 1);
  hammerCount.dataset.pendingUse = "true";
}

function clearPendingMarker() {
  if (!hammerCount) return;
  hammerCount.removeAttribute("data-pending-use");
}

if (board && hammerCount) {
  board.addEventListener("click", showCommittedHammerUse, { capture: true });
  new MutationObserver(clearPendingMarker).observe(hammerCount, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}
