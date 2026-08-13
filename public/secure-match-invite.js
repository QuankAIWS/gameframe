import { gameFrameFetch } from "./gameframe-auth.js";

let activeInvitation = null;
let activeTargetName = null;
let pollTimer = null;

const BOARD_GAME_IDS = new Set(["tic-tac-toe", "american-checkers"]);
const GAME_LABELS = new Map([
  ["tic-tac-toe", "Tic-Tac-Toe"],
  ["american-checkers", "Clockwork Checkers"],
  ["tactical-movement-canary", "Tactical Movement"],
  ["tactical-combat-canary", "Tactical Combat"],
  ["monster-master-duel", "Monster Master Arena"],
]);

function boardGameIdFromRoute() {
  const gameId = new URLSearchParams(window.location.search).get("game");
  if (!BOARD_GAME_IDS.has(gameId)) {
    throw new Error("Open Tic-Tac-Toe or Clockwork Checkers before creating a player challenge.");
  }
  return gameId;
}

function gameConfiguration(entry) {
  if (entry === "/tactical-app.js") {
    return { selector: "#tactical-human", gameId: () => "tactical-movement-canary" };
  }
  if (entry === "/combat-app.js") {
    return { selector: "#combat-human", gameId: () => "tactical-combat-canary" };
  }
  if (entry === "/monster-master-app.js") {
    return { selector: "#monster-master-human", gameId: () => "monster-master-duel" };
  }
  if (entry === "/app.js") {
    return { selector: "#create-human-match", gameId: boardGameIdFromRoute };
  }
  return null;
}

function gameLabel(gameId) {
  return GAME_LABELS.get(gameId) || "GameFrame Match";
}

async function responseJson(response, context) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `${context} failed with HTTP ${response.status}.`);
  return body;
}

function clearPolling() {
  if (pollTimer !== null) window.clearTimeout(pollTimer);
  pollTimer = null;
}

function ensureDialog() {
  let dialog = document.querySelector("#gameframe-invite-dialog");
  if (dialog) return dialog;
  dialog = document.createElement("section");
  dialog.id = "gameframe-invite-dialog";
  dialog.className = "gameframe-invite-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "gameframe-invite-title");
  dialog.hidden = true;
  dialog.innerHTML = `
    <div class="gameframe-invite-card gameframe-challenge-card">
      <div class="gameframe-challenge-heading">
        <div>
          <p class="gameframe-auth-eyebrow">GAMEFRAME 1V1</p>
          <h2 id="gameframe-invite-title">Challenge a player</h2>
          <p class="gameframe-challenge-game" data-invite-game></p>
        </div>
        <button type="button" class="gameframe-challenge-close" data-invite-close aria-label="Close challenge dialog">×</button>
      </div>
      <p data-invite-status role="status" aria-live="polite">Loading GameFrame players…</p>
      <div class="gameframe-challenge-picker" data-invite-picker></div>
      <div class="gameframe-challenge-sent" data-invite-sent hidden>
        <a class="gameframe-auth-button" href="/matches.html">View Matches</a>
      </div>
      <div data-invite-ready hidden>
        <label for="gameframe-invite-link">Share invitation link</label>
        <div class="gameframe-invite-link-row">
          <input id="gameframe-invite-link" type="text" readonly>
          <button type="button" data-invite-copy>Copy</button>
          <button type="button" data-invite-share hidden>Share</button>
        </div>
        <p class="gameframe-invite-note">Anyone with this link can request the open seat after signing in to GameFrame. Direct player challenges are restricted to the player you choose.</p>
      </div>
      <div class="gameframe-challenge-secondary" data-invite-secondary>
        <span>Player not listed yet?</span>
        <button type="button" data-invite-link-mode>Share an invitation link</button>
      </div>
      <div class="gameframe-invite-actions">
        <button type="button" data-invite-cancel disabled hidden>Cancel challenge</button>
      </div>
    </div>
  `;
  document.body.append(dialog);

  dialog.querySelector("[data-invite-close]").addEventListener("click", () => {
    clearPolling();
    dialog.hidden = true;
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      clearPolling();
      dialog.hidden = true;
    }
  });
  dialog.querySelector("[data-invite-copy]").addEventListener("click", async () => {
    const input = dialog.querySelector("#gameframe-invite-link");
    try {
      await navigator.clipboard.writeText(input.value);
    } catch {
      input.select();
      document.execCommand("copy");
    }
    dialog.querySelector("[data-invite-status]").textContent = "Invitation copied. Waiting for another GameFrame player…";
  });
  dialog.querySelector("[data-invite-share]").addEventListener("click", async () => {
    const input = dialog.querySelector("#gameframe-invite-link");
    if (!navigator.share || !input.value) return;
    try {
      await navigator.share({ title: "GameFrame challenge", url: input.value });
    } catch {
      // Dismissed native share sheets do not change invitation state.
    }
  });
  dialog.querySelector("[data-invite-cancel]").addEventListener("click", cancelInvitation);
  return dialog;
}

