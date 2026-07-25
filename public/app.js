const board = document.querySelector("#board");
const status = document.querySelector("#status");
const revision = document.querySelector("#revision");
const details = document.querySelector("#details");
const newMatch = document.querySelector("#new-match");

const playerId = `browser-${crypto.randomUUID()}`;
let current = null;
let realtimeEnabled = false;
let socket = null;
let reconnectTimer = null;
let reconnectAttempt = 0;

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
  details.textContent = JSON.stringify({
    matchId: view.matchId,
    eventCount: view.eventCount,
    realtime: realtimeEnabled ? (socket?.readyState === WebSocket.OPEN ? "connected" : "enabled") : "local-http",
  }, null, 2);
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

async function detectRuntime() {
  try {
    const health = await request("/api/health");
    realtimeEnabled = health.realtime === "websocket-hibernation";
  } catch {
    realtimeEnabled = false;
  }
}

function disconnectRealtime() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  reconnectAttempt = 0;
  if (socket) {
    socket.onclose = null;
    socket.close();
  }
  socket = null;
}

function scheduleReconnect(matchId) {
  if (!realtimeEnabled || !current || current.matchId !== matchId || current.observation.status.lifecycle !== "active") {
    return;
  }
  const delay = Math.min(1000 * (2 ** reconnectAttempt), 15_000);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => connectRealtime(matchId), delay);
}

function connectRealtime(matchId) {
  if (!realtimeEnabled || !current || current.matchId !== matchId) return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  const url = new URL(`/api/matches/${encodeURIComponent(matchId)}/events`, window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("playerId", playerId);
  socket = new WebSocket(url);

  socket.onopen = () => {
    reconnectAttempt = 0;
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
    scheduleReconnect(matchId);
  };

  socket.onerror = () => {
    socket?.close();
  };
}

async function start() {
  disconnectRealtime();
  status.textContent = "Creating match…";
  const view = await request("/api/matches", {
    method: "POST",
    body: JSON.stringify({ playerIds: [playerId, "theo"] }),
  });
  render(view);
  connectRealtime(view.matchId);
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
    if (realtimeEnabled && socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "refresh" }));
    }
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

await detectRuntime();
