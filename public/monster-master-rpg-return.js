const parameters = new URLSearchParams(window.location.search);
const campaignId = parameters.get("campaign")?.trim();

if (campaignId) {
  const returnHref = `/monster-master-rpg.html?campaign=${encodeURIComponent(campaignId)}`;
  let banner = null;

  function ensureBanner() {
    if (banner?.isConnected) return banner;
    const style = document.createElement("style");
    style.textContent = `
      .monster-master-rpg-return {
        position: fixed;
        z-index: 1200;
        left: 50%;
        bottom: max(22px, env(safe-area-inset-bottom));
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 18px;
        width: min(720px, calc(100% - 28px));
        padding: 16px 18px;
        border: 1px solid rgba(183, 246, 99, .48);
        border-radius: 15px;
        background: rgba(5, 12, 8, .96);
        color: #eff8e9;
        box-shadow: 0 20px 60px rgba(0, 0, 0, .58), inset 0 1px rgba(255, 255, 255, .04);
        transform: translateX(-50%);
      }
      .monster-master-rpg-return[hidden] { display: none; }
      .monster-master-rpg-return-copy { display: grid; gap: 4px; }
      .monster-master-rpg-return-copy small {
        color: #a7f43d;
        font-size: .65rem;
        font-weight: 900;
        letter-spacing: .16em;
      }
      .monster-master-rpg-return-copy strong { font-size: 1rem; }
      .monster-master-rpg-return-copy span { color: #aab7ad; font-size: .8rem; }
      .monster-master-rpg-return-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 0 17px;
        border: 1px solid rgba(167, 244, 61, .72);
        border-radius: 11px;
        background: linear-gradient(180deg, #b8ff57, #8fd52f);
        color: #0a1408;
        font-weight: 900;
        text-decoration: none;
        white-space: nowrap;
      }
      .monster-master-rpg-return-link:hover,
      .monster-master-rpg-return-link:focus-visible {
        filter: brightness(1.06);
        transform: translateY(-1px);
        outline: none;
      }
      @media (max-width: 620px) {
        .monster-master-rpg-return { grid-template-columns: 1fr; }
        .monster-master-rpg-return-link { width: 100%; }
      }
    `;
    document.head.append(style);

    banner = document.createElement("aside");
    banner.className = "monster-master-rpg-return";
    banner.hidden = true;
    banner.setAttribute("aria-live", "polite");

    const copy = document.createElement("span");
    copy.className = "monster-master-rpg-return-copy";
    const eyebrow = document.createElement("small");
    eyebrow.textContent = "CAMPAIGN ENCOUNTER COMPLETE";
    const heading = document.createElement("strong");
    heading.textContent = "Return to the Game Master";
    const detail = document.createElement("span");
    detail.textContent = "The terminal battle result has been committed. The campaign will resume from that outcome.";
    copy.append(eyebrow, heading, detail);

    const link = document.createElement("a");
    link.className = "monster-master-rpg-return-link";
    link.href = returnHref;
    link.textContent = "Return to campaign";
    banner.append(copy, link);
    document.body.append(banner);
    return banner;
  }

  function reflectView(view) {
    const lifecycle = view?.observation?.status?.lifecycle;
    ensureBanner().hidden = lifecycle === "active" || !lifecycle;
  }

  window.addEventListener("gameframe:monster-master-pixi-view", (event) => {
    reflectView(event.detail?.view);
  });
}
