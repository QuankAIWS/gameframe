import assert from "node:assert/strict";
import test from "node:test";
import {
  establishDiscordActivitySession,
  isDiscordActivityHost,
  type DiscordActivitySdkLike,
} from "./discord-activity-client.ts";

test("Discord Activity host detection only accepts numeric Discord proxy origins", () => {
  assert.equal(isDiscordActivityHost("123456789012345678.discordsays.com"), true);
  assert.equal(isDiscordActivityHost("discordsays.com"), false);
  assert.equal(isDiscordActivityHost("evil.discordsays.com"), false);
  assert.equal(isDiscordActivityHost("123.discordsays.com.evil.example"), false);
});

test("Activity client completes ready, authorize, server exchange, and authenticate", async () => {
  const calls: string[] = [];
  const sdk: DiscordActivitySdkLike = {
    ready: async () => { calls.push("ready"); },
    commands: {
      authorize: async (input) => {
        calls.push(`authorize:${input.client_id}:${input.state}:${input.scope.join(",")}`);
        assert.equal(input.response_type, "code");
        assert.equal(input.prompt, "none");
        return { code: "activity-code" };
      },
      authenticate: async ({ access_token }) => {
        calls.push(`authenticate:${access_token}`);
        return { user: { id: "111", username: "tester" } };
      },
    },
  };

  const requests: Array<{ path: string; init?: RequestInit }> = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    requests.push({ path, init });
    if (path.endsWith("/config")) {
      return new Response(JSON.stringify({
        clientId: "123456789012345678",
        state: "signed-state",
        scopes: ["identify"],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (path.endsWith("/session")) {
      return new Response(JSON.stringify({
        access_token: "activity-access-token",
        token_type: "Bearer",
        expires_in: 3600,
        session: {
          authenticated: true,
          playerId: "discord:111",
          source: "discord",
          displayName: "Test User",
          avatarUrl: null,
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  const session = await establishDiscordActivitySession({
    createSdk: (clientId) => {
      assert.equal(clientId, "123456789012345678");
      return sdk;
    },
    fetcher,
  });

  assert.equal(session.playerId, "discord:111");
  assert.deepEqual(calls, [
    "ready",
    "authorize:123456789012345678:signed-state:identify",
    "authenticate:activity-access-token",
  ]);
  assert.deepEqual(requests.map((request) => request.path), [
    "/auth/discord/activity/config",
    "/auth/discord/activity/session",
  ]);
  const exchangeBody = JSON.parse(String(requests[1].init?.body));
  assert.deepEqual(exchangeBody, { code: "activity-code", state: "signed-state" });
  assert.equal(requests[1].init?.credentials, "same-origin");
});

test("Activity client rejects an SDK user that does not match the signed session", async () => {
  const sdk: DiscordActivitySdkLike = {
    ready: async () => undefined,
    commands: {
      authorize: async () => ({ code: "activity-code" }),
      authenticate: async () => ({ user: { id: "222" } }),
    },
  };
  const fetcher = (async (input: RequestInfo | URL) => new Response(JSON.stringify(
    String(input).endsWith("/config")
      ? { clientId: "123456789012345678", state: "state", scopes: ["identify"] }
      : {
          access_token: "token",
          token_type: "Bearer",
          expires_in: 60,
          session: {
            authenticated: true,
            playerId: "discord:111",
            source: "discord",
            displayName: null,
            avatarUrl: null,
          },
        },
  ), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;

  await assert.rejects(
    () => establishDiscordActivitySession({ createSdk: () => sdk, fetcher }),
    /did not match the GameFrame session identity/,
  );
});

test("Activity client fails closed on invalid server configuration", async () => {
  let sdkCreated = false;
  const fetcher = (async () => new Response(JSON.stringify({
    clientId: "not-a-client-id",
    state: "state",
    scopes: ["identify"],
  }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;

  await assert.rejects(
    () => establishDiscordActivitySession({
      createSdk: () => {
        sdkCreated = true;
        throw new Error("must not run");
      },
      fetcher,
    }),
    /invalid Discord client ID/,
  );
  assert.equal(sdkCreated, false);
});
