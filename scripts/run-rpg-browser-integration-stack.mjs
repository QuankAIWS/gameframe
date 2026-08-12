import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { signGameFrameProxyRequest } from "../src/auth/hmac-proxy-request-authenticator.ts";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const gameFrameRoot = resolve(scriptDirectory, "..");
const runtimeRootValue = process.env.RPG_GM_RUNTIME_ROOT?.trim();
if (!runtimeRootValue) {
  throw new Error("RPG_GM_RUNTIME_ROOT must point to a checked-out rpg-gm-runtime repository.");
}
const runtimeRoot = resolve(runtimeRootValue);

// Keep the disposable integration stack away from the canonical staging ports
// (8790/8791), which may be serving the live staging pair on this runner host.
const browserPort = integer(process.env.GAMEFRAME_RPG_BROWSER_PORT, 18_787);
const developmentPort = integer(process.env.GAMEFRAME_RPG_BROWSER_DEV_PORT, 18_788);
const gameFrameRpgPort = integer(process.env.GAMEFRAME_RPG_BROWSER_SERVICE_PORT, 18_790);
const runtimePort = integer(process.env.GAMEFRAME_RPG_BROWSER_RUNTIME_PORT, 18_791);
const campaignId = "monster-master-staging-v6";
const playerId = "rpg-integration-player";
const serviceToken = "local-rpg-browser-service-token-0000000000000001";
const cursorSecret = "local-rpg-browser-cursor-secret-0000000000000001";
const proxySecret = "local-rpg-browser-proxy-secret-00000000000000001";
const initializedAt = "2026-08-11T00:00:00.000Z";
const temporaryRoot = await mkdtemp(join(tmpdir(), "gameframe-rpg-browser-"));
const children = new Map();
let shuttingDown = false;
let proxyServer;

function integer(value, fallback) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error(`Invalid integration port: ${value}`);
  }
  return parsed;
}

