const params = new URLSearchParams(window.location.search);
const viewedPlayerId = params.get("view")?.trim();

if (viewedPlayerId) {
  const host = document.querySelector(".profile-grid");
  if (host) {
    const section = document.createElement("section");
    section.className = "platform-section profile-play-together";
    section.setAttribute("aria-labelledby", "profile-play-together-title");

    const heading = document.createElement("header");
    heading.className = "platform-section-header";
    const copy = document.createElement("div");
    const title = document.createElement("h2");
    title.id = "profile-play-together-title";
    title.textContent = "Play together";
    const detail = document.createElement("span");
    detail.className = "platform-count";
    detail.textContent = "Choose a 1v1 game";
    copy.append(title, detail);
    heading.append(copy);

    const games = document.createElement("div");
    games.className = "profile-play-together-games";
    const options = [
      ["Tic-Tac-Toe", "/?game=tic-tac-toe&menu=1"],
      ["Clockwork Checkers", "/?game=american-checkers&menu=1"],
      ["Othello", "/othello.html"],
    ];
    for (const [label, href] of options) {
      const link = document.createElement("a");
      link.className = "platform-button profile-play-together-game";
      link.href = href;
      link.textContent = label;
      games.append(link);
    }

    const note = document.createElement("p");
    note.className = "profile-play-together-note";
    note.textContent = "Open a game, then choose this player from the GameFrame player list.";

    section.append(heading, games, note);
    host.insertBefore(section, host.children[1] || null);
  }
}
