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
  const invitations = await read("public/secure-match-invite.js");
  const combat = await read("public/combat.html");
  const packageJson = JSON.parse(await read("package.json"));

  assert.match(html, /data-entry="\/monster-master-app\.js"/);
  assert.match(html, /id="monster-master-canvas"/);
  assert.match(html, /id="monster-master-select-mend"/);
  assert.match(html, /Battlefield actions, targets, and resolved outcomes appear here\./);
  assert.match(html, /<details id="monster-master-invite-panel"/);
  assert.doesNotMatch(html, /Deploy your roster into the highlighted starting zone\./);
  assert.match(app, /const gameId = "monster-master-duel"/);
  assert.match(app, /gameFrameFetch/);
  assert.match(app, /type === "deploy-unit"/);
  assert.match(app, /type === "use-ability"/);
  assert.match(app, /commandByPlayer/);
  assert.doesNotMatch(app, /headers\.set\("x-gameframe-player-id"/);
  assert.match(invitations, /entry === "\/monster-master-app\.js"/);
  assert.match(invitations, /selector: "#monster-master-human"/);
  assert.match(invitations, /gameId: \(\) => "monster-master-duel"/);
  assert.match(combat, /href="\/monster-master\.html"/);
  assert.match(packageJson.scripts["check:browser"], /public\/monster-master-app\.js/);
});
