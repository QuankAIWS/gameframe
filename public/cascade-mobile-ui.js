const mobileQuery = window.matchMedia("(max-width: 700px) and (orientation: portrait)");
const movedCards = new Map();
let drawer = null;
let drawerContent = null;
let menuToggle = null;
let sideObserver = null;

function rememberAndMove(node) {
  if (!node || !drawerContent || node.parentElement === drawerContent) return;
  if (!movedCards.has(node)) {
    const placeholder = document.createComment(`cascade-mobile-placeholder:${node.id || node.className}`);
    node.parentNode?.insertBefore(placeholder, node);
    movedCards.set(node, placeholder);
  }
  drawerContent.append(node);
}

function restoreCards() {
  for (const [node, placeholder] of movedCards) {
    if (placeholder.isConnected) placeholder.replaceWith(node);
    else document.querySelector(".cascade-side")?.append(node);
  }
  movedCards.clear();
}

function mobileUtilityCards() {
  return [
    document.querySelector("#level-stars")?.closest(".cascade-performance-card"),
    document.querySelector("#streak")?.closest(".cascade-card"),
    document.querySelector("#cascade-feedback-card"),
  ].filter(Boolean);
}

function syncUtilityCards() {
  if (!mobileQuery.matches) {
    restoreCards();
    return;
  }
  for (const card of mobileUtilityCards()) rememberAndMove(card);
}

function closeDrawer() {
  if (!drawer?.open) return;
  drawer.close();
}

function installDrawer() {
  menuToggle = document.createElement("button");
  menuToggle.id = "cascade-mobile-menu-toggle";
  menuToggle.type = "button";
  menuToggle.setAttribute("aria-controls", "cascade-mobile-menu");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.innerHTML = '<span aria-hidden="true">☰</span><strong>Menu</strong>';

  drawer = document.createElement("dialog");
  drawer.id = "cascade-mobile-menu";
  drawer.className = "cascade-mobile-menu";
  drawer.setAttribute("aria-labelledby", "cascade-mobile-menu-title");
  drawer.innerHTML = `
    <section class="cascade-mobile-menu-sheet">
      <header class="cascade-mobile-menu-header">
        <div>
          <small>CASCADE CRUSH</small>
          <h2 id="cascade-mobile-menu-title">Game menu</h2>
        </div>
        <button type="button" data-cascade-mobile-close aria-label="Close game menu">×</button>
      </header>
      <div id="cascade-mobile-menu-content" class="cascade-mobile-menu-content"></div>
      <nav class="cascade-mobile-menu-nav" aria-label="Cascade navigation">
        <a href="/?catalog=1">All games</a>
        <a href="/">GameFrame home</a>
      </nav>
    </section>
  `;
  drawerContent = drawer.querySelector("#cascade-mobile-menu-content");

  document.body.append(menuToggle, drawer);

  menuToggle.addEventListener("click", () => {
    syncUtilityCards();
    drawer.showModal();
  });
  drawer.querySelector("[data-cascade-mobile-close]")?.addEventListener("click", closeDrawer);
  drawer.addEventListener("click", (event) => {
    if (event.target === drawer) closeDrawer();
  });
  drawer.addEventListener("close", () => menuToggle?.setAttribute("aria-expanded", "false"));
  drawer.addEventListener("cancel", () => menuToggle?.setAttribute("aria-expanded", "false"));
  drawer.addEventListener("toggle", () => menuToggle?.setAttribute("aria-expanded", drawer.open ? "true" : "false"));

  const side = document.querySelector(".cascade-side");
  if (side) {
    sideObserver = new MutationObserver(syncUtilityCards);
    sideObserver.observe(side, { childList: true });
  }
  syncUtilityCards();
}

function handleViewportChange() {
  if (!mobileQuery.matches) closeDrawer();
  syncUtilityCards();
}

installDrawer();
mobileQuery.addEventListener?.("change", handleViewportChange);
window.addEventListener("pagehide", () => sideObserver?.disconnect(), { once: true });
