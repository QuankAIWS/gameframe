import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("the player hub is a real game library with one semantic card-wide link per game", async () => {
  const launcher = await read("public/auth-launcher.js");
  const navigation = await read("public/gameframe-nav.js");
  const navigationStyles = await read("public/gameframe-nav.css");
  const navigationIntegrations = await read("public/gameframe-nav-integrations.css");
  const hub = await read("public/game-hub.js");
  const hubStyles = await read("public/game-hub.css");
  const hubShellStyles = await read("public/game-hub-shell.css");
  const hubCardStyles = await read("public/game-hub-cards.css");
  const hubFlowStyles = await read("public/game-hub-flow.css");
  const packageJson = JSON.parse(await read("package.json"));

  assert.ok(launcher.indexOf("gameframe-nav.js") < launcher.indexOf("game-hub.js"));
  assert.ok(launcher.indexOf("game-hub.js") < launcher.indexOf("await import(entry)"));
  assert.match(navigation, /data-gameframe-home/);
  assert.match(navigation, /Achievements/);
  assert.match(navigation, /Coming soon/);
  assert.doesNotMatch(navigation, />Games</);
  assert.match(navigation, /gameframe-nav-integrations\.css/);
  assert.match(navigation, /gameframe-shared-match-running/);
  assert.match(navigationStyles, /position: sticky/);
  assert.match(navigationStyles, /gameframe-destination-session-space/);
  assert.match(navigationIntegrations, /gameframe-monster-route/);
  assert.match(navigationIntegrations, /gameframe-shared-match-running/);
  assert.match(navigationIntegrations, /tic-noir-topbar/);

  assert.match(hub, /href: "\/monster-master\.html"/);
  assert.match(hub, /href: "\/othello\.html"/);
  assert.match(hub, /\?game=american-checkers&menu=1/);
  assert.match(hub, /\?game=tic-tac-toe&menu=1/);
  assert.match(hub, /document\.createElement\("a"\)/);
  assert.match(hub, /card\.href = game\.href/);
  assert.match(hub, /setAttribute\("aria-label", `Open the \$\{game\.title\} game menu`\)/);
  assert.match(hub, /class="game-card-play"/);
  assert.match(hub, /Play now/);
  assert.doesNotMatch(hub, /activateLibraryCard|playLink\.click/);
  assert.match(hub, /modeGrid\.hidden = true/);
  assert.match(hub, /game-menu-hero/);
  assert.match(hub, /Choose how to play/);
  assert.match(hub, /tacticalLink\?\.remove\(\)/);
  assert.match(hub, /hero\?\.querySelector\("\.game-hub-topbar"\)\?\.remove\(\)/);
  assert.doesNotMatch(hub, /href: "\/tactical\.html"/);
  assert.doesNotMatch(hub, /href: "\/combat\.html"/);

  assert.match(hubStyles, /game-hub-monster/);
  assert.match(hubShellStyles, /game-hub-discord-safe/);
  assert.match(hubCardStyles, /creature-atlas-v1\.svg/);
  assert.match(hubCardStyles, /piece-solar\.svg/);
  assert.match(hubCardStyles, /text-decoration: none/);
  assert.match(hubFlowStyles, /cursor: pointer/);
  assert.match(hubFlowStyles, /game-card:focus-visible/);
  assert.match(hubFlowStyles, /game-menu-hero/);
  assert.match(packageJson.scripts["check:browser"], /public\/gameframe-nav\.js/);
  assert.match(packageJson.scripts["check:browser"], /public\/game-hub\.js/);
});

test("Tic-Tac-Toe uses the universal destination bar and keeps its reviewed noir viewport", async () => {
  const launcher = await read("public/auth-launcher.js");
  const navigation = await read("public/gameframe-nav.js");
  const navigationStyles = await read("public/gameframe-nav.css");
  const navigationIntegrations = await read("public/gameframe-nav-integrations.css");
  const controller = await read("public/tic-tac-toe-noir.js");
  const styles = await read("public/tic-tac-toe-noir.css");
  const packageJson = JSON.parse(await read("package.json"));

  assert.ok(launcher.indexOf("gameframe-nav.js") < launcher.indexOf("tic-tac-toe-noir.js"));
  assert.ok(launcher.indexOf("tic-tac-toe-noir.js") < launcher.indexOf("await import(entry)"));
  assert.match(navigation, /navigationTheme/);
  assert.match(navigation, /TIC-TAC-TOE/);
  assert.match(navigationStyles, /body\.tic-tac-toe-noir-running \.tic-noir-topbar/);
  assert.match(navigationStyles, /grid-template-rows: minmax\(0, 1fr\) 48px/);
  assert.match(navigationIntegrations, /\.tic-noir-topbar/);

  assert.match(controller, /function isTicTacToeMatch/);
  assert.match(controller, /board-tic-tac-toe/);
  assert.match(controller, /tic-noir-control-rail/);
  assert.match(controller, /playerO/);
  assert.match(controller, /gameLayout\.append\(rail\)/);
  assert.match(controller, /copyInvite\?\.click/);
  assert.match(controller, /newMatch\?\.click/);
  assert.match(styles, /height: 100dvh/);
  assert.match(styles, /tic-board-breathe/);
  assert.match(styles, /tic-circuit-node/);
  assert.doesNotMatch(controller, /leaderboard|friends online|rating/i);
  assert.match(packageJson.scripts["check:browser"], /public\/tic-tac-toe-noir\.js/);
});

test("Monster Master uses one objective rendering, a player-relative turn queue, and no duplicate product header", async () => {
  const launcher = await read("public/auth-launcher.js");
  const navigationIntegrations = await read("public/gameframe-nav-integrations.css");
  const terrain = await read("public/monster-master-terrain.js");
  const correction = await read("public/monster-master-correction.js");
  const correctionStyles = await read("public/monster-master-correction.css");
  const packageJson = JSON.parse(await read("package.json"));

  assert.ok(launcher.indexOf("monster-master-polish.js") < launcher.indexOf("monster-master-correction.js"));
  assert.ok(launcher.indexOf("monster-master-correction.js") < launcher.indexOf("await import(entry)"));
  assert.match(navigationIntegrations, /\.monster-master-shell > \.hero/);
  assert.match(terrain, /if \(entry\.objective\) \{/);
  assert.match(terrain, /return undefined;\n      \}\n      this\.save\(\)/);
  assert.doesNotMatch(terrain, /this\.restore\(\);\n      if \(entry\.objective\)/);

  assert.match(correction, /function turnOrder\(view\)/);
  assert.match(correction, /right\.initiative - left\.initiative/);
  assert.match(correction, /observation\.activeUnitId/);
  assert.match(correction, /BLUE · YOU/);
  assert.match(correction, /RED · ENEMY/);
  assert.match(correction, /dataset\.monsterFriendlySeat/);
  assert.match(correction, /installCanvasColorRemap\("fillStyle"\)/);
  assert.match(correction, /combat-nav a\[href="\/combat\.html"\]/);
  assert.match(correctionStyles, /monster-master-turn-unit\.is-friendly/);
  assert.match(correctionStyles, /monster-master-turn-unit\.is-enemy/);
  assert.match(correctionStyles, /monster-master-roster-rail > \.tactical-player-grid/);
  assert.match(packageJson.scripts["check:browser"], /public\/monster-master-correction\.js/);
});
