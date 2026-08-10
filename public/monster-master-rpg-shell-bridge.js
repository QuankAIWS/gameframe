const events = document.querySelector("#mm-rpg-events");
const stage = document.querySelector("#mm-rpg-world .mm-rpg-world-stage");
const actionForm = document.querySelector("#mm-rpg-action-form");

// Authored approaches remain optional drafts. When a choice button loads its
// suggested action into the legacy composer, surface the new Action dock so the
// player can see/edit that draft instead of changing a hidden textarea.
events?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (!target.closest(".mm-rpg-choice-option")) return;
  queueMicrotask(() => {
    const action = document.querySelector("#mm-rpg-action");
    if (!(action instanceof HTMLTextAreaElement) || !action.value.trim()) return;
    window.gameFrameMonsterRpgInteractionShell?.openAction?.();
  });
});

// The Action dock has responsive text and therefore no trustworthy fixed
// height. Keep the nearby Talk control immediately above the actual rendered
// dock instead of relying on a guessed pixel offset that can still leave the
// Talk button underneath the form on narrower viewports.
function synchronizeTalkClearance() {
  if (!(stage instanceof HTMLElement) || !(actionForm instanceof HTMLElement)) return;
  const talkButton = stage.querySelector("#mm-rpg-talk-nearby");
  const talkChooser = stage.querySelector("#mm-rpg-talk-chooser");
  const actionOpen = actionForm.classList.contains("is-open");

  if (!(talkButton instanceof HTMLElement)) return;
  if (!actionOpen) {
    talkButton.style.removeProperty("bottom");
    if (talkChooser instanceof HTMLElement) talkChooser.style.removeProperty("bottom");
    return;
  }

  const stageRect = stage.getBoundingClientRect();
  const dockRect = actionForm.getBoundingClientRect();
  const dockHeightInsideStage = Math.max(0, stageRect.bottom - dockRect.top);
  const talkBottom = Math.ceil(dockHeightInsideStage + 16);
  talkButton.style.bottom = `${talkBottom}px`;
  if (talkChooser instanceof HTMLElement) {
    talkChooser.style.bottom = `${talkBottom + 52}px`;
  }
}

if (actionForm) {
  new MutationObserver(synchronizeTalkClearance).observe(actionForm, {
    attributes: true,
    attributeFilter: ["class"],
  });
  new ResizeObserver(synchronizeTalkClearance).observe(actionForm);
}
if (stage) {
  new MutationObserver(synchronizeTalkClearance).observe(stage, { childList: true });
}
window.addEventListener("resize", synchronizeTalkClearance);
queueMicrotask(synchronizeTalkClearance);
