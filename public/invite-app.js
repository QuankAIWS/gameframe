import { gameFrameFetch } from "./gameframe-auth.js";

const status = document.querySelector("#invite-claim-status");
const details = document.querySelector("#invite-claim-details");
const openMatch = document.querySelector("#invite-open-match");
const token = new URLSearchParams(window.location.search).get("token");

function gameName(gameId) {
  return ({
    "tic-tac-toe": "Tic-Tac-Toe",
    "american-checkers": "American Checkers",
    "tactical-movement-canary": "Tactical Movement",
    "tactical-combat-canary": "Tactical Combat",
  })[gameId] || "GameFrame Match";
}

async function responseJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `Invitation claim failed with HTTP ${response.status}.`);
  return body;
}

async function claimInvitation() {
  if (!token || token.length > 4096) {
    throw new Error("This invitation link is missing or malformed.");
  }
  const result = await responseJson(await gameFrameFetch("/api/invitations/claim", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  }));

  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete("token");
  window.history.replaceState({}, "", cleanUrl);

  const invitation = result.invitation;
  const inviterName = invitation.inviter.displayName || "The inviting player";
  status.textContent = "The second seat is securely claimed.";
  details.textContent = `${inviterName} invited you to ${gameName(invitation.gameId)}. The match was created with both authenticated GameFrame identities.`;
  openMatch.href = result.resumePath;
  openMatch.hidden = false;
  openMatch.focus();
}

claimInvitation().catch((error) => {
  status.textContent = "The invitation could not be claimed.";
  details.textContent = error instanceof Error ? error.message : "Invitation claim failed.";
  openMatch.hidden = true;
});
