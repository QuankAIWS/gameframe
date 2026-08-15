import { gameFrameFetch } from "./gameframe-auth.js";

const STAGING_CAMPAIGN_ID = "monster-master-staging-v6";
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
        <div><dt>Staging campaign</dt><dd data-admin-campaign></dd></div>
        <div><dt>Authority</dt><dd>Discord staging administrator</dd></div>
      </dl>

      <section class="mm-rpg-admin-diagnostics">
        <p class="mm-rpg-label">SESSION SUPPORT</p>
        <h3>Download session diagnostics</h3>
        <p>Exports the canonical campaign event history and GameFrame → Runtime command delivery evidence for this staging session. Credentials, signing material, cookies, and delivery lease tokens are excluded.</p>
        <button type="button" data-admin-diagnostics>Download session diagnostics</button>
        <p data-admin-diagnostics-status role="status">No diagnostics bundle has been generated.</p>
      </section>

      <section class="mm-rpg-admin-danger">
        <p class="mm-rpg-label">DESTRUCTIVE TEST CONTROL</p>
        <h3>Reset Monster Master staging</h3>
        <p>This clears the durable GameFrame RPG database and the RPG GM staging state, then both services restart and reseed the canonical test campaign. Other campaign selections are not the target of this control.</p>
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
  overlay.querySelector("[data-admin-campaign]").textContent = STAGING_CAMPAIGN_ID;
  const close = overlay.querySelector(".mm-rpg-admin-close");
  const diagnostics = overlay.querySelector("[data-admin-diagnostics]");
  const diagnosticsStatus = overlay.querySelector("[data-admin-diagnostics-status]");
  const reset = overlay.querySelector("[data-admin-reset]");
  const status = overlay.querySelector("[data-admin-status]");
  let confirmationExpiresAt = 0;

  function clearConfirmation({ resetStatus = true } = {}) {
    confirmationExpiresAt = 0;
    reset.textContent = "Reset staging campaign";
    if (resetStatus) status.textContent = "No administrator action is running.";
  }

  function armConfirmation() {
    const expiresAt = Date.now() + 10_000;
    confirmationExpiresAt = expiresAt;
    reset.textContent = "Confirm reset — click again";
    status.textContent = `Confirmation armed for 10 seconds. This will erase all progress in ${STAGING_CAMPAIGN_ID}.`;
    window.setTimeout(() => {
      if (confirmationExpiresAt !== expiresAt) return;
      clearConfirmation();
    }, 10_100);
  }

  open.addEventListener("click", () => {
    clearConfirmation();
    overlay.hidden = false;
    diagnostics.focus();
  });
  close.addEventListener("click", () => {
    clearConfirmation();
    overlay.hidden = true;
    open.focus();
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      clearConfirmation();
      overlay.hidden = true;
      open.focus();
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) {
      clearConfirmation();
      overlay.hidden = true;
      open.focus();
    }
  });

  async function downloadDiagnostics() {
    diagnostics.disabled = true;
    diagnostics.textContent = "Collecting diagnostics…";
    diagnosticsStatus.textContent = "Reading canonical campaign and Runtime delivery evidence…";
    try {
      const response = await gameFrameFetch("/api/rpg/admin/staging-diagnostics", {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
      }, identity);
      const sessionDiagnostics = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          sessionDiagnostics.message || `Session diagnostics failed (${response.status}).`,
        );
      }

      const [clientBuild, edgeHealth] = await Promise.all([
        optionalJson("/api/client-build"),
        optionalJson("/api/rpg/edge/health"),
      ]);
      const projection = window.gameFrameMonsterRpgApp?.getProjection?.() ?? null;
      const bundle = {
        schemaVersion: "gameframe.rpg.support-bundle.v1",
        generatedAt: new Date().toISOString(),
        stagingCampaignId: STAGING_CAMPAIGN_ID,
        deployment: {
          clientBuild,
          edgeHealth,
        },
        browser: {
          origin: window.location.origin,
          pathname: window.location.pathname,
          campaignId: window.gameFrameMonsterRpgApp?.getCampaignId?.() ?? null,
          projection: projection
            ? {
                gameframeCoordinationRevision: projection.gameframeCoordinationRevision,
                presentationSequence: projection.presentationSequence,
                linkedNarrativeRevision: projection.linkedNarrativeRevision,
                eventCount: Array.isArray(projection.events) ? projection.events.length : null,
              }
            : null,
        },
        sessionDiagnostics,
      };
      saveJson(bundle, diagnosticsFilename(bundle.generatedAt));
      const commandCount = Array.isArray(sessionDiagnostics.commands)
        ? sessionDiagnostics.commands.length
        : 0;
      diagnosticsStatus.textContent = `Downloaded diagnostics for ${STAGING_CAMPAIGN_ID} with ${commandCount} accepted command${commandCount === 1 ? "" : "s"}.`;
    } catch (error) {
      diagnosticsStatus.textContent = error instanceof Error
        ? error.message
        : "Session diagnostics could not be generated.";
    } finally {
      diagnostics.disabled = false;
      diagnostics.textContent = "Download session diagnostics";
    }
  }

  diagnostics.addEventListener("click", downloadDiagnostics);

  reset.addEventListener("click", async () => {
    const now = Date.now();
    if (now > confirmationExpiresAt) {
      armConfirmation();
      return;
    }

    clearConfirmation({ resetStatus: false });
    reset.disabled = true;
    reset.textContent = "Resetting…";
    status.textContent = `Reset accepted for ${STAGING_CAMPAIGN_ID}. GameFrame and the RPG GM will restart and reseed staging.`;
    try {
      const response = await gameFrameFetch("/api/rpg/admin/reset-staging", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          campaignId: STAGING_CAMPAIGN_ID,
          confirmation: "RESET MONSTER MASTER STAGING",
        }),
      }, identity);
      const value = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(value.message || `Staging reset failed (${response.status}).`);
      }

      window.localStorage.removeItem(
        `scribbles-gameframe.monster-master-rpg.profile.v1:${STAGING_CAMPAIGN_ID}`,
      );
      window.localStorage.setItem(
        "scribbles-gameframe.monster-master-rpg.campaign",
        STAGING_CAMPAIGN_ID,
      );
      status.textContent = "Services are restarting. Reloading the fresh staging campaign shortly…";
      window.setTimeout(() => {
        const url = new URL("/monster-master-rpg", window.location.origin);
        url.searchParams.set("campaign", STAGING_CAMPAIGN_ID);
        window.location.assign(url);
      }, 5_000);
    } catch (error) {
      reset.disabled = false;
      reset.textContent = "Reset staging campaign";
      status.textContent = error instanceof Error ? error.message : "Staging reset failed.";
    }
  });

  window.gameFrameMonsterRpgAdmin = Object.freeze({
    open: () => open.click(),
    close: () => close.click(),
    downloadDiagnostics,
    stagingCampaignId: STAGING_CAMPAIGN_ID,
  });
}

async function optionalJson(path) {
  try {
    const response = await gameFrameFetch(path, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    }, identity);
    if (!response.ok) return { available: false, status: response.status };
    return await response.json();
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : "request failed",
    };
  }
}

function saveJson(value, filename) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], {
    type: "application/json;charset=utf-8",
  });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 0);
}

function diagnosticsFilename(generatedAt) {
  const timestamp = generatedAt.replace(/[:.]/g, "-");
  return `monster-master-rpg-diagnostics-${STAGING_CAMPAIGN_ID}-${timestamp}.json`;
}
