import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const unit = readFileSync(
  new URL("../../deploy/systemd/scribbles-gameframe-rpg.service", import.meta.url),
  "utf8",
);
const environment = readFileSync(
  new URL("../../deploy/systemd/scribbles-gameframe-rpg.env.example", import.meta.url),
  "utf8",
);
const runbook = readFileSync(
  new URL("../../planning/rpg-single-vm-deployment.md", import.meta.url),
  "utf8",
);

test("GameFrame RPG unit is ordered after GM and retires through SIGTERM", () => {
  assert.match(unit, /^Wants=.*rpg-gm-runtime\.service$/m);
  assert.match(unit, /^After=.*rpg-gm-runtime\.service$/m);
  assert.match(unit, /^ExecStart=\/usr\/bin\/npm run start:rpg-durable$/m);
  assert.match(unit, /^KillSignal=SIGTERM$/m);
  assert.match(unit, /^TimeoutStopSec=60s$/m);
  assert.match(unit, /^Restart=on-failure$/m);
});

test("GameFrame RPG unit is unprivileged and limits writable state", () => {
  assert.match(unit, /^User=game-master$/m);
  assert.match(unit, /^Group=game-master$/m);
  assert.match(unit, /^NoNewPrivileges=true$/m);
  assert.match(unit, /^ProtectSystem=strict$/m);
  assert.match(unit, /^ProtectHome=true$/m);
  assert.match(unit, /^CapabilityBoundingSet=$/m);
  assert.match(unit, /^ReadWritePaths=\/var\/lib\/game-master\/gameframe$/m);
  assert.match(unit, /^UMask=0077$/m);
});

test("environment template enables HMAC proxy auth and keeps both RPG processes on loopback", () => {
  assert.match(environment, /^GAMEFRAME_RPG_AUTH_MODE=hmac-proxy$/m);
  assert.match(environment, /^GAMEFRAME_RPG_PROXY_HMAC_SECRET=REPLACE_/m);
  assert.match(environment, /^GAMEFRAME_RPG_HOST=127\.0\.0\.1$/m);
  assert.match(environment, /^GAMEFRAME_RPG_PORT=8790$/m);
  assert.match(environment, /^RPG_GM_BASE_URL=http:\/\/127\.0\.0\.1:8791$/m);
  assert.match(environment, /^RPG_GM_SERVICE_TOKEN=REPLACE_/m);
  assert.doesNotMatch(environment, /^GAMEFRAME_ALLOW_DEVELOPMENT_AUTH=1$/m);
  assert.doesNotMatch(environment, /0\.0\.0\.0/);
});

test("canonical runbook routes public RPG traffic through Worker and Tunnel only", () => {
  assert.match(runbook, /Cloudflare Worker/);
  assert.match(runbook, /GAMEFRAME_RPG_ORIGIN_URL/);
  assert.match(runbook, /GAMEFRAME_RPG_PROXY_HMAC_SECRET/);
  assert.match(runbook, /origin hostname to `http:\/\/127\.0\.0\.1:8790`/);
  assert.match(runbook, /never expose port `8791` through Cloudflare Tunnel/);
  assert.match(runbook, /GameFrame SQLite database/);
  assert.match(runbook, /OpenClaw plugin-state directory/);
  assert.match(runbook, /runtime narrative-link file/);
  assert.match(runbook, /Backing up only one repository's state can produce irreconcilable/);
});
