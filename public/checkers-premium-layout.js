const style = document.createElement("style");
style.textContent = `
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
