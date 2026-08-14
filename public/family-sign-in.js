const POLL_INTERVAL_MS = 2000;

function deviceLabel() {
  const platform = navigator.userAgentData?.platform || navigator.platform || "device";
  const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches ? "GameFrame app" : "browser";
  return `${platform} ${standalone}`.slice(0, 100);
}

function installFamilySignIn(gate) {
  if (!gate || gate.querySelector("[data-family-sign-in]")) return;
  const card = gate.querySelector(".gameframe-auth-card");
  const login = gate.querySelector("[data-auth-login]");
  if (!card || !login) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "gameframe-auth-button";
  button.dataset.familySignIn = "";
  button.textContent = "Family sign-in";
  login.insertAdjacentElement("afterend", button);

  const panel = document.createElement("section");
  panel.dataset.familyPanel = "";
  panel.hidden = true;
  panel.innerHTML = `
    <form data-family-form>
      <label>
        <span>Email</span>
        <input data-family-email type="email" autocomplete="email" inputmode="email" required>
      </label>
      <button class="gameframe-auth-button" type="submit">Request this device</button>
    </form>
    <div data-family-status role="status" aria-live="polite"></div>
  `;
  button.insertAdjacentElement("afterend", panel);

  let pollTimer = null;
  const status = panel.querySelector("[data-family-status]");
  const form = panel.querySelector("[data-family-form]");

  function stopPolling() {
    if (pollTimer !== null) window.clearTimeout(pollTimer);
    pollTimer = null;
  }

  async function poll(requestId, claimToken, expiresAt) {
    if (Date.now() >= expiresAt) {
      status.textContent = "This request expired. Start a new family sign-in request.";
      return;
    }
    try {
      const response = await fetch("/auth/family/enroll/claim", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId, claimToken }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.status === "approved") {
        status.textContent = "Device approved. Opening GameFrame…";
        window.location.reload();
        return;
      }
    } catch {
      status.textContent = "Waiting for internet to finish device approval…";
    }
    pollTimer = window.setTimeout(() => void poll(requestId, claimToken, expiresAt), POLL_INTERVAL_MS);
  }

  button.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) panel.querySelector("[data-family-email]")?.focus();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    stopPolling();
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    status.textContent = "Creating approval request…";
    try {
      const response = await fetch("/auth/family/enroll/start", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: panel.querySelector("[data-family-email]").value,
          deviceLabel: deviceLabel(),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.requestId || !result.claimToken || !result.code) throw new Error("request_failed");
      const code = String(result.code).replace(/^(\d{3})(\d{3})$/, "$1 $2");
      status.innerHTML = "";
      const copy = document.createElement("p");
      copy.textContent = "Ask the GameFrame administrator to approve this device. Confirm this code matches:";
      const strong = document.createElement("strong");
      strong.textContent = code;
      strong.style.display = "block";
      strong.style.fontSize = "1.5rem";
      strong.style.letterSpacing = ".12em";
      status.append(copy, strong);
      void poll(result.requestId, result.claimToken, Number(result.expiresAt) || Date.now() + 10 * 60 * 1000);
    } catch {
      status.textContent = "The request could not be started. Check the connection and try again.";
    } finally {
      submit.disabled = false;
    }
  });
}

function scan() {
  installFamilySignIn(document.querySelector("#gameframe-auth-gate"));
}

scan();
new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
