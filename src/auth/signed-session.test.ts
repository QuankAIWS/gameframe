import assert from "node:assert/strict";
import test from "node:test";
import {
  SignedCookieSessionAuthenticator,
  SignedSessionCodec,
  createDiscordActivitySessionCookie,
} from "./signed-session.ts";

const SECRET = "0123456789abcdef0123456789abcdef";

test("signed sessions round-trip a trusted principal", async () => {
  const codec = new SignedSessionCodec(SECRET, { now: () => 1_000_000 });
  const token = await codec.issue({ playerId: "discord:123", source: "discord" }, 300);
  assert.deepEqual(await codec.verify(token), {
    playerId: "discord:123",
    source: "discord",
  });
});

test("signed sessions reject tampering and expiry", async () => {
  let now = 1_000_000;
  const codec = new SignedSessionCodec(SECRET, { now: () => now });
  const token = await codec.issue({ playerId: "discord:123", source: "discord" }, 10);
  const [payload, signature] = token.split(".");

  await assert.rejects(
    () => codec.verify(`${payload.slice(0, -1)}A.${signature}`),
    (error: any) => error.code === "authentication_required",
  );

  now += 11_000;
  await assert.rejects(
    () => codec.verify(token),
    (error: any) => error.code === "authentication_required",
  );
});

test("cookie authenticator derives the principal for HTTP and WebSocket upgrade requests", async () => {
  const codec = new SignedSessionCodec(SECRET);
  const token = await codec.issue({ playerId: "discord:456", source: "discord" });
  const authenticator = new SignedCookieSessionAuthenticator(codec);

  const principal = await authenticator.authenticate(new Request("https://123.discordsays.com/api", {
    headers: {
      cookie: `other=value; gameframe_session=${token}`,
      upgrade: "websocket",
    },
  }));

  assert.deepEqual(principal, { playerId: "discord:456", source: "discord" });
});

test("Discord Activity cookie uses the required iframe isolation attributes", async () => {
  const codec = new SignedSessionCodec(SECRET);
  const token = await codec.issue({ playerId: "discord:789", source: "discord" });
  const cookie = createDiscordActivitySessionCookie(token, {
    clientId: "123456789012345678",
    maxAgeSeconds: 3600,
  });

  assert.match(cookie, /Domain=123456789012345678\.discordsays\.com/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=None/);
  assert.match(cookie, /Partitioned/);
});