function startChild(label, cwd, entryPath, environment, nodeArguments = ["--experimental-strip-types"]) {
  const child = spawn(process.execPath, [...nodeArguments, entryPath], {
    cwd,
    env: { ...process.env, ...environment },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.set(label, child);
  child.stdout.on("data", (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  child.once("exit", (code, signal) => {
    children.delete(label);
    if (shuttingDown) return;
    process.stderr.write(`[${label}] exited unexpectedly (${signal ?? code ?? "unknown"}).\n`);
    void shutdown(1);
  });
  return child;
}

async function waitForHealth(url, label, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { headers: { accept: "application/json" } });
      if (response.ok) return;
      lastError = new Error(`${label} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));
  }
  throw new Error(`${label} did not become healthy.`, { cause: lastError });
}

function proxyOrdinaryRequest(request, response) {
  const upstream = new URL(request.url ?? "/", `http://127.0.0.1:${developmentPort}`);
  const forwarded = fetch(upstream, {
    method: request.method,
    headers: request.headers,
    redirect: "manual",
  });
  void forwarded.then(async (result) => {
    const headers = Object.fromEntries(result.headers.entries());
    response.writeHead(result.status, headers);
    response.end(Buffer.from(await result.arrayBuffer()));
  }).catch((error) => {
    response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    response.end(`Development server proxy failed: ${error instanceof Error ? error.message : "unknown error"}`);
  });
}

async function readBody(request) {
  const chunks = [];
  let total = 0;
  for await (const value of request) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    total += chunk.length;
    if (total > 131_072) throw new Error("Integration RPG request exceeded 131072 bytes.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

async function proxyRpgRequest(request, response) {
  const player = String(request.headers["x-gameframe-player-id"] ?? "").trim();
  if (!player) {
    response.writeHead(401, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "authentication_required", message: "Integration RPG requests require the development player identity." }));
    return;
  }
  const body = await readBody(request);
  const upstreamUrl = new URL(request.url ?? "/", `http://127.0.0.1:${gameFrameRpgPort}`);
  const signed = signGameFrameProxyRequest({
    proxySecret,
    method: request.method ?? "GET",
    url: upstreamUrl,
    body,
    playerId: player,
    issuedAt: Date.now(),
    nonce: randomBytes(24).toString("base64url"),
    displayName: "RPG Browser Integration",
  });
  signed.set("accept", "application/json");
  if (body.length > 0) signed.set("content-type", String(request.headers["content-type"] ?? "application/json"));

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers: signed,
    body: body.length > 0 ? body : undefined,
    redirect: "manual",
  });
  const responseHeaders = {};
  for (const name of ["cache-control", "content-type", "retry-after"]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders[name] = value;
  }
  response.writeHead(upstream.status, responseHeaders);
  response.end(Buffer.from(await upstream.arrayBuffer()));
}

async function startProxy() {
  proxyServer = createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${browserPort}`);
    if (!url.pathname.startsWith("/api/rpg/")) {
      proxyOrdinaryRequest(request, response);
      return;
    }
    void proxyRpgRequest(request, response).catch((error) => {
      response.writeHead(502, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({
        error: "integration_proxy_failed",
        message: error instanceof Error ? error.message : "RPG integration proxy failed.",
      }));
    });
  });
  await new Promise((resolveListen, rejectListen) => {
    proxyServer.once("error", rejectListen);
    proxyServer.listen(browserPort, "127.0.0.1", resolveListen);
  });
}

async function closeProxy() {
  if (!proxyServer?.listening) return;
  await new Promise((resolveClose) => proxyServer.close(() => resolveClose()));
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  await closeProxy().catch(() => undefined);
  for (const child of children.values()) child.kill("SIGTERM");
  await Promise.all([...children.values()].map((child) => new Promise((resolveExit) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolveExit();
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolveExit();
    }, 3_000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolveExit();
    });
  })));
  await rm(temporaryRoot, { recursive: true, force: true }).catch(() => undefined);
  process.exit(exitCode);
}

process.once("SIGINT", () => void shutdown(130));
process.once("SIGTERM", () => void shutdown(0));

try {
  startChild(
    "gameframe-rpg",
    gameFrameRoot,
    join(gameFrameRoot, "src/server/run-durable-rpg-service.ts"),
    {
      GAMEFRAME_RPG_DATABASE_PATH: join(temporaryRoot, "gameframe.sqlite"),
      GAMEFRAME_RPG_HOST: "127.0.0.1",
      GAMEFRAME_RPG_PORT: String(gameFrameRpgPort),
      RPG_GM_BASE_URL: `http://127.0.0.1:${runtimePort}/`,
      RPG_GM_SERVICE_TOKEN: serviceToken,
      GAMEFRAME_RPG_AUTH_MODE: "hmac-proxy",
      GAMEFRAME_RPG_PROXY_HMAC_SECRET: proxySecret,
      RPG_STAGING_CAMPAIGN_ID: campaignId,
      RPG_STAGING_PLAYER_ID: playerId,
      RPG_STAGING_INITIALIZED_AT: initializedAt,
    },
  );
  await waitForHealth(`http://127.0.0.1:${gameFrameRpgPort}/api/health`, "GameFrame RPG service");

  startChild(
    "rpg-gm-runtime",
    runtimeRoot,
    join(runtimeRoot, "src/rpg-gm/run-rpg-gm-command-runtime.ts"),
    {
      OPENCLAW_STATE_DIR: join(temporaryRoot, "runtime-state"),
      RPG_GM_HOST: "127.0.0.1",
      RPG_GM_PORT: String(runtimePort),
      GAMEFRAME_RPG_BASE_URL: `http://127.0.0.1:${gameFrameRpgPort}/`,
      RPG_GM_SERVICE_TOKEN: serviceToken,
      RPG_GM_CURSOR_SECRET: cursorSecret,
      RPG_GM_NARRATIVE_LINK_PATH: join(temporaryRoot, "runtime-narrative-link.json"),
      RPG_GM_PLUGIN_ID: "rpg-gm-runtime",
      RPG_GM_PLANNER_MODE: "deterministic",
      RPG_STAGING_CAMPAIGN_ID: campaignId,
      RPG_STAGING_PLAYER_ID: playerId,
      RPG_STAGING_PLAYER_NAME: "RPG Browser Integration",
      RPG_STAGING_PACKAGE_PATH: join(runtimeRoot, "fixtures/rpg-private/monster-master-campaign-package-v1.json"),
    },
    ["--import", "tsx"],
  );
  await waitForHealth(`http://127.0.0.1:${runtimePort}/healthz`, "RPG GM Runtime");

  startChild(
    "gameframe-web",
    gameFrameRoot,
    join(gameFrameRoot, "src/server/http-server.ts"),
    { PORT: String(developmentPort) },
  );
  await waitForHealth(`http://127.0.0.1:${developmentPort}/api/health`, "GameFrame development server");

  await startProxy();
  process.stdout.write(`${JSON.stringify({
    event: "rpg-browser-integration-stack-ready",
    browserUrl: `http://127.0.0.1:${browserPort}`,
    campaignId,
    playerId,
    plannerMode: "deterministic",
  })}\n`);
  await new Promise(() => {});
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  await shutdown(1);
}
