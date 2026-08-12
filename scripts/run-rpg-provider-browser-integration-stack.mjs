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

// Dedicated ports keep this provider-path stack isolated from both staging and
// the ordinary deterministic browser integration gate.
const browserPort = integer(process.env.GAMEFRAME_RPG_PROVIDER_BROWSER_PORT, 18_887);
const developmentPort = integer(process.env.GAMEFRAME_RPG_PROVIDER_DEV_PORT, 18_888);
const gameFrameRpgPort = integer(process.env.GAMEFRAME_RPG_PROVIDER_SERVICE_PORT, 18_890);
const runtimePort = integer(process.env.GAMEFRAME_RPG_PROVIDER_RUNTIME_PORT, 18_891);
const runtimeResetPort = integer(process.env.GAMEFRAME_RPG_PROVIDER_RESET_PORT, 18_892);
const providerPort = integer(process.env.GAMEFRAME_RPG_PROVIDER_FAKE_PORT, 18_893);
const campaignId = "monster-master-staging-v6";
const playerId = "rpg-provider-integration-player";
const serviceToken = "local-rpg-provider-service-token-0000000000000001";
const cursorSecret = "local-rpg-provider-cursor-secret-0000000000000001";
const proxySecret = "local-rpg-provider-proxy-secret-00000000000000001";
const providerApiKey = "local-rpg-provider-api-key-000000000000000001";
const initializedAt = "2026-08-11T00:00:00.000Z";
const temporaryRoot = await mkdtemp(join(tmpdir(), "gameframe-rpg-provider-browser-"));
const children = new Map();
let shuttingDown = false;
let proxyServer;
let providerServer;
let personhoodTurn = 0;

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

async function readBody(request) {
  const chunks = [];
  let total = 0;
  for await (const value of request) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    total += chunk.length;
    if (total > 262_144) throw new Error("Integration request exceeded 262144 bytes.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

function providerCompletion(content, id) {
  return JSON.stringify({
    id,
    model: "local-rpg-provider",
    choices: [{
      finish_reason: "stop",
      message: { role: "assistant", content: JSON.stringify(content) },
    }],
    usage: { prompt_tokens: 1, completion_tokens: 1 },
  });
}

function genericGmProposal() {
  return {
    schemaVersion: 1,
    title: "Checkpoint road",
    narration: "The checkpoint remains tense but stable.",
    tone: "neutral",
    transition: "none",
    dialogue: [],
    stateChanges: [],
    suggestedActions: [],
    mechanic: { kind: "none" },
    runtimeNotes: "",
  };
}

async function handleProviderRequest(request, response) {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${providerPort}`);
  if (request.method === "GET" && url.pathname === "/healthz") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true, service: "local-rpg-provider" }));
    return;
  }
  if (request.method !== "POST" || !url.pathname.endsWith("/chat/completions")) {
    response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: { message: "unsupported local provider route" } }));
    return;
  }
  if (request.headers.authorization !== `Bearer ${providerApiKey}`) {
    response.writeHead(401, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: { message: "invalid local provider bearer token" } }));
    return;
  }

  const body = JSON.parse((await readBody(request)).toString("utf8"));
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const systemPrompt = typeof messages[0]?.content === "string" ? messages[0].content : "";
  const userPrompt = typeof messages[1]?.content === "string" ? messages[1].content : "";
  const isPersonhood = systemPrompt.includes("performing exactly one durable RPG person");

  if (!isPersonhood) {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(providerCompletion(genericGmProposal(), `local-gm-${Date.now()}`));
    return;
  }

  personhoodTurn += 1;
  const hasMaraIdentity = userPrompt.includes("Mara Venn");
  const hasMaraEntity = userPrompt.includes("npc.mara-venn");
  if (!hasMaraEntity) {
    response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: { message: "personhood context omitted the present checkpoint official" } }));
    return;
  }

  if (personhoodTurn === 1) {
    if (hasMaraIdentity) {
      response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: { message: "Mara identity leaked before physical inspection" } }));
      return;
    }
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(providerCompletion({
      schemaVersion: 1,
      narration: "Pell turns toward the checkpoint official.",
      reply: "Give me a second. I'll check her badge.",
      intent: { kind: "inspect-present-actor", targetEntityId: "npc.mara-venn" },
    }, "local-personhood-inspect"));
    return;
  }

  if (personhoodTurn === 2) {
    if (!hasMaraIdentity) {
      response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: { message: "Mara identity was not learned after physical inspection" } }));
      return;
    }
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(providerCompletion({
      schemaVersion: 1,
      narration: "Pell looks back from the badge.",
      reply: "The badge gives her name as Mara Venn.",
    }, "local-personhood-learned-name"));
    return;
  }

  response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ error: { message: `unexpected personhood turn ${personhoodTurn}` } }));
}

async function startProvider() {
  providerServer = createServer((request, response) => {
    void handleProviderRequest(request, response).catch((error) => {
      response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: { message: error instanceof Error ? error.message : "local provider failed" } }));
    });
  });
  await new Promise((resolveListen, rejectListen) => {
    providerServer.once("error", rejectListen);
    providerServer.listen(providerPort, "127.0.0.1", resolveListen);
  });
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
    displayName: "RPG Provider Browser Integration",
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

async function closeServer(server) {
  if (!server?.listening) return;
  await new Promise((resolveClose) => server.close(() => resolveClose()));
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  await closeServer(proxyServer).catch(() => undefined);
  await closeServer(providerServer).catch(() => undefined);
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
  await startProvider();
  await waitForHealth(`http://127.0.0.1:${providerPort}/healthz`, "local RPG provider");

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
      RPG_GM_STAGING_RESET_PORT: String(runtimeResetPort),
      GAMEFRAME_RPG_BASE_URL: `http://127.0.0.1:${gameFrameRpgPort}/`,
      RPG_GM_SERVICE_TOKEN: serviceToken,
      RPG_GM_CURSOR_SECRET: cursorSecret,
      RPG_GM_NARRATIVE_LINK_PATH: join(temporaryRoot, "runtime-narrative-link.json"),
      RPG_GM_PLUGIN_ID: "rpg-gm-runtime",
      RPG_GM_PLANNER_MODE: "model",
      RPG_GM_PROVIDER_BASE_URL: `http://127.0.0.1:${providerPort}/v1`,
      RPG_GM_PROVIDER_API_KEY: providerApiKey,
      RPG_GM_PROVIDER_MODEL: "local-rpg-provider",
      RPG_GM_PROVIDER_TIMEOUT_MS: "5000",
      RPG_STAGING_CAMPAIGN_ID: campaignId,
      RPG_STAGING_PLAYER_ID: playerId,
      RPG_STAGING_PLAYER_NAME: "RPG Provider Browser Integration",
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
    event: "rpg-provider-browser-integration-stack-ready",
    browserUrl: `http://127.0.0.1:${browserPort}`,
    campaignId,
    playerId,
    plannerMode: "model",
    provider: `http://127.0.0.1:${providerPort}/v1`,
  })}\n`);
  await new Promise(() => {});
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  await shutdown(1);
}
