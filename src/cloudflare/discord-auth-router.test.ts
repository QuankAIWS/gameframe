import assert from "node:assert/strict";
import test from "node:test";
import { createGameFrameWorker } from "./worker-router.ts";
import type { GameFrameWorkerEnv } from "./runtime-contracts.ts";

const environment: GameFrameWorkerEnv = {
  SESSION_SECRET: "0123456789abcdef0123456789abcdef",
  DISCORD_CLIENT_ID: "123456789012345678",
  DISCORD_CLIENT_SECRET: "discord-client-secret",
  DISCORD_ALLOWED_USER_IDS: "111",
  MATCHES: {
    idFromName: (name) => name,
    get: () => ({ fetch: async () => new Response("unused", { status: 500 }) }),
  },
};

function cookies(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  return headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
}

function cookiePair(setCookie: string, name: string): string {
  const value = setCookie.split(";")[0];
  assert.ok(value.startsWith(`${name}=`));
  return value;
}

function mockDiscordFetch(userId = "111") {
  return async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/oauth2/token")) {
      return new Response(JSON.stringify({
        access_token: "activity-access-token",
        token_type: "Bearer",
        expires_in: 3600,
        scope: "identify",
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/users/@me")) {
      return new Response(JSON.stringify({
        id: userId,
        username: "tester",
        global_name: "Secure Tester",
        avatar: "avatarhash",
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("not found", { status: 404 });
  };
}

test("website OAuth establishes a signed GameFrame session and logout clears it", async (context) => {
  context.mock.method(globalThis, "fetch", mockDiscordFetch());
  const worker = createGameFrameWorker();
  const start = await worker.fetch(new Request(
    "https://games.example/auth/discord/start?returnTo=%2Fcombat.html%3Fmatch%3Dsecure",
  ), environment);
  assert.equal(start.status, 302);
  const authorization = new URL(start.headers.get("location") ?? "");
  assert.equal(authorization.origin, "https://discord.com");
  assert.equal(authorization.searchParams.get("scope"), "identify");
  assert.equal(
    authorization.searchParams.get("redirect_uri"),
    "https://games.example/auth/discord/callback",
  );
  const state = authorization.searchParams.get("state") ?? "";
  const stateCookie = cookiePair(cookies(start)[0], "gameframe_discord_oauth");

  const callback = await worker.fetch(new Request(
    `https://games.example/auth/discord/callback?code=code-1&state=${encodeURIComponent(state)}`,
    { headers: { cookie: stateCookie } },
  ), environment);
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get("location"), "/combat.html?match=secure");
  const callbackCookies = cookies(callback);
  const sessionSetCookie = callbackCookies.find((value) => value.startsWith("gameframe_session="));
  assert.ok(sessionSetCookie);
  assert.match(sessionSetCookie, /SameSite=Lax/);
  assert.doesNotMatch(sessionSetCookie, /Domain=/);
  const sessionCookie = cookiePair(sessionSetCookie, "gameframe_session");

  const session = await worker.fetch(new Request("https://games.example/api/session", {
    headers: { cookie: sessionCookie },
  }), environment);
  assert.equal(session.status, 200);
  assert.deepEqual(await session.json(), {
    authenticated: true,
    playerId: "discord:111",
    source: "discord",
    displayName: "Secure Tester",
    avatarUrl: "https://cdn.discordapp.com/avatars/111/avatarhash.png?size=128",
  });

  const logout = await worker.fetch(new Request("https://games.example/auth/logout", {
    method: "POST",
    headers: { cookie: sessionCookie },
  }), environment);
  assert.equal(logout.status, 200);
  assert.match(cookies(logout)[0], /gameframe_session=;/);
  assert.match(cookies(logout)[0], /Max-Age=0/);
});

test("website OAuth rejects mismatched state before contacting Discord", async (context) => {
  const fetchMock = context.mock.method(globalThis, "fetch", mockDiscordFetch());
  const worker = createGameFrameWorker();
  const start = await worker.fetch(new Request("https://games.example/auth/discord/start"), environment);
  const authorization = new URL(start.headers.get("location") ?? "");
  const state = authorization.searchParams.get("state") ?? "";
  const response = await worker.fetch(new Request(
    `https://games.example/auth/discord/callback?code=code-1&state=${encodeURIComponent(`${state}x`)}`,
    { headers: { cookie: cookiePair(cookies(start)[0], "gameframe_discord_oauth") } },
  ), environment);
  assert.equal(response.status, 400);
  assert.equal((await response.json() as { error: string }).error, "oauth_state_invalid");
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("Discord Activity exchange returns the SDK bearer token and a partitioned GameFrame session", async (context) => {
  context.mock.method(globalThis, "fetch", mockDiscordFetch());
  const worker = createGameFrameWorker();
  const activityOrigin = "https://123456789012345678.discordsays.com";
  const configuration = await worker.fetch(new Request(
    `${activityOrigin}/auth/discord/activity/config`,
  ), environment);
  assert.equal(configuration.status, 200);
  const config = await configuration.json() as { clientId: string; state: string; scopes: string[] };
  assert.equal(config.clientId, environment.DISCORD_CLIENT_ID);
  assert.deepEqual(config.scopes, ["identify"]);
  const stateCookie = cookiePair(cookies(configuration)[0], "gameframe_discord_oauth");
  assert.match(cookies(configuration)[0], /Partitioned/);

  const exchange = await worker.fetch(new Request(
    `${activityOrigin}/auth/discord/activity/session`,
    {
      method: "POST",
      headers: {
        cookie: stateCookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({ code: "activity-code", state: config.state }),
    },
  ), environment);
  assert.equal(exchange.status, 200);
  const body = await exchange.json() as { access_token: string; session: { playerId: string } };
  assert.equal(body.access_token, "activity-access-token");
  assert.equal(body.session.playerId, "discord:111");
  const sessionCookie = cookies(exchange).find((value) => value.startsWith("gameframe_session="));
  assert.ok(sessionCookie);
  assert.match(sessionCookie, /Domain=123456789012345678\.discordsays\.com/);
  assert.match(sessionCookie, /SameSite=None/);
  assert.match(sessionCookie, /Partitioned/);
});

test("Discord staging allowlist denial does not issue a session", async (context) => {
  context.mock.method(globalThis, "fetch", mockDiscordFetch("999"));
  const worker = createGameFrameWorker();
  const start = await worker.fetch(new Request("https://games.example/auth/discord/start"), environment);
  const authorization = new URL(start.headers.get("location") ?? "");
  const state = authorization.searchParams.get("state") ?? "";
  const response = await worker.fetch(new Request(
    `https://games.example/auth/discord/callback?code=code-1&state=${encodeURIComponent(state)}`,
    { headers: { cookie: cookiePair(cookies(start)[0], "gameframe_discord_oauth") } },
  ), environment);
  assert.equal(response.status, 403);
  assert.equal((await response.json() as { error: string }).error, "forbidden");
  assert.ok(!cookies(response).some((value) => value.startsWith("gameframe_session=")));
});
