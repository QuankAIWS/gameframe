import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("the player hub exposes real games, a future achievements destination, and no internal canaries", async () => {
  const launcher = await read("public/auth-launcher.js");
  const hub = await read("public/game-hub.js");
  const hubStyles = await read("public/game-hub.css");
  const hubShellStyles = await read("public/game-hub-shell.css");
  const hubCardStyles = await read("public/game-hub-cards.css");
  const ticStyles = await read("public/tic-tac-toe-noir.css");
  const packageJson = JSON.parse(await read("package.json"));

  assert.ok(launcher.indexOf("game-hub.js") < launcher.indexOf("await import(entry)"));
  assert.match(hub, /href: "\/monster-master\.html"/);
  assert.match(hub, /href: "\/othello\.html"/);
  assert.match(hub, /Clockwork Checkers/);
  assert.match(hub, /Tic-Tac-Toe/);
  assert.match(hub, /id="game-hub-achievements"/);
  assert.match(hub, /Coming soon/);
  assert.match(hub, /game-card-visual/);
  assert.match(hub, /game-hub-shell\.css/);
  assert.match(hub, /game-hub-cards\.css/);
  assert.match(hub, /tacticalLink\?\.remove\(\)/);
  assert.doesNotMatch(hub, /href: "\/tactical\.html"/);
  assert.doesNotMatch(hub, /href: "\/combat\.html"/);
  assert.match(hubStyles, /game-hub-monster/);
  assert.match(hubShellStyles, /game-hub-topbar/);
  assert.match(hubShellStyles, /game-hub-discord-safe/);
  assert.match(hubCardStyles, /creature-atlas-v1\.svg/);
  assert.match(hubCardStyles, /piece-solar\.svg/);
  assert.match(hubCardStyles, /hub-tic-grid/);
  assert.match(ticStyles, /\.gameframe-game-hub-lobby \.hero > \.eyebrow/);
  assert.match(ticStyles, /display: none !important/);
  assert.match(packageJson.scripts["check:browser"], /public\/game-hub\.js/);
});

test("Tic-Tac-Toe uses a real viewport noir shell and returns to the game library", async () => {
  const launcher = await read("public/auth-launcher.js");
  const controller = await read("public/tic-tac-toe-noir.js");
  const styles = await read("public/tic-tac-toe-noir.css");
  const packageJson = JSON.parse(await read("package.json"));

  assert.ok(launcher.indexOf("game-hub.js") < launcher.indexOf("tic-tac-toe-noir.js"));
  assert.ok(launcher.indexOf("tic-tac-toe-noir.js") < launcher.indexOf("await import(entry)"));
  assert.match(controller, /function isTicTacToeMatch/);
  assert.match(controller, /board-tic-tac-toe/);
  assert.match(controller, /tic-noir-topbar/);
  assert.match(controller, /tic-noir-control-rail/);
  assert.match(controller, /href="\/"/);
  assert.match(controller, /Back to games/);
  assert.match(controller, /copyInvite\?\.click/);
  assert.match(controller, /newMatch\?\.click/);
  assert.match(controller, /dataset|classList\.toggle\("tic-tac-toe-noir-running"/);
  assert.match(styles, /height: 100dvh/);
  assert.match(styles, /tic-noir-discord-safe/);
  assert.match(styles, /grid-template-columns: minmax\(172px, 230px\) minmax\(360px, 1fr\) minmax\(190px, 250px\)/);
  assert.match(styles, /tic-board-pulse/);
  assert.match(styles, /tic-circuit-drift/);
  assert.doesNotMatch(controller, /leaderboard|friends online|rating/i);
  assert.match(packageJson.scripts["check:browser"], /public\/tic-tac-toe-noir\.js/);
});

test("Monster Master uses one objective rendering and a player-relative turn queue", async () => {
  const launcher = await read("public/auth-launcher.js");
  const terrain = await read("public/monster-master-terrain.js");
  const correction = await read("public/monster-master-correction.js");
  const correctionStyles = await read("public/monster-master-correction.css");
  const packageJson = JSON.parse(await read("package.json"));

  assert.ok(launcher.indexOf("monster-master-polish.js") < launcher.indexOf("monster-master-correction.js"));
  assert.ok(launcher.indexOf("monster-master-correction.js") < launcher.indexOf("await import(entry)"));
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
