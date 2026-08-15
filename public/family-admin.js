const API_TIMEOUT_MS = 12_000;
const errorBox = document.querySelector("#family-admin-error");
const statusBox = document.querySelector("#family-admin-status");
const enrollmentList = document.querySelector("#family-enrollment-list");
const deviceList = document.querySelector("#family-device-list");
const refreshButton = document.querySelector("#family-admin-refresh");
const approvalInput = document.querySelector("#family-approval-credential");
const forgetButton = document.querySelector("#family-approval-forget");
let mutationActive = false;
let refreshInFlight = null;

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = !message;
}

function showStatus(message) {
  statusBox.textContent = message;
  statusBox.hidden = !message;
}

function when(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp).toLocaleString() : "Unknown";
}

async function api(path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(path, {
      credentials: "same-origin",
      ...options,
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.message || body.error || `Request failed with ${response.status}.`);
      error.status = response.status;
      throw error;
    }
    return body;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("GameFrame did not respond within 12 seconds. Try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function empty(text) {
  const p = document.createElement("p");
  p.textContent = text;
  return p;
}

function approvalCredential() {
  return approvalInput.value.trim();
}

function setMutation(active) {
  mutationActive = active;
  refreshButton.disabled = active;
  forgetButton.disabled = active;
}

function setRowBusy(row, active) {
  for (const button of row.querySelectorAll("button")) button.disabled = active;
}

function renderEnrollments(requests) {
  enrollmentList.replaceChildren();
  if (!requests.length) {
    enrollmentList.append(empty("No pending enrollment requests."));
    return;
  }
  for (const request of requests) {
    const row = document.createElement("article");
    row.className = "family-admin-row";
    row.innerHTML = `
      <div class="family-admin-row-copy">
        <strong></strong>
        <b class="family-admin-code"></b>
        <span></span>
        <small></small>
      </div>
      <div class="family-admin-actions">
        <button data-approve type="button">Approve device</button>
        <button data-remove data-danger type="button">Remove request</button>
      </div>
    `;
    row.querySelector("strong").textContent = request.displayName || request.playerId;
    row.querySelector(".family-admin-code").textContent = String(request.code || "").replace(/^(\d{3})(\d{3})$/, "$1 $2");
    row.querySelector("span").textContent = request.deviceLabel || "Device";
    row.querySelector("small").textContent = `Expires ${when(request.expiresAt)}`;

    const approveButton = row.querySelector("[data-approve]");
    approveButton.addEventListener("click", async () => {
      const credential = approvalCredential();
      if (!credential) {
        showStatus("");
        showError("Enter the Family Device Approval credential above, then approve the device.");
        approvalInput.focus();
        return;
      }

      setMutation(true);
      setRowBusy(row, true);
      approveButton.textContent = "Approving…";
      showError("");
      showStatus(`Approving ${request.deviceLabel || "device"}…`);
      let approved = false;
      try {
        await api("/api/admin/family/enrollments/approve", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-gameframe-family-approval": credential,
          },
          body: JSON.stringify({ requestId: request.requestId }),
        });
        approved = true;
        showStatus(`Approved ${request.deviceLabel || "device"}. The requesting browser can finish signing in now.`);
      } catch (error) {
        if (error?.status === 403) {
          approvalInput.value = "";
          approvalInput.focus();
        }
        showStatus("");
        showError(error instanceof Error ? error.message : "Approval failed.");
      } finally {
        approveButton.textContent = "Approve device";
        setRowBusy(row, false);
        setMutation(false);
      }
      if (approved) await refresh();
    });

    const removeButton = row.querySelector("[data-remove]");
    removeButton.addEventListener("click", async () => {
      setMutation(true);
      setRowBusy(row, true);
      removeButton.textContent = "Removing…";
      showError("");
      showStatus(`Removing pending request for ${request.deviceLabel || "device"}…`);
      let removed = false;
      try {
        await api("/api/admin/family/enrollments/remove", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ requestId: request.requestId }),
        });
        removed = true;
        showStatus(`Removed the pending request for ${request.deviceLabel || "device"}.`);
      } catch (error) {
        showStatus("");
        showError(error instanceof Error ? error.message : "Request removal failed.");
      } finally {
        removeButton.textContent = "Remove request";
        setRowBusy(row, false);
        setMutation(false);
      }
      if (removed) await refresh();
    });

    enrollmentList.append(row);
  }
}

function renderDevices(devices) {
  deviceList.replaceChildren();
  if (!devices.length) {
    deviceList.append(empty("No trusted family devices have been enrolled."));
    return;
  }
  for (const device of devices) {
    const row = document.createElement("article");
    row.className = "family-admin-row";
    row.innerHTML = `
      <div class="family-admin-row-copy">
        <strong></strong>
        <span></span>
        <small></small>
      </div>
      <button data-danger type="button">Revoke</button>
    `;
    row.querySelector("strong").textContent = device.displayName || device.playerId;
    row.querySelector("span").textContent = `${device.deviceLabel || "Device"}${device.revokedAt ? " · REVOKED" : ""}`;
    row.querySelector("small").textContent = `Last used ${when(device.lastUsedAt)} · expires ${when(device.expiresAt)}`;
    const button = row.querySelector("button");
    button.disabled = Boolean(device.revokedAt);
    button.addEventListener("click", async () => {
      setMutation(true);
      setRowBusy(row, true);
      button.textContent = "Revoking…";
      showError("");
      showStatus(`Revoking ${device.deviceLabel || "device"}…`);
      let revoked = false;
      try {
        await api("/api/admin/family/devices/revoke", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ deviceId: device.deviceId }),
        });
        revoked = true;
        showStatus(`Revoked ${device.deviceLabel || "device"}.`);
      } catch (error) {
        showStatus("");
        showError(error instanceof Error ? error.message : "Revocation failed.");
      } finally {
        button.textContent = "Revoke";
        setRowBusy(row, false);
        setMutation(false);
      }
      if (revoked) await refresh();
    });
    deviceList.append(row);
  }
}

async function performRefresh() {
  refreshButton.disabled = true;
  try {
    const session = await api("/api/session");
    if (!session.admin) throw new Error("This page requires a GameFrame administrator session.");
    const [enrollments, devices] = await Promise.all([
      api("/api/admin/family/enrollments"),
      api("/api/admin/family/devices"),
    ]);
    if (mutationActive) return;
    renderEnrollments(Array.isArray(enrollments.requests) ? enrollments.requests : []);
    renderDevices(Array.isArray(devices.devices) ? devices.devices : []);
    showError("");
  } catch (error) {
    if (!mutationActive) showError(error instanceof Error ? error.message : "Family device administration is unavailable.");
  } finally {
    refreshButton.disabled = mutationActive;
  }
}

function refresh() {
  if (mutationActive) return Promise.resolve();
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = performRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

forgetButton.addEventListener("click", () => {
  approvalInput.value = "";
  showStatus("Approval credential forgotten for this page visit.");
  approvalInput.focus();
});
refreshButton.addEventListener("click", () => void refresh());
void refresh();
window.setInterval(() => {
  if (!document.hidden && !mutationActive) void refresh();
}, 5000);
