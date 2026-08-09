import { gameFrameFetch } from "./gameframe-auth.js";

const identity = window.gameFrameIdentity;
if (!identity?.admin) {
  // The Worker independently enforces every privileged route. Hiding controls
  // here is presentation only, not the authorization boundary.
} else {
  installStylesheet();
  installAdminControls();
}

function installStylesheet() {
  if (document.querySelector('link[href="/monster-master-rpg-admin.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/monster-master-rpg-admin.css";
  document.head.append(link);
}

function activeCampaignId() {
  const displayed = document.querySelector("#mm-rpg-campaign-code")?.textContent?.trim() || "";
  const requested = new URLSearchParams(window.location.search).get("campaign")?.trim() || "";
  const campaignId = displayed || requested;
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(campaignId)) {
    throw new Error("The active staging campaign identity is unavailable.");
  }
  return campaignId;
}

function installAdminControls() {
  const headerActions = document.querySelector(".mm-rpg-header-actions");
  if (!headerActions || document.querySelector("#mm-rpg-admin-open")) return;

  const open = document.createElement("button");
  open.id = "mm-rpg-admin-open";
  open.type = "button";
  open.className = "mm-rpg-secondary mm-rpg-admin-button";
  open.textContent = "Admin";
  headerActions.append(open);

  const overlay = document.createElement("div");
  overlay.id = "mm-rpg-admin-overlay";
  overlay.className = "mm-rpg-admin-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <section class="mm-rpg-admin-panel" role="dialog" aria-modal="true" aria-labelledby="mm-rpg-admin-title">
      <header>
        <div>
          <p class="mm-rpg-label">STAGING CONTROL PLANE</p>
          <h2 id="mm-rpg-admin-title">GameFrame Admin</h2>
          <p>Operator authority is tied to a separate Discord administrator secret, not the normal staging allowlist.</p>
        </div>
        <button type="button" class="mm-rpg-admin-close" aria-label="Close admin controls">×</button>
      </header>

      <dl class="mm-rpg-admin-facts">
        <div><dt>Principal</dt><dd data-admin-principal></dd></div>
        <div><dt>Campaign</dt><dd data-admin-campaign></dd></div>
        <div><dt>Authority</dt><dd>Discord staging administrator</dd></div>
      </dl>

      <section class="mm-rpg-admin-danger">
        <p class="mm-rpg-label">DESTRUCTIVE TEST CONTROL</p>
        <h3>Reset Monster Master staging</h3>
        <p>This clears the durable GameFrame RPG database and the RPG GM staging state, then both services restart and reseed the canonical test campaign. Your local staging character profile is also cleared so onboarding runs again.</p>
        <button type="button" data-admin-reset>Reset staging campaign</button>
        <p data-admin-status role="status">No administrator action is running.</p>
      </section>

      <section class="mm-rpg-admin-future">
        <p class="mm-rpg-label">OPERATOR TOOLS</p>
        <div>
          <span>Encounter diagnostics <small>COMING SOON</small></span>
          <span>Force reconciliation <small>COMING SOON</small></span>
          <span>Campaign snapshots <small>COMING SOON</small></span>
          <span>Runtime health detail <small>COMING SOON</small></span>
        </div>
      </section>
    </section>
  `;
  document.body.append(overlay);

  overlay.querySelector("[data-admin-principal]").textContent = identity.playerId;
  const campaignFact = overlay.querySelector("[data-admin-campaign]");
  const close = overlay.querySelector(".mm-rpg-admin-close");
  const reset = overlay.querySelector("[data-admin-reset]");
  const status = overlay.querySelector("[data-admin-status]");
  let confirmationExpiresAt = 0;

  open.addEventListener("click", () => {
    try {
      campaignFact.textContent = activeCampaignId();
      status.textContent = "No administrator action is running.";
    } catch (error) {
      campaignFact.textContent = "Unavailable";
      status.textContent = error instanceof Error ? error.message : "Campaign identity is unavailable.";
    }
    overlay.hidden = false;
    reset.focus();
  });
  close.addEventListener("click", () => {
    overlay.hidden = true;
    open.focus();
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      overlay.hidden = true;
      open.focus();
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) {
      overlay.hidden = true;
      open.focus();
    }
  });

  reset.addEventListener("click", async () => {
    let campaignId;
    try {
      campaignId = activeCampaignId();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Campaign identity is unavailable.";
      return;
    }

    const now = Date.now();
    if (now > confirmationExpiresAt) {
      confirmationExpiresAt = now + 10_000;
      reset.textContent = "Confirm reset — click again";
      status.textContent = `Confirmation armed for 10 seconds. This will erase all progress in ${campaignId}.`;
      window.setTimeout(() => {
        if (Date.now() <= confirmationExpiresAt) return;
        reset.textContent = "Reset staging campaign";
        status.textContent = "No administrator action is running.";
      }, 10_100);
      return;
    }

    confirmationExpiresAt = 0;
    reset.disabled = true;
    reset.textContent = "Resetting…";
    status.textContent = "Reset accepted. GameFrame and the RPG GM will restart and reseed staging.";
    try {
      const response = await gameFrameFetch("/api/rpg/admin/reset-staging", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          campaignId,
          confirmation: "RESET MONSTER MASTER STAGING",
        }),
      }, identity);
      const value = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(value.message || `Staging reset failed (${response.status}).`);
      }

      window.localStorage.removeItem(
        `scribbles-gameframe.monster-master-rpg.profile.v1:${campaignId}`,
      );
      window.localStorage.setItem(
        "scribbles-gameframe.monster-master-rpg.campaign",
        campaignId,
      );
      status.textContent = "Services are restarting. Reloading the fresh campaign shortly…";
      window.setTimeout(() => {
        const url = new URL("/monster-master-rpg", window.location.origin);
        url.searchParams.set("campaign", campaignId);
        window.location.assign(url);
      }, 5_000);
    } catch (error) {
      reset.disabled = false;
      reset.textContent = "Reset staging campaign";
      status.textContent = error instanceof Error ? error.message : "Staging reset failed.";
    }
  });
}
