import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("GameFrame exposes Leaderboard, Gamer Level, public profiles, and server-backed favorites", async () => {
  const navigation = await read("public/gameframe-nav.js");
  const navigationStyles = await read("public/gameframe-nav.css");
  const finalPolishStyles = await read("public/gameframe-final-polish.css");
  const home = await read("public/home-dashboard.js");
  const profile = await read("public/profile-app.js");
  const leaderboard = await read("public/leaderboard-app.js");
  const leaderboardHtml = await read("public/leaderboard.html");
  const cascadeSync = await read("public/cascade-progression-sync.js");
  const cascadeTelemetry = await read("public/cascade-telemetry-sync.js");
  const alerts = await read("public/gameframe-alerts.js");
  const edgeWorker = await read("src/cloudflare/rpg-edge-worker.ts");
  const playerCoordinator = await read("src/cloudflare/player-platform-coordinator.ts");
  const playerRuntime = await read("src/cloudflare/player-platform-object-runtime.ts");
  const localPlatform = await read("src/server/in-memory-player-platform.ts");
  const nodeServer = await read("src/server/http-server.ts");
  const progression = await read("src/cloudflare/player-progression.ts");
  const packageJson = JSON.parse(await read("package.json"));

  assert.match(navigation, /data-gameframe-leaderboard/);
  assert.match(navigation, /href="\/leaderboard\.html"/);
  assert.match(navigation, /Leaderboard/);
  assert.doesNotMatch(navigation, /Hall of Fame/);
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
  assert.match(home, />Leaderboard<\/a>/);
  assert.match(home, /cascade-progression-candidate/);
  assert.match(home, /localStorage\.removeItem\(CASCADE_CANDIDATE_KEY\)/);
  assert.doesNotMatch(home, /WHAT'S NEW/);

  assert.match(profile, /\/api\/me\/preferences/);
  assert.match(profile, /\/api\/me\/progression/);
  assert.match(profile, /encodeURIComponent\(viewedPlayerId\)/);
  assert.match(profile, /data-private-profile/);
  assert.match(profile, /dataset\.favoriteGameId/);
  assert.match(profile, /aria-pressed/);
  assert.match(leaderboard, /\/api\/leaderboard/);
  assert.match(leaderboard, /gamerLevels/);
  assert.match(leaderboard, /profileHref/);
  assert.match(leaderboard, /entry\.points/);
  assert.doesNotMatch(leaderboard, /Hall of Fame/);
  assert.match(leaderboardHtml, /<h1>Leaderboard<\/h1>/);
  assert.doesNotMatch(leaderboardHtml, /Hall of Fame/);

  assert.match(cascadeSync, /\/api\/me\/progression/);
  assert.match(cascadeSync, /\/api\/me\/cascade\/progression/);
  assert.match(cascadeSync, /cascade-progression-owner/);
  assert.match(cascadeSync, /cascade-progression-candidate/);
  assert.match(cascadeSync, /cascade-progression-visit/);
  assert.match(cascadeSync, /sessionStorage\.getItem\(VISIT_KEY\)/);
  assert.match(cascadeSync, /candidate\?\.playerId === identity\.playerId/);
  assert.match(cascadeSync, /candidate\.visitId !== currentVisitId/);
  assert.match(cascadeSync, /JSON\.stringify\(\{ playerId, visitId: currentVisitId \}\)/);
  assert.match(cascadeSync, /Math\.max\([\s\S]*server\?\.highestCompletedLevel/);
  assert.match(cascadeSync, /starsByLevel\[level\] = Math\.max/);
  assert.match(cascadeSync, /LOCAL_CHANGE_INTERVAL_MS = 1_000/);
  assert.match(cascadeSync, /SERVER_RECONCILE_INTERVAL_MS = 5 \* 60 \* 1_000/);
  assert.match(cascadeSync, /body\?\.cascade \?\? body\?\.progression\?\.cascade/);
  assert.match(cascadeSync, /JSON\.stringify\(current\) === lastSubmitted/);
  assert.doesNotMatch(cascadeSync, /SYNC_INTERVAL_MS = 750/);

  assert.match(alerts, /const refreshIntervalMs = 60_000/);
  assert.match(alerts, /document\.visibilityState === "visible"/);
  assert.doesNotMatch(alerts, /const refreshIntervalMs = 5000/);
  assert.match(cascadeTelemetry, /HEARTBEAT_INTERVAL_MS = 5 \* 60 \* 1_000/);
  assert.match(cascadeTelemetry, /document\.hidden \|\| Date\.now\(\) - lastInputAt > IDLE_AFTER_MS/);
  assert.doesNotMatch(cascadeTelemetry, /HEARTBEAT_INTERVAL_MS = 30_000/);

  for (const runtime of [edgeWorker, nodeServer]) {
    assert.match(runtime, /\/api\/me\/preferences/);
    assert.match(runtime, /\/api\/me\/progression/);
    assert.match(runtime, /\/api\/me\/cascade\/progression/);
    assert.match(runtime, /publicPlayerProfileRoute/);
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

test("trusted family devices preserve human authorization and PWA auth/cache boundaries", async () => {
  const gameFrameAuth = await read("public/gameframe-auth.js");
  const serviceWorker = await read("public/sw.js");
  const familyEdge = await read("src/cloudflare/family-auth-edge.ts");
  const familyRuntime = await read("src/cloudflare/family-auth-object-runtime.ts");
  const worker = await read("src/cloudflare/worker.ts");
  const wrangler = await read("wrangler.jsonc");

  assert.match(gameFrameAuth, /\/auth\/trusted-device\/refresh/);
  assert.match(gameFrameAuth, /\/auth\/trusted-device\/logout/);
  assert.match(gameFrameAuth, /await refreshTrustedSession\(\)/);

  assert.match(serviceWorker, /pathname\.startsWith\("\/api\/"\)/);
  assert.match(serviceWorker, /pathname\.startsWith\("\/auth\/"\)/);
  assert.doesNotMatch(serviceWorker, /trusted-device\/refresh/);
  assert.doesNotMatch(serviceWorker, /gameframe_session/);

  assert.match(familyEdge, /GAMEFRAME_FAMILY_AUTH_PEPPER/);
  assert.match(familyEdge, /GAMEFRAME_FAMILY_APPROVAL_SECRET/);
  assert.match(familyEdge, /configured\.length < 32/);
  assert.match(familyEdge, /source: "discord"/);
  assert.match(familyEdge, /secretHash: await sha256Hex\(deviceSecret\)/);
  assert.match(familyEdge, /clearTrustedCookie\(\)/);
  assert.match(familyEdge, /clearWebsiteSessionCookie\(\)/);
  assert.match(familyRuntime, /revokedAt/);
  assert.match(familyRuntime, /secretHash/);
  assert.match(worker, /familyAuthEdgeRoute/);
  assert.match(worker, /FamilyAuthObjectRuntime/);

  for (const name of [
    "GAMEFRAME_FAMILY_ACCOUNTS",
    "GAMEFRAME_FAMILY_AUTH_PEPPER",
    "GAMEFRAME_FAMILY_APPROVAL_SECRET",
  ]) {
    assert.match(wrangler, new RegExp(name));
  }
});
