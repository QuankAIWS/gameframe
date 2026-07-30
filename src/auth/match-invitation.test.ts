import assert from "node:assert/strict";
import test from "node:test";
import {
  MatchInvitationTokenCodec,
  discordTargetPlayerId,
  requireInvitationTarget,
  resumePathForGame,
} from "./match-invitation.ts";

const secret = "0123456789abcdef0123456789abcdef";
const deterministicBytes = (length: number) => Uint8Array.from(
  { length },
  (_, index) => (index * 19 + 7) % 256,
);

test("signed invitation claims round-trip and retain an optional Discord target", async () => {
  const codec = new MatchInvitationTokenCodec(secret, {
    now: () => 1_000_000,
    randomBytes: deterministicBytes,
  });
  const issued = await codec.issue({
    invitationId: "invite-1",
    gameId: "tactical-combat-canary",
    inviterPlayerId: "discord:111",
    targetPlayerId: "discord:222",
    ttlSeconds: 3600,
  });

  assert.deepEqual(await codec.verify(issued.token), issued.claims);
  assert.equal(issued.claims.issuedAt, 1000);
  assert.equal(issued.claims.expiresAt, 4600);
  assert.match(issued.claims.nonce, /^[A-Za-z0-9_-]+$/);
  assert.equal(discordTargetPlayerId("222"), "discord:222");
  assert.equal(discordTargetPlayerId(""), undefined);
});

test("invitation tokens reject tampering and expiry", async () => {
  let now = 1_000_000;
  const codec = new MatchInvitationTokenCodec(secret, {
    now: () => now,
    randomBytes: deterministicBytes,
  });
  const { token } = await codec.issue({
    invitationId: "invite-2",
    gameId: "tic-tac-toe",
    inviterPlayerId: "discord:111",
    ttlSeconds: 60,
  });
  const [payload, signature] = token.split(".");
  const tamperedPayload = `${payload[0] === "A" ? "B" : "A"}${payload.slice(1)}`;
  await assert.rejects(
    () => codec.verify(`${tamperedPayload}.${signature}`),
    (error: any) => error.code === "invitation_invalid",
  );

  now += 61_000;
  await assert.rejects(
    () => codec.verify(token),
    (error: any) => error.code === "invitation_expired",
  );
});

test("invitation claims require a distinct authenticated target", async () => {
  const codec = new MatchInvitationTokenCodec(secret, {
    now: () => 1_000_000,
    randomBytes: deterministicBytes,
  });
  const { claims } = await codec.issue({
    invitationId: "invite-3",
    gameId: "american-checkers",
    inviterPlayerId: "discord:111",
    targetPlayerId: "discord:222",
  });

  assert.doesNotThrow(() => requireInvitationTarget(claims, "discord:222"));
  assert.throws(
    () => requireInvitationTarget(claims, "discord:111"),
    (error: any) => error.code === "forbidden",
  );
  assert.throws(
    () => requireInvitationTarget(claims, "discord:333"),
    (error: any) => error.code === "invitation_target_mismatch",
  );
  assert.throws(
    () => discordTargetPlayerId("not-numeric"),
    (error: any) => error.code === "invitation_invalid",
  );
});

test("invitation resume paths never contain a player identity", () => {
  assert.equal(resumePathForGame("tic-tac-toe", "match 1"), "/?match=match%201");
  assert.equal(resumePathForGame("american-checkers", "match-2"), "/?match=match-2");
  assert.equal(
    resumePathForGame("tactical-movement-canary", "match-3"),
    "/tactical.html?match=match-3",
  );
  assert.equal(
    resumePathForGame("tactical-combat-canary", "match-4"),
    "/combat.html?match=match-4",
  );
  for (const path of [
    resumePathForGame("tic-tac-toe", "m"),
    resumePathForGame("tactical-combat-canary", "m"),
  ]) {
    assert.doesNotMatch(path, /player=/);
  }
});
