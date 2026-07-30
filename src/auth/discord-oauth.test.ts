import assert from "node:assert/strict";
import test from "node:test";
import {
  DiscordOAuthClient,
  DiscordOAuthStateCodec,
  clearActivityOAuthStateCookie,
  clearWebsiteOAuthStateCookie,
  createActivityOAuthStateCookie,
  createWebsiteOAuthStateCookie,
  safeReturnTo,
} from "./discord-oauth.ts";

const environment = {
  SESSION_SECRET: "0123456789abcdef0123456789abcdef",
  DISCORD_CLIENT_ID: "123456789012345678",
  DISCORD_CLIENT_SECRET: "discord-client-secret",
  DISCORD_ALLOWED_USER_IDS: "111,222",
};

function deterministicBytes(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => (index * 17 + 3) % 256);
}

test("OAuth state is signed, expiring, and restricted to same-origin paths", async () => {
  let now = 1_000_000;
  const codec = new DiscordOAuthStateCodec(environment.SESSION_SECRET, {
    now: () => now,
    randomBytes: deterministicBytes,
  });
  const state = await codec.issue("/combat.html?match=test#board");
  assert.deepEqual(await codec.verify(state), {
    returnTo: "/combat.html?match=test#board",
    nonce: "AxQlNkdYaXqLnK2-z-DxAhMkNUZXaHmKm6y9zt_wARI",
    issuedAt: 1000,
    expiresAt: 1600,
  });

  const [payload, signature] = state.split(".");
  await assert.rejects(
    () => codec.verify(`${payload.slice(0, -1)}A.${signature}`),
    (error: any) => error.code === "oauth_state_invalid",
  );

  now += 601_000;
  await assert.rejects(
    () => codec.verify(state),
    (error: any) => error.code === "oauth_state_invalid",
  );

  assert.equal(safeReturnTo("https://evil.example/steal"), "/");
  assert.equal(safeReturnTo("//evil.example/steal"), "/");
  assert.equal(safeReturnTo("/safe/path?value=1"), "/safe/path?value=1");
});

test("OAuth state cookies use website and Activity isolation policies", () => {
  const state = "signed.state";
  assert.match(createWebsiteOAuthStateCookie(state), /SameSite=Lax/);
  assert.doesNotMatch(createWebsiteOAuthStateCookie(state), /Domain=/);
  assert.match(clearWebsiteOAuthStateCookie(), /Max-Age=0/);

  const activity = createActivityOAuthStateCookie(state, environment.DISCORD_CLIENT_ID);
  assert.match(activity, /Domain=123456789012345678\.discordsays\.com/);
  assert.match(activity, /SameSite=None/);
  assert.match(activity, /Partitioned/);
  assert.match(clearActivityOAuthStateCookie(environment.DISCORD_CLIENT_ID), /Max-Age=0/);
});

test("Discord OAuth exchanges an authorization code and creates a stable principal", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, init });
    if (url.endsWith("/oauth2/token")) {
      return new Response(JSON.stringify({
        access_token: "discord-access-token",
        token_type: "Bearer",
        expires_in: 3600,
        scope: "identify",
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/users/@me")) {
      return new Response(JSON.stringify({
        id: "111",
        username: "tester",
        global_name: "Test User",
        avatar: "abc123",
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  const client = new DiscordOAuthClient(environment, { fetcher });
  const authorization = new URL(client.authorizationUrl(
    "state-token",
    "https://games.example/auth/discord/callback",
  ));
  assert.equal(authorization.origin, "https://discord.com");
  assert.equal(authorization.searchParams.get("scope"), "identify");
  assert.equal(authorization.searchParams.get("state"), "state-token");
  assert.equal(
    authorization.searchParams.get("redirect_uri"),
    "https://games.example/auth/discord/callback",
  );

  const token = await client.exchangeCode(
    "authorization-code",
    "https://games.example/auth/discord/callback",
  );
  const user = await client.currentUser(token.access_token);
  assert.deepEqual(client.principalFor(user), {
    playerId: "discord:111",
    source: "discord",
    displayName: "Test User",
    avatarUrl: "https://cdn.discordapp.com/avatars/111/abc123.png?size=128",
  });

  const tokenBody = requests[0].init?.body as URLSearchParams;
  assert.equal(tokenBody.get("client_secret"), environment.DISCORD_CLIENT_SECRET);
  assert.equal(tokenBody.get("grant_type"), "authorization_code");
  assert.equal(requests[1].init?.headers && new Headers(requests[1].init?.headers).get("authorization"), "Bearer discord-access-token");
});

test("staging allowlist fails closed and rejects unapproved Discord users", () => {
  const client = new DiscordOAuthClient(environment);
  assert.throws(
    () => client.principalFor({ id: "999", username: "outsider" }),
    (error: any) => error.code === "forbidden",
  );
  assert.throws(
    () => new DiscordOAuthClient({ ...environment, DISCORD_ALLOWED_USER_IDS: "" }),
    (error: any) => error.code === "oauth_configuration_error",
  );
});

test("callback state must match the initiating browser cookie", async () => {
  const client = new DiscordOAuthClient(environment, {
    now: () => 1_000_000,
    randomBytes: deterministicBytes,
  });
  const state = await client.stateCodec.issue("/");
  const request = new Request("https://games.example/auth/discord/callback", {
    headers: { cookie: `gameframe_discord_oauth=${state}` },
  });
  assert.equal((await client.validateState(request, state)).returnTo, "/");
  await assert.rejects(
    () => client.validateState(request, `${state}x`),
    (error: any) => error.code === "oauth_state_invalid",
  );
});
