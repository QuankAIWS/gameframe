const board = document.querySelector("#board");
const status = document.querySelector("#status");
const revision = document.querySelector("#revision");
const details = document.querySelector("#details");
const newMatch = document.querySelector("#new-match");

const playerId = `browser-${crypto.randomUUID()}`;
let current = null;

function statusText(observation) {
  if (observation.status.draw) return "Draw. Theo remains undefeated.";
  if (observation.status.winnerPlayerId) {
    return observation.status.winnerPlayerId === playerId ? "You won." : "Theo won.";
  }
  return observation.nextPlayerId === playerId ? "Your turn — you are X." : "Theo is considering the position.";
}

function render(view) {
  current = view;
  status.textContent = statusText(view.observation);
  revision.textContent = `Revision ${view.revision}`;
  details.textContent = JSON.stringify({ matchId: view.matchId, eventCount: view.eventCount }, null, 2);
  board.replaceChildren();

  view.observation.board.forEach((mark, cell) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell";
    button.textContent = mark ?? "";
    button.setAttribute("aria-label", mark ? `Cell ${cell + 1}: ${mark}` : `Cell ${cell + 1}: empty`);
    const legal = view.observation.legalActions.some((action) => action.cell === cell);
    button.disabled = !legal;
    button.addEventListener("click", () => move(cell));
    board.append(button);
  });
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message ?? body.error);
  return body;
}

async function start() {
  status.textContent = "Creating match…";
  render(await request("/api/matches", {
    method: "POST",
    body: JSON.stringify({ humanPlayerId: playerId }),
  }));
}

async function move(cell) {
  if (!current) return;
  status.textContent = "Submitting move…";
  try {
    render(await request(`/api/matches/${encodeURIComponent(current.matchId)}/actions`, {
      method: "POST",
      body: JSON.stringify({
        playerId,
        actionId: crypto.randomUUID(),
        expectedRevision: current.revision,
        action: { type: "place", cell },
      }),
    }));
  } catch (error) {
    status.textContent = error.message;
  }
}

newMatch.addEventListener("click", start);
for (let index = 0; index < 9; index += 1) {
  const placeholder = document.createElement("button");
  placeholder.type = "button";
  placeholder.className = "cell";
  placeholder.disabled = true;
  board.append(placeholder);
}
