function downloadJson(value, filename) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function installTelemetryExport(dialog) {
  if (dialog.querySelector("[data-admin-telemetry-export]")) return;
  const panel = dialog.querySelector(".cascade-admin-panel");
  const reset = dialog.querySelector(".cascade-admin-reset-section");
  if (!panel) return;

  const section = document.createElement("section");
  section.className = "cascade-admin-section";
  section.dataset.adminTelemetryExport = "";
  section.innerHTML = `
    <small>PLAYTEST DATA</small>
    <p>Download server-custodied Cascade Crush play sessions, attempts, retries, hammer use, timing, progression events, and raw research telemetry.</p>
    <div class="cascade-admin-control-grid">
      <button type="button" data-download-cascade-telemetry>Download telemetry package</button>
    </div>
  `;
  if (reset) panel.insertBefore(section, reset);
  else panel.append(section);

  const button = section.querySelector("[data-download-cascade-telemetry]");
  const status = dialog.querySelector("[data-admin-status]");
  button.addEventListener("click", async () => {
    button.disabled = true;
    const original = button.textContent;
    button.textContent = "Preparing download…";
    if (status) status.textContent = "Collecting Cascade Crush playtest telemetry…";
    try {
      const response = await fetch("/api/admin/cascade/telemetry/export", {
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.message || `Export failed with ${response.status}.`);
      const stamp = new Date().toISOString().replaceAll(":", "-");
      downloadJson(value, `cascade-crush-playtest-${stamp}.json`);
      if (status) {
        const players = Number(value?.totals?.players) || 0;
        const events = Number(value?.totals?.events) || 0;
        status.textContent = `Downloaded telemetry for ${players} player${players === 1 ? "" : "s"} · ${events.toLocaleString()} events.`;
      }
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : "Telemetry export failed.";
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  });
}

function watchForAdminDialog() {
  const existing = document.querySelector("#cascade-admin-dialog");
  if (existing) {
    installTelemetryExport(existing);
    return;
  }
  const observer = new MutationObserver(() => {
    const dialog = document.querySelector("#cascade-admin-dialog");
    if (!dialog) return;
    observer.disconnect();
    installTelemetryExport(dialog);
  });
  observer.observe(document.body, { childList: true });
}

watchForAdminDialog();
