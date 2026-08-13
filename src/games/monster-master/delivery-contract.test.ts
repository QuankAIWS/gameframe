import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createGameFrameWorker } from "../../cloudflare/worker-router.ts";
import type { GameFrameWorkerEnv } from "../../cloudflare/runtime-contracts.ts";

const read = (path: string) => readFile(new URL(`../../../${path}`, import.meta.url), "utf8");

const environment: GameFrameWorkerEnv = {
  SESSION_SECRET: "0123456789abcdef0123456789abcdef",
  MATCHES: {
    idFromName: (name) => name,
    get: () => ({ fetch: async () => new Response("unused", { status: 500 }) }),
  },
};

test("Cloudflare health advertises the Monster Master authoritative runtime", async () => {
  const response = await createGameFrameWorker().fetch(
    new Request("https://games.example/api/health"),
    environment,
  );
  assert.equal(response.status, 200);
  const health = await response.json() as { games: string[] };
  assert.ok(health.games.includes("monster-master-duel"));
});

test("Monster Master browser delivery uses authenticated GameFrame boundaries", async () => {
  const html = await read("public/monster-master.html");
  const app = await read("public/monster-master-app.js");
  const launcher = await read("public/auth-launcher.js");
  const shell = await read("public/monster-master-shell.js");
  const destinationBar = await read("public/gameframe-nav.js");
  const trainerStyles = await read("public/monster-master-trainer.css");
  const pixiStyles = await read("public/monster-master-pixi.css");
  const battlefieldEffects = await read("public/monster-master-battlefield-effects.js");
  const gestures = await read("public/monster-master-gestures.js");
  const invitations = await read("public/secure-match-invite.js");
  const combat = await read("public/combat.html");
  const notices = await read("THIRD_PARTY_NOTICES.md");
  const packageJson = JSON.parse(await read("package.json"));

  assert.match(html, /data-entry="\/monster-master-app\.js"/);
  assert.match(html, /id="monster-master-canvas"/);
  assert.match(html, /id="monster-master-select-mend"/);
  assert.match(html, /Take the field as the human Monster Master/);
  assert.match(html, /deploy three creatures beside you/);
  assert.match(html, /If a Master falls, the round is over/);
  assert.match(html, /class="monster-master-board-briefing"/);
  assert.match(html, /Battlefield actions, targets, and resolved outcomes appear here\./);
  assert.match(html, /monster-master-trainer\.css/);
  assert.match(html, /<details id="monster-master-invite-panel"/);
  assert.doesNotMatch(html, /monster-master-match-topbar/);
  assert.doesNotMatch(html, /Warden Duel/);

  assert.match(destinationBar, /gameframe:destination-bar-ready/);
  assert.match(shell, /setupButton\.id = "monster-master-new-match"/);
  assert.match(shell, /#gameframe-destination-bar \.gameframe-destination-links/);
  assert.match(shell, /destinationLinks\.insertBefore\(setupButton/);
  assert.match(shell, /replaceAll\("Warden Master", "Verdant Sage"\)/);
  assert.match(trainerStyles, /\.gameframe-destination-links \.monster-master-nav-setup/);
  assert.match(trainerStyles, /body:has\(#monster-master-match:not\(\[hidden\]\)\)/);
  assert.match(pixiStyles, /\.gameframe-destination-links button\[disabled\]/);
  assert.doesNotMatch(pixiStyles, /\.gameframe-destination-links button \{\s*display: none !important;/);

  assert.match(app, /const gameId = "monster-master-duel"/);
  assert.match(app, /gameFrameFetch/);
  assert.match(app, /type === "deploy-unit"/);
  assert.match(app, /type === "use-ability"/);
  assert.match(app, /commandByPlayer/);
  assert.match(app, /window\.gameFrameMonsterController = Object\.freeze/);
  assert.doesNotMatch(app, /headers\.set\("x-gameframe-player-id"/);

  assert.match(launcher, /legacy-renderer-fallback/);
  assert.match(launcher, /window\.gameFrameMonsterPixi\?\.ready/);
  assert.match(launcher, /window\.location\.reload/);
  assert.match(launcher, /monster-master-battlefield-effects\.js/);
  assert.match(launcher, /monster-master-gestures\.js/);
  assert.match(launcher, /monster-master-legacy-fallback/);

  assert.match(battlefieldEffects, /gameframe:monster-master-pixi-view/);
  assert.match(battlefieldEffects, /unit-moved/);
  assert.match(battlefieldEffects, /unit-damaged/);
  assert.match(battlefieldEffects, /unit-healed/);
  assert.match(battlefieldEffects, /unit-defeated/);
  assert.match(battlefieldEffects, /worldToScreen/);
  assert.match(gestures, /pointerType !== "touch"/);
  assert.match(gestures, /gameFrameMonsterPixiBridge\?\.panScreen/);
  assert.match(gestures, /monster-master-zoom-in/);
  assert.match(gestures, /monster-master-zoom-out/);

  assert.match(notices, /## PixiJS/);
  assert.match(notices, /License: MIT/);
  assert.match(notices, /public\/monster-master-pixi-bundle\.js/);

  assert.match(invitations, /entry === "\/monster-master-app\.js"/);
  assert.match(invitations, /selector: "#monster-master-human"/);
  assert.match(invitations, /gameId: \(\) => "monster-master-duel"/);
  assert.match(combat, /href="\/monster-master\.html"/);
  assert.match(packageJson.scripts["check:browser"], /public\/monster-master-app\.js/);
  assert.match(packageJson.scripts["check:browser"], /public\/monster-master-battlefield-effects\.js/);
  assert.match(packageJson.scripts["check:browser"], /public\/monster-master-gestures\.js/);
});