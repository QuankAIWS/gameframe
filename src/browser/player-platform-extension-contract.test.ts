import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("GameFrame exposes Hall of Fame, Gamer Level, public profiles, and server-backed favorites", async () => {
  const navigation = await read("public/gameframe-nav.js");
  const navigationStyles = await read("public/gameframe-nav.css");
  const finalPolishStyles = await read("public/gameframe-final-polish.css");
  const home = await read("public/home-dashboard.js");
  const profile = await read("public/profile-app.js");
  const leaderboard = await read("public/leaderboard-app.js");
  const leaderboardHtml = await read("public/leaderboard.html");
  const cascadeSync = await read("public/cascade-progression-sync.js");
  const edgeWorker = await read("src/cloudflare/rpg-edge-worker.ts");
  const playerCoordinator = await read("src/cloudflare/player-platform-coordinator.ts");
  const playerRuntime = await read("src/cloudflare/player-platform-object-runtime.ts");
  const localPlatform = await read("src/server/in-memory-player-platform.ts");
  const nodeServer = await read("src/server/http-server.ts");
  const progression = await read("src/cloudflare/player-progression.ts");
  const packageJson = JSON.parse(await read("package.json"));

  assert.match(navigation, /data-gameframe-leaderboard/);
  assert.match(navigation, /href="\/leaderboard\.html"/);
  assert.match(navigation, /Hall of Fame/);
  assert.match(navigation, /gameframe-nav-label-compact/);
  assert.match(navigationStyles, /gameframe-nav-label-compact/);
  assert.match(navigationStyles, /font-size: \.48rem/);
  assert.match(finalPolishStyles, /@media \(max-width: 720px\)[\s\S]*?\.gameframe-destination-links a,[\s\S]*?min-width: 0;/);
  assert.match(finalPolishStyles, /@media \(max-width: 720px\)[\s\S]*?\.gameframe-session-badge[\s\S]*?min-width: 0;/);

  assert.match(home, /home-continue-card/);
  assert.match(home, /data-gamer-progression/);
  assert.match(home, /favoriteGameIds/);
  assert.match(home, /\/api\/me\/progression/);
  assert.match(home, /\/leaderboard\.html/);
  assert.doesNotMatch(home, /WHAT'S NEW/);

  assert.match(profile, /\/api\/me\/preferences/);
  assert.match(profile, /\/api\/me\/progression/);
  assert.match(profile, /\/api\/players\/\$\{encodeURIComponent\(viewedPlayerId\)\}\/profile/);
  assert.match(profile, /dataset\.favoriteGameId/);
  assert.match(profile, /aria-pressed/);
  assert.match(leaderboard, /\/api\/leaderboard/);
  assert.match(leaderboard, /gamerLevels/);
  assert.match(leaderboard, /profileHref/);
  assert.match(leaderboard, /entry\.points/);
  assert.match(leaderboardHtml, /<h1>Hall of Fame<\/h1>/);
  assert.match(cascadeSync, /\/api\/me\/cascade\/progression/);
  assert.match(cascadeSync, /cascade-progression-owner/);

  for (const runtime of [edgeWorker, nodeServer]) {
    assert.match(runtime, /\/api\/me\/preferences/);
    assert.match(runtime, /\/api\/me\/progression/);
    assert.match(runtime, /\/api\/me\/cascade\/progression/);
    assert.match(runtime, /\/api\/players\//);
    assert.match(runtime, /\/api\/leaderboard/);
  }
  assert.match(playerCoordinator, /updatePlayerPreferences/);
  assert.match(playerCoordinator, /readPlayerProgression/);
  assert.match(playerCoordinator, /readPublicPlayerProfile/);
  assert.match(playerCoordinator, /recordCascadeProgression/);
  assert.match(playerCoordinator, /readLeaderboard/);
  assert.match(playerCoordinator, /summary\.status\.lifecycle === "completed"/);
  assert.match(playerCoordinator, /Promise\.allSettled/);
  assert.match(playerRuntime, /gameframe:player-progression:v1/);
  assert.match(playerRuntime, /match:\$\{summary\.matchId\}/);
  assert.match(localPlatform, /#processedMatches/);
  assert.match(localPlatform, /recordCascadeProgression/);
  assert.match(progression, /completedMatch: 75/);
  assert.match(progression, /cascadeLevelClear: 100/);
  assert.match(progression, /Math\.pow\(normalized - 1, 1\.65\)/);

  assert.match(packageJson.scripts["check:browser"], /public\/leaderboard-app\.js/);
});
