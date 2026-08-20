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

function syncCompactPlaySurface() {
  const destinationBar = document.querySelector("#gameframe-destination-bar");
  const destinationBrand = destinationBar?.querySelector(".gameframe-destination-brand");
  const shell = document.querySelector(".cascade-shell");
  const objective = document.querySelector(".cascade-objective");
  const objectiveLabel = document.querySelector("#objective-label");
  const weeklyLeaderboard = document.querySelector("[data-weekly-leaderboard]");
  if (mobileQuery.matches) {
    // The compact header and portrait shell both use explicit viewport-derived
    // heights. Count their padding inside those heights so the document never
    // grows a few meaningless pixels of vertical scrolling.
    destinationBar?.style.setProperty("box-sizing", "border-box");
    destinationBrand?.style.setProperty("box-sizing", "border-box");
    shell?.style.setProperty("box-sizing", "border-box");
    // Cascade inherits a slightly reduced root font size on phone widths. Keep
    // both the objective container and its label comfortably above the
    // older-eye readability floor; the label has its own inherited CSS rule.
    objective?.style.setProperty("font-size", "1.08rem");
    objectiveLabel?.style.setProperty("font-size", "1.08rem");
    weeklyLeaderboard?.style.setProperty("display", "none");
  } else {
    destinationBar?.style.removeProperty("box-sizing");
    destinationBrand?.style.removeProperty("box-sizing");
    shell?.style.removeProperty("box-sizing");
    objective?.style.removeProperty("font-size");
    objectiveLabel?.style.removeProperty("font-size");
    weeklyLeaderboard?.style.removeProperty("display");
  }
}

function syncUtilityCards() {
  syncCompactPlaySurface();
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
  menuToggle.hidden = !mobileQuery.matches;
  menuToggle.style.minWidth = "48px";
  menuToggle.style.minHeight = "48px";
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
  const closeButton = drawer.querySelector("[data-cascade-mobile-close]");
  if (closeButton) {
    closeButton.style.minWidth = "48px";
    closeButton.style.minHeight = "48px";
    closeButton.addEventListener("click", closeDrawer);
  }

  document.body.append(menuToggle, drawer);

  menuToggle.addEventListener("click", () => {
    syncUtilityCards();
    menuToggle.setAttribute("aria-expanded", "true");
    drawer.showModal();
  });
  drawer.addEventListener("click", (event) => {
    if (event.target === drawer) closeDrawer();
  });
  drawer.addEventListener("close", () => menuToggle?.setAttribute("aria-expanded", "false"));
  drawer.addEventListener("cancel", () => menuToggle?.setAttribute("aria-expanded", "false"));

  const side = document.querySelector(".cascade-side");
  if (side) {
    sideObserver = new MutationObserver(syncUtilityCards);
    sideObserver.observe(side, { childList: true, subtree: true });
  }
  syncUtilityCards();
}

function handleViewportChange() {
  if (menuToggle) menuToggle.hidden = !mobileQuery.matches;
  if (!mobileQuery.matches) closeDrawer();
  syncUtilityCards();
}

installDrawer();
mobileQuery.addEventListener?.("change", handleViewportChange);
window.addEventListener("pagehide", () => sideObserver?.disconnect(), { once: true });
