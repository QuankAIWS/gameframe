const style = document.createElement("style");
style.textContent = `
  body.checkers-premium-active:not(.checkers-premium-running) .hero {
    display: grid;
  }
  @media (min-width: 761px) {
    body.checkers-premium-active .shell { padding-bottom: 74px; }
  }
  .checkers-board-title { margin: 0; }
  @media (max-width: 760px) {
    body.checkers-premium-active .checkers-board-heading {
      display: flex;
      margin: 0 2px 6px;
    }
    body.checkers-premium-active .checkers-board-title {
      font-size: 1rem;
    }
    body.checkers-premium-active .checkers-board-state {
      display: none;
    }
  }
`;
document.head.append(style);

const matchPanel = document.querySelector("#match-panel");

function syncCheckersRunningState() {
  const running = document.body.classList.contains("checkers-premium-active")
    && Boolean(matchPanel)
    && !matchPanel.hidden;
  document.body.classList.toggle("checkers-premium-running", running);
}

if (matchPanel) {
  const matchObserver = new MutationObserver(syncCheckersRunningState);
  matchObserver.observe(matchPanel, {
    attributes: true,
    attributeFilter: ["hidden", "class"],
  });
}

const bodyObserver = new MutationObserver(syncCheckersRunningState);
bodyObserver.observe(document.body, {
  attributes: true,
  attributeFilter: ["class"],
});
syncCheckersRunningState();
