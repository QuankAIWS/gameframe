import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("GameFrame exposes Leaderboard, server-backed favorites, and Home news", async () => {
  const navigation = await read("public/gameframe-nav.js");
  const navigationStyles = await read("public/gameframe-nav.css");
  const home = await read("public/home-dashboard.js");
  const profile = await read("public/profile-app.js");
  const leaderboard = await read("public/leaderboard-app.js");
  const leaderboardHtml = await read("public/leaderboard.html");
  const packageJson = JSON.parse(await read("package.json"));

  assert.match(navigation, /data-gameframe-leaderboard/);
  assert.match(navigation, /href="\/leaderboard\.html"/);
  assert.match(navigation, /gameframe-nav-label-compact/);
  assert.match(navigationStyles, /gameframe-nav-label-compact/);
  assert.match(navigationStyles, /font-size: \.48rem/);

  assert.match(home, /WHAT'S NEW/);
  assert.match(home, /home-favorites-section/);
  assert.match(home, /favoriteGameIds/);
  assert.match(home, /\/leaderboard\.html/);

  assert.match(profile, /\/api\/me\/preferences/);
  assert.match(profile, /data\.favoriteGameId/);
  assert.match(profile, /aria-pressed/);
  assert.match(leaderboard, /\/api\/leaderboard/);
  assert.match(leaderboard, /entry\.points/);
  assert.match(leaderboardHtml, /<h1>Leaderboard<\/h1>/);
  assert.match(packageJson.scripts["check:browser"], /public\/leaderboard-app\.js/);
});
