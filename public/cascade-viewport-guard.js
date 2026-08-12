(() => {
  const nativeScrollIntoView = Element.prototype.scrollIntoView;
  if (typeof nativeScrollIntoView !== "function" || window.__cascadeViewportGuardInstalled) return;

  window.__cascadeViewportGuardInstalled = true;

  Element.prototype.scrollIntoView = function cascadeScopedScrollIntoView(...args) {
    const levelMap = this?.parentElement?.id === "level-map" ? this.parentElement : null;
    const isCurrentLevel = this?.classList?.contains?.("is-current") ?? false;

    if (levelMap && isCurrentLevel) {
      const itemTop = this.offsetTop;
      const itemBottom = itemTop + this.offsetHeight;
      const viewportTop = levelMap.scrollTop;
      const viewportBottom = viewportTop + levelMap.clientHeight;

      if (itemTop < viewportTop) {
        levelMap.scrollTop = itemTop;
      } else if (itemBottom > viewportBottom) {
        levelMap.scrollTop = Math.max(0, itemBottom - levelMap.clientHeight);
      }
      return;
    }

    return nativeScrollIntoView.apply(this, args);
  };
})();
