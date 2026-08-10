const events = document.querySelector("#mm-rpg-events");

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
