import { gameFrameFetch } from "./gameframe-auth.js";

let activeInvitation = null;
let pollTimer = null;

function gameConfiguration(entry) {
  if (entry === "/tactical-app.js") {
    return {
      selector: "#tactical-human",
      gameId: () => "tactical-movement-canary",
      label: "Tactical Movement",
    };
  }
  if (entry === "/combat-app.js") {
    return {
      selector: "#combat-human",
      gameId: () => "tactical-combat-canary",
      label: "Tactical Combat",
    };
  }
  if (entry === "/app.js") {
    return {
      selector: "#create-human-match",
      gameId: () => document.querySelector(".game-card.is-selected[data-game-id]")?.dataset.gameId
        || "tic-tac-toe",
      label: "GameFrame Match",
    };
  }
  return null;
}

async function responseJson(response, context) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || `${context} failed with HTTP ${response.status}.`);
  }
  return body;
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
    <div class="gameframe-invite-card">
      <p class="gameframe-auth-eyebrow">AUTHENTICATED SECOND SEAT</p>
      <h2 id="gameframe-invite-title">Invite another Discord user</h2>
      <p data-invite-status role="status" aria-live="polite">Creating a signed invitation…</p>
      <div data-invite-ready hidden>
        <label for="gameframe-invite-link">Secure invitation link</label>
        <div class="gameframe-invite-link-row">
          <input id="gameframe-invite-link" type="text" readonly>
          <button type="button" data-invite-copy>Copy</button>
        </div>
        <p class="gameframe-invite-note">The link grants permission to request the open seat. The recipient must still sign in with an allowed Discord account.</p>
      </div>
      <div class="gameframe-invite-actions">
        <button type="button" data-invite-cancel disabled>Cancel invitation</button>
      </div>
    </div>
  `;
  document.body.append(dialog);
  dialog.querySelector("[data-invite-copy]").addEventListener("click", async () => {
    const input = dialog.querySelector("#gameframe-invite-link");
    try {
      await navigator.clipboard.writeText(input.value);
      dialog.querySelector("[data-invite-status]").textContent = "Invitation copied. Waiting for the second authenticated user…";
    } catch {
      input.select();
      document.execCommand("copy");
      dialog.querySelector("[data-invite-status]").textContent = "Invitation copied. Waiting for the second authenticated user…";
    }
  });
  dialog.querySelector("[data-invite-cancel]").addEventListener("click", cancelInvitation);
  return dialog;
}

function clearPolling() {
  if (pollTimer !== null) window.clearTimeout(pollTimer);
  pollTimer = null;
}

function invitationStatusText(invitation) {
  if (invitation.status === "cancelled") return "Invitation cancelled.";
  if (invitation.status === "expired") return "Invitation expired. Create a new invitation.";
  if (invitation.status === "claimed") {
    const name = invitation.claimant?.displayName || "The second player";
    return `${name} securely claimed the second seat. Opening the match…`;
  }
  return "Waiting for a second authenticated Discord user to claim the seat…";
}

async function pollInvitation() {
  if (!activeInvitation) return;
  const dialog = ensureDialog();
  try {
    const result = await responseJson(
      await gameFrameFetch(`/api/invitations/${encodeURIComponent(activeInvitation.invitationId)}`),
      "Invitation status",
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
      : "Invitation status could not be refreshed.";
  }
  pollTimer = window.setTimeout(pollInvitation, 1200);
}

async function cancelInvitation() {
  if (!activeInvitation) return;
  const dialog = ensureDialog();
  dialog.querySelector("[data-invite-cancel]").disabled = true;
  try {
    const result = await responseJson(
      await gameFrameFetch(
        `/api/invitations/${encodeURIComponent(activeInvitation.invitationId)}/cancel`,
        { method: "POST" },
      ),
      "Invitation cancellation",
    );
    dialog.querySelector("[data-invite-status]").textContent = invitationStatusText(result.invitation);
    clearPolling();
    activeInvitation = null;
  } catch (error) {
    dialog.querySelector("[data-invite-status]").textContent = error instanceof Error
      ? error.message
      : "Invitation cancellation failed.";
    dialog.querySelector("[data-invite-cancel]").disabled = false;
  }
}

async function createInvitation(configuration, button) {
  clearPolling();
  activeInvitation = null;
  const dialog = ensureDialog();
  dialog.hidden = false;
  dialog.querySelector("[data-invite-ready]").hidden = true;
  dialog.querySelector("[data-invite-cancel]").disabled = true;
  dialog.querySelector("[data-invite-status]").textContent = `Creating a signed ${configuration.label} invitation…`;
  button.disabled = true;
  try {
    const result = await responseJson(
      await gameFrameFetch("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameId: configuration.gameId() }),
      }),
      "Invitation creation",
    );
    activeInvitation = result.invitation;
    dialog.querySelector("#gameframe-invite-link").value = result.inviteUrl;
    dialog.querySelector("[data-invite-ready]").hidden = false;
    dialog.querySelector("[data-invite-cancel]").disabled = false;
    dialog.querySelector("[data-invite-status]").textContent = invitationStatusText(result.invitation);
    pollTimer = window.setTimeout(pollInvitation, 800);
  } catch (error) {
    dialog.querySelector("[data-invite-status]").textContent = error instanceof Error
      ? error.message
      : "Invitation creation failed.";
  } finally {
    button.disabled = false;
  }
}

export function installAuthenticatedInvitationFlow({ identity, entry }) {
  if (identity?.source !== "discord") return;
  const configuration = gameConfiguration(entry);
  if (!configuration) return;
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest(configuration.selector)
      : null;
    if (!(target instanceof HTMLButtonElement)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void createInvitation(configuration, target);
  }, true);
}
