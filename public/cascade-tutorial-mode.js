(() => {
  const params = new URLSearchParams(window.location.search);
  if (!navigator.webdriver || params.get("tutorials") === "force") return;
  const key = "scribbles-gameframe.cascade-tutorial:v1";
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, JSON.stringify({ enabled: false, seen: {} }));
})();
