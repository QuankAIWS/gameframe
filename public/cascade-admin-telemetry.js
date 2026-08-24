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

function insertBeforeReset(panel, reset, section) {
  if (reset) panel.insertBefore(section, reset);
  else panel.append(section);
}

function installTelemetryExport(dialog) {
  if (dialog.querySelector("[data-admin-telemetry-export]")) return;
  const panel = dialog.querySelector(".cascade-admin-panel");
  const reset = dialog.querySelector(".cascade-admin-reset-section");
  if (!panel) return;
  const status = dialog.querySelector("[data-admin-status]");

  const telemetrySection = document.createElement("section");
  telemetrySection.className = "cascade-admin-section";
  telemetrySection.dataset.adminTelemetryExport = "";
  telemetrySection.innerHTML = `
    <small>PLAYTEST DATA</small>
    <p>Download server-custodied Cascade Crush play sessions, attempts, retries, hammer use, timing, progression events, and raw research telemetry.</p>
    <div class="cascade-admin-control-grid">
      <button type="button" data-download-cascade-telemetry>Download telemetry package</button>
    </div>
  `;
  insertBeforeReset(panel, reset, telemetrySection);

  const diagnosticsSection = document.createElement("section");
  diagnosticsSection.className = "cascade-admin-section";
  diagnosticsSection.dataset.adminDiagnosticsExport = "";
  diagnosticsSection.innerHTML = `
    <small>DIAGNOSTICS</small>
    <p>Capture the current and recent renderer state, then download the bounded renderer/error log with crashes, recoveries, browser discards, JavaScript errors, canvas loss, device/viewport facts, frame stalls, and recent effect pressure.</p>
    <div class="cascade-admin-control-grid">
      <button type="button" data-download-cascade-diagnostics>Capture & download diagnostic pack</button>
    </div>
  `;
  insertBeforeReset(panel, reset, diagnosticsSection);

  const telemetryButton = telemetrySection.querySelector("[data-download-cascade-telemetry]");
  telemetryButton.addEventListener("click", async () => {
    telemetryButton.disabled = true;
    const original = telemetryButton.textContent;
    telemetryButton.textContent = "Preparing download…";
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
      telemetryButton.disabled = false;
      telemetryButton.textContent = original;
    }
  });

  const diagnosticsButton = diagnosticsSection.querySelector("[data-download-cascade-diagnostics]");
  diagnosticsButton.addEventListener("click", async () => {
    diagnosticsButton.disabled = true;
    const original = diagnosticsButton.textContent;
    diagnosticsButton.textContent = "Capturing diagnostics…";
    if (status) status.textContent = "Capturing recent Cascade renderer state before download…";
    try {
      window.cascadeLifecycleDiagnostics?.reportVisualIssue?.("diagnostic_pack_requested");
      await window.cascadeDiagnosticsSync?.flush?.();
      const response = await fetch("/api/admin/cascade/diagnostics/export", {
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.message || `Diagnostics export failed with ${response.status}.`);
      const stamp = new Date().toISOString().replaceAll(":", "-");
      downloadJson(value, `cascade-crush-diagnostics-${stamp}.json`);
      if (status) {
        const incidents = Number(value?.totals?.incidents) || 0;
        const players = Number(value?.totals?.playersWithIncidents) || 0;
        status.textContent = `Captured and downloaded ${incidents.toLocaleString()} diagnostic incident${incidents === 1 ? "" : "s"} from ${players} player${players === 1 ? "" : "s"}.`;
      }
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : "Diagnostics export failed.";
    } finally {
      diagnosticsButton.disabled = false;
      diagnosticsButton.textContent = original;
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
