let checking = false;
let installed = false;

async function installAdminLink() {
  if (installed || checking) return;
  const actions = document.querySelector("#gameframe-account-panel .gameframe-account-menu-actions");
  if (!actions) return;
  checking = true;
  try {
    const response = await fetch("/api/session", { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) return;
    const session = await response.json().catch(() => ({}));
    if (!session.admin || actions.querySelector("[data-family-admin-link]")) return;
    const link = document.createElement("a");
    link.href = "/family-admin.html";
    link.dataset.familyAdminLink = "";
    link.setAttribute("role", "menuitem");
    link.className = "gameframe-account-logout";
    link.innerHTML = `
      <span><strong>Family devices</strong><small>Approve or revoke trusted devices</small></span>
      <span aria-hidden="true">→</span>
    `;
    actions.prepend(link);
    installed = true;
  } catch {
    // The admin shortcut is convenience only; the page and API enforce authority.
  } finally {
    checking = false;
  }
}

void installAdminLink();
new MutationObserver(() => void installAdminLink()).observe(document.documentElement, { childList: true, subtree: true });
