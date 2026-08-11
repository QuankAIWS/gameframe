(() => {
  const FRESH_RUN_KEY = "scribbles-gameframe.cascade-fresh-run:v1";
  const ACTIVE_RUN_KEY = "scribbles-gameframe.cascade-active-run:v1";
  try {
    if (window.localStorage.getItem(FRESH_RUN_KEY) !== "1") return;
    window.localStorage.removeItem(ACTIVE_RUN_KEY);
    window.localStorage.removeItem(FRESH_RUN_KEY);
  } catch {
    // A fresh-run request is a convenience path; storage failure must not block Cascade boot.
  }
})();
