import { gameFrameFetch, gameFrameOptionalFetch } from "./gameframe-auth.js";

const refreshIntervalMs = 15000;
const stylesheetUrl = "/gameframe-alerts.css";

function gameName(gameId) {
  if (gameId === "othello") return "Othello";
  if (gameId === "american-checkers") return "Clockwork Checkers";
  if (gameId === "tic-tac-toe") return "Tic-Tac-Toe";
  if (gameId === "monster-master-duel") return "Monster Master Arena Battles";
  return gameId || "GameFrame";
}

function ensureStylesheet() {
  if (document.querySelector(`link[href="${stylesheetUrl}"]`)) return;
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = stylesheetUrl;
  document.head.append(stylesheet);
}

function pendingIncomingInvitations(feed, identity) {
  return (Array.isArray(feed?.invitations) ? feed.invitations : []).filter((invitation) => (
    invitation?.status === "pending"
    && Boolean(invitation.claimToken)
    && invitation.inviter?.playerId !== identity.playerId
  ));
}

function installGameFrameAlerts(identity) {
  if (!identity || document.querySelector("#gameframe-alerts")) return;
  const sessionBadge = document.querySelector("#gameframe-session-badge");
  if (!sessionBadge) return;

  ensureStylesheet();

  const root = document.createElement("div");
  root.id = "gameframe-alerts";
  root.className = "gameframe-alerts";
  root.innerHTML = `
    <button id="gameframe-alerts-trigger" class="gameframe-alerts-trigger" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="gameframe-alerts-panel" aria-label="Alerts, no pending challenges">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </svg>
      <span class="gameframe-alerts-count" data-alert-count hidden>0</span>
    </button>
    <section id="gameframe-alerts-panel" class="gameframe-alerts-panel" role="dialog" aria-label="GameFrame alerts" hidden>
      <header class="gameframe-alerts-heading">
        <span>
          <small>GAMEFRAME</small>
          <strong>Alerts</strong>
        </span>
        <a href="/matches.html">View matches</a>
      </header>
      <div class="gameframe-alerts-list" data-alert-list>
        <p class="gameframe-alerts-empty">No new challenges.</p>
      </div>
      <p class="gameframe-alerts-error" data-alert-error hidden></p>
    </section>
  `;
  sessionBadge.append(root);

  const trigger = root.querySelector("#gameframe-alerts-trigger");
  const panel = root.querySelector("#gameframe-alerts-panel");
  const count = root.querySelector("[data-alert-count]");
  const list = root.querySelector("[data-alert-list]");
  const error = root.querySelector("[data-alert-error]");
  let invitations = [];
  let refreshInFlight = null;
  let mutationInFlight = false;

  function setOpen(open) {
    panel.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
    root.classList.toggle("is-open", open);
    if (open) void refresh();
  }

  function render() {
    const pendingCount = invitations.length;
    count.textContent = String(pendingCount);
    count.hidden = pendingCount === 0;
    trigger.classList.toggle("has-alerts", pendingCount > 0);
    trigger.setAttribute(
      "aria-label",
      pendingCount === 0
        ? "Alerts, no pending challenges"
        : `Alerts, ${pendingCount} pending challenge${pendingCount === 1 ? "" : "s"}`,
    );

    if (!pendingCount) {
      const empty = document.createElement("p");
      empty.className = "gameframe-alerts-empty";
      empty.textContent = "No new challenges.";
      list.replaceChildren(empty);
      return;
    }

    const rows = invitations.map((invitation) => {
      const row = document.createElement("article");
      row.className = "gameframe-alert-row";
      row.dataset.invitationId = invitation.invitationId || "";

      const copy = document.createElement("div");
      copy.className = "gameframe-alert-copy";
      const title = document.createElement("strong");
      title.textContent = `${invitation.inviter?.displayName || "A player"} challenged you`;
      const detail = document.createElement("span");
      detail.textContent = gameName(invitation.gameId);
      copy.append(title, detail);

      const actions = document.createElement("div");
      actions.className = "gameframe-alert-actions";
      const accept = document.createElement("button");
      accept.type = "button";
      accept.className = "gameframe-alert-action primary";
      accept.textContent = "Accept";
      accept.disabled = mutationInFlight;
      accept.addEventListener("click", () => void acceptInvitation(invitation));

      const decline = document.createElement("button");
      decline.type = "button";
      decline.className = "gameframe-alert-action";
      decline.textContent = "Decline";
      decline.disabled = mutationInFlight;
      decline.addEventListener("click", () => void declineInvitation(invitation));
      actions.append(accept, decline);
      row.append(copy, actions);
      return row;
    });
    list.replaceChildren(...rows);
  }

  async function refresh() {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      try {
        const response = await gameFrameOptionalFetch("/api/me/feed", {}, identity);
        if (response.status === 401) return;
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message || `Alerts failed with ${response.status}.`);
        invitations = pendingIncomingInvitations(body, identity);
        error.hidden = true;
        error.textContent = "";
        render();
      } catch (refreshError) {
        if (!panel.hidden) {
          error.hidden = false;
          error.textContent = refreshError instanceof Error ? refreshError.message : "Alerts could not be refreshed.";
        }
      } finally {
        refreshInFlight = null;
      }
    })();
    return refreshInFlight;
  }

  async function acceptInvitation(invitation) {
    if (mutationInFlight || !invitation.claimToken) return;
    mutationInFlight = true;
    render();
    try {
      const response = await gameFrameFetch("/api/invitations/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: invitation.claimToken }),
      }, identity);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || `Challenge acceptance failed with ${response.status}.`);
      window.location.assign(body.resumePath || "/matches.html");
    } catch (acceptError) {
      mutationInFlight = false;
      error.hidden = false;
      error.textContent = acceptError instanceof Error ? acceptError.message : "The challenge could not be accepted.";
      render();
    }
  }

  async function declineInvitation(invitation) {
    if (mutationInFlight || !invitation.invitationId) return;
    mutationInFlight = true;
    render();
    try {
      const response = await gameFrameFetch(
        `/api/invitations/${encodeURIComponent(invitation.invitationId)}/decline`,
        { method: "POST" },
        identity,
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || `Challenge decline failed with ${response.status}.`);
      invitations = invitations.filter((candidate) => candidate.invitationId !== invitation.invitationId);
      mutationInFlight = false;
      error.hidden = true;
      error.textContent = "";
      render();
      void refresh();
    } catch (declineError) {
      mutationInFlight = false;
      error.hidden = false;
      error.textContent = declineError instanceof Error ? declineError.message : "The challenge could not be declined.";
      render();
    }
  }

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    setOpen(panel.hidden);
  });
  panel.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      setOpen(false);
      trigger.focus();
    }
  });
  window.addEventListener("focus", () => void refresh());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refresh();
  });

  window.setInterval(() => {
    if (document.visibilityState === "visible") void refresh();
  }, refreshIntervalMs);

  window.gameFrameAlerts = Object.freeze({ refresh, open: () => setOpen(true) });
  render();
  void refresh();
}

installGameFrameAlerts(window.gameFrameIdentity);

export { installGameFrameAlerts };
