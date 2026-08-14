const errorBox = document.querySelector("#family-admin-error");
const enrollmentList = document.querySelector("#family-enrollment-list");
const deviceList = document.querySelector("#family-device-list");
const refreshButton = document.querySelector("#family-admin-refresh");
let approvalCredential = "";

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = !message;
}

function when(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp).toLocaleString() : "Unknown";
}

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || `Request failed with ${response.status}.`);
  return body;
}

function empty(text) {
  const p = document.createElement("p");
  p.textContent = text;
  return p;
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
      <button type="button">Approve device</button>
    `;
    row.querySelector("strong").textContent = request.displayName || request.playerId;
    row.querySelector(".family-admin-code").textContent = String(request.code || "").replace(/^(\d{3})(\d{3})$/, "$1 $2");
    row.querySelector("span").textContent = request.deviceLabel || "Device";
    row.querySelector("small").textContent = `Expires ${when(request.expiresAt)}`;
    row.querySelector("button").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      if (!approvalCredential) {
        approvalCredential = window.prompt("Enter the separate Family Device Approval credential. It is kept only in this page's memory for this visit.")?.trim() || "";
      }
      if (!approvalCredential) return;
      button.disabled = true;
      try {
        await api("/api/admin/family/enrollments/approve", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-gameframe-family-approval": approvalCredential,
          },
          body: JSON.stringify({ requestId: request.requestId }),
        });
        showError("");
        await refresh();
      } catch (error) {
        approvalCredential = "";
        showError(error instanceof Error ? error.message : "Approval failed.");
      } finally {
        button.disabled = false;
      }
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
      if (!window.confirm(`Revoke ${device.deviceLabel || "this device"}? It will no longer be able to refresh its GameFrame session.`)) return;
      button.disabled = true;
      try {
        await api("/api/admin/family/devices/revoke", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ deviceId: device.deviceId }),
        });
        showError("");
        await refresh();
      } catch (error) {
        showError(error instanceof Error ? error.message : "Revocation failed.");
        button.disabled = false;
      }
    });
    deviceList.append(row);
  }
}

async function refresh() {
  refreshButton.disabled = true;
  try {
    const session = await api("/api/session");
    if (!session.admin) throw new Error("This page requires a GameFrame administrator session.");
    const [enrollments, devices] = await Promise.all([
      api("/api/admin/family/enrollments"),
      api("/api/admin/family/devices"),
    ]);
    renderEnrollments(Array.isArray(enrollments.requests) ? enrollments.requests : []);
    renderDevices(Array.isArray(devices.devices) ? devices.devices : []);
    showError("");
  } catch (error) {
    showError(error instanceof Error ? error.message : "Family device administration is unavailable.");
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener("click", () => void refresh());
void refresh();
window.setInterval(() => {
  if (!document.hidden) void refresh();
}, 5000);