function resetDialog(gameId) {
  clearPolling();
  activeInvitation = null;
  activeTargetName = null;
  const dialog = ensureDialog();
  dialog.hidden = false;
  dialog.querySelector("[data-invite-game]").textContent = gameLabel(gameId);
  dialog.querySelector("[data-invite-picker]").replaceChildren();
  dialog.querySelector("[data-invite-picker]").hidden = false;
  dialog.querySelector("[data-invite-sent]").hidden = true;
  dialog.querySelector("[data-invite-ready]").hidden = true;
  dialog.querySelector("[data-invite-secondary]").hidden = false;
  const cancel = dialog.querySelector("[data-invite-cancel]");
  cancel.hidden = true;
  cancel.disabled = true;
  dialog.querySelector("[data-invite-status]").textContent = "Loading GameFrame players…";
  return dialog;
}

function avatarFor(player) {
  if (player.avatarUrl) {
    const image = document.createElement("img");
    image.src = player.avatarUrl;
    image.alt = "";
    image.loading = "lazy";
    return image;
  }
  const fallback = document.createElement("span");
  fallback.className = "gameframe-challenge-avatar-fallback";
  fallback.textContent = (player.displayName || "GF").slice(0, 2).toUpperCase();
  return fallback;
}

function playerChoice(player, configuration) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "gameframe-challenge-player";
  button.dataset.challengePlayerId = player.playerId;
  const identity = document.createElement("span");
  identity.className = "gameframe-challenge-player-identity";
  identity.append(avatarFor(player));
  const copy = document.createElement("span");
  const name = document.createElement("strong");
  name.textContent = player.displayName || "GameFrame player";
  const detail = document.createElement("small");
  detail.textContent = "Send challenge";
  copy.append(name, detail);
  identity.append(copy);
  const action = document.createElement("b");
  action.textContent = "Challenge";
  button.append(identity, action);
  button.addEventListener("click", () => void createInvitation(configuration, {
    targetPlayerId: player.playerId,
    targetName: player.displayName || "player",
    button,
  }));
  return button;
}

async function loadPlayerPicker(configuration, identity) {
  const gameId = configuration.gameId();
  const dialog = resetDialog(gameId);
  dialog.querySelector("[data-invite-link-mode]").onclick = () => void createInvitation(configuration);
  try {
    const body = await responseJson(await gameFrameFetch("/api/players"), "Player directory");
    const players = (Array.isArray(body.players) ? body.players : [])
      .filter((player) => player?.playerId && player.playerId !== identity.playerId && /^discord:\d+$/.test(player.playerId));
    const picker = dialog.querySelector("[data-invite-picker]");
    if (!players.length) {
      const empty = document.createElement("p");
      empty.className = "gameframe-challenge-empty";
      empty.textContent = "No other signed-in GameFrame players are listed yet. Share a link for their first game, then they will appear here.";
      picker.append(empty);
      dialog.querySelector("[data-invite-status]").textContent = "No known players yet.";
      return;
    }
    for (const player of players) picker.append(playerChoice(player, configuration));
    dialog.querySelector("[data-invite-status]").textContent = `Choose who to challenge to ${gameLabel(gameId)}.`;
  } catch (error) {
    dialog.querySelector("[data-invite-status]").textContent = error instanceof Error
      ? error.message
      : "The GameFrame player directory could not be loaded.";
  }
}

function invitationStatusText(invitation) {
  if (invitation.status === "cancelled") return "Challenge cancelled.";
  if (invitation.status === "expired") return "Challenge expired. Create a new one.";
  if (invitation.status === "claimed") {
    const name = invitation.claimant?.displayName || activeTargetName || "The other player";
    return `${name} accepted. Opening the match…`;
  }
  if (activeTargetName) return `Challenge sent to ${activeTargetName}. It is waiting in their GameFrame Matches.`;
  return "Invitation ready. Waiting for another authenticated GameFrame player…";
}

async function pollInvitation() {
  if (!activeInvitation) return;
  const dialog = ensureDialog();
  try {
    const result = await responseJson(
      await gameFrameFetch(`/api/invitations/${encodeURIComponent(activeInvitation.invitationId)}`),
      "Challenge status",
    );
    dialog.querySelector("[data-invite-status]").textContent = invitationStatusText(result.invitation);
    if (result.invitation.status === "claimed" && result.resumePath) {
      clearPolling();
      window.setTimeout(() => window.location.assign(result.resumePath), 400);
      return;
    }
    if (result.invitation.status === "cancelled" || result.invitation.status === "expired") {
      clearPolling();
      dialog.querySelector("[data-invite-cancel]").disabled = true;
      activeInvitation = null;
      return;
    }
  } catch (error) {
    dialog.querySelector("[data-invite-status]").textContent = error instanceof Error
      ? error.message
      : "Challenge status could not be refreshed.";
  }
  pollTimer = window.setTimeout(pollInvitation, 1200);
}

async function cancelInvitation() {
  if (!activeInvitation) return;
  const dialog = ensureDialog();
  const cancel = dialog.querySelector("[data-invite-cancel]");
  cancel.disabled = true;
  try {
    const result = await responseJson(
      await gameFrameFetch(`/api/invitations/${encodeURIComponent(activeInvitation.invitationId)}/cancel`, { method: "POST" }),
      "Challenge cancellation",
    );
    dialog.querySelector("[data-invite-status]").textContent = invitationStatusText(result.invitation);
    clearPolling();
    activeInvitation = null;
  } catch (error) {
    dialog.querySelector("[data-invite-status]").textContent = error instanceof Error
      ? error.message
      : "Challenge cancellation failed.";
    cancel.disabled = false;
  }
}

async function createInvitation(configuration, options = {}) {
  const gameId = configuration.gameId();
  const dialog = ensureDialog();
  clearPolling();
  activeInvitation = null;
  activeTargetName = options.targetName || null;
  dialog.querySelector("[data-invite-status]").textContent = activeTargetName
    ? `Sending ${gameLabel(gameId)} challenge to ${activeTargetName}…`
    : `Creating a shareable ${gameLabel(gameId)} invitation…`;
  if (options.button) options.button.disabled = true;
  try {
    const body = { gameId };
    if (options.targetPlayerId) {
      const match = /^discord:(\d+)$/.exec(options.targetPlayerId);
      if (!match) throw new Error("That player cannot receive a hosted GameFrame challenge.");
      body.targetDiscordUserId = match[1];
    }
    const result = await responseJson(
      await gameFrameFetch("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      "Challenge creation",
    );
    activeInvitation = result.invitation;
    dialog.querySelector("[data-invite-picker]").hidden = true;
    dialog.querySelector("[data-invite-secondary]").hidden = true;
    const cancel = dialog.querySelector("[data-invite-cancel]");
    cancel.hidden = false;
    cancel.disabled = false;
    if (options.targetPlayerId) {
      dialog.querySelector("[data-invite-sent]").hidden = false;
      dialog.querySelector("[data-invite-ready]").hidden = true;
    } else {
      dialog.querySelector("#gameframe-invite-link").value = result.inviteUrl;
      dialog.querySelector("[data-invite-ready]").hidden = false;
      dialog.querySelector("[data-invite-share]").hidden = !navigator.share;
    }
    dialog.querySelector("[data-invite-status]").textContent = invitationStatusText(result.invitation);
    pollTimer = window.setTimeout(pollInvitation, 800);
  } catch (error) {
    dialog.querySelector("[data-invite-status]").textContent = error instanceof Error
      ? error.message
      : "Challenge creation failed.";
  } finally {
    if (options.button) options.button.disabled = false;
  }
}

export function installAuthenticatedInvitationFlow({ identity, entry }) {
  if (identity?.source !== "discord") return;
  const configuration = gameConfiguration(entry);
  if (!configuration) return;
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest(configuration.selector) : null;
    if (!(target instanceof HTMLButtonElement)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    target.disabled = true;
    void loadPlayerPicker(configuration, identity)
      .catch((error) => {
        const dialog = ensureDialog();
        dialog.hidden = false;
        dialog.querySelector("[data-invite-status]").textContent = error instanceof Error
          ? error.message
          : "Player challenges are unavailable for this game.";
      })
      .finally(() => { target.disabled = false; });
  }, true);
}
