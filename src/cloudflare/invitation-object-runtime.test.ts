import assert from "node:assert/strict";
import test from "node:test";
import type { MatchInvitationClaims } from "../auth/match-invitation.ts";
import { InvitationObjectRuntime } from "./invitation-object-runtime.ts";
import type { DurableStorageLike } from "./runtime-contracts.ts";

class FakeStorage implements DurableStorageLike {
  readonly values = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    const value = this.values.get(key);
    return value === undefined ? undefined : structuredClone(value) as T;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.values.set(key, structuredClone(value));
  }
}

const claims: MatchInvitationClaims = {
  version: 1,
  invitationId: "invite-runtime",
  nonce: "nonce-nonce-nonce-nonce-nonce-nonce-1234",
  gameId: "american-checkers",
  inviterPlayerId: "discord:111",
  issuedAt: 1000,
  expiresAt: 2000,
};

function request(path: string, body?: unknown): Request {
  return new Request(`https://invitation.internal${path}`, body === undefined
    ? undefined
    : {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
}

async function initialize(runtime: InvitationObjectRuntime, inputClaims = claims) {
  const response = await runtime.fetch(request("/invitation/initialize", {
    claims: inputClaims,
    inviter: {
      playerId: inputClaims.inviterPlayerId,
      displayName: "Inviter",
      avatarUrl: null,
    },
  }));
  assert.equal(response.status, 201);
  return response.json() as Promise<any>;
}

test("invitation object initializes idempotently and authorizes participant views", async () => {
  const runtime = new InvitationObjectRuntime(new FakeStorage(), { now: () => 1_100_000 });
  const created = await initialize(runtime);
  assert.equal(created.status, "pending");
  assert.equal(created.inviter.playerId, "discord:111");
  assert.equal((await initialize(runtime)).status, "pending");

  const inviterView = await runtime.fetch(new Request(
    "https://invitation.internal/invitation/view?invitationId=invite-runtime&playerId=discord%3A111",
  ));
  assert.equal(inviterView.status, 200);
  assert.equal((await inviterView.json() as any).status, "pending");

  const outsiderView = await runtime.fetch(new Request(
    "https://invitation.internal/invitation/view?invitationId=invite-runtime&playerId=discord%3A999",
  ));
  assert.equal(outsiderView.status, 403);
});

test("first authenticated claimant wins and same-claimant retries are idempotent", async () => {
  const runtime = new InvitationObjectRuntime(new FakeStorage(), { now: () => 1_200_000 });
  await initialize(runtime);

  const claim = (playerId: string, matchId: string) => runtime.fetch(request("/invitation/claim", {
    invitationId: claims.invitationId,
    claimant: { playerId, displayName: playerId, avatarUrl: null },
    matchId,
  }));
  const [first, second] = await Promise.all([
    claim("discord:222", "match-first"),
    claim("discord:333", "match-second"),
  ]);
  assert.deepEqual([first.status, second.status].sort(), [200, 409]);
  const winnerResponse = first.status === 200 ? first : second;
  const winner = await winnerResponse.json() as any;
  const winnerPlayerId = winner.invitation.claimant.playerId;
  const winnerMatchId = winner.invitation.matchId;
  assert.equal(winner.claimedNew, true);

  const retry = await claim(winnerPlayerId, "ignored-new-match");
  assert.equal(retry.status, 200);
  const retried = await retry.json() as any;
  assert.equal(retried.claimedNew, false);
  assert.equal(retried.invitation.matchId, winnerMatchId);

  const loserPlayerId = winnerPlayerId === "discord:222" ? "discord:333" : "discord:222";
  const loser = await claim(loserPlayerId, "match-loser");
  assert.equal(loser.status, 409);
  assert.equal((await loser.json() as any).error, "invitation_claimed");
});

test("target restrictions, expiry, and cancellation fail closed", async () => {
  const targeted = { ...claims, invitationId: "targeted", targetPlayerId: "discord:222" };
  const targetedRuntime = new InvitationObjectRuntime(new FakeStorage(), { now: () => 1_200_000 });
  await initialize(targetedRuntime, targeted);

  const wrongTarget = await targetedRuntime.fetch(request("/invitation/claim", {
    invitationId: targeted.invitationId,
    claimant: { playerId: "discord:333", displayName: null, avatarUrl: null },
    matchId: "wrong-target",
  }));
  assert.equal(wrongTarget.status, 403);
  assert.equal((await wrongTarget.json() as any).error, "invitation_target_mismatch");

  const cancelledRuntime = new InvitationObjectRuntime(new FakeStorage(), { now: () => 1_200_000 });
  await initialize(cancelledRuntime);
  const cancel = await cancelledRuntime.fetch(request("/invitation/cancel", {
    invitationId: claims.invitationId,
    playerId: claims.inviterPlayerId,
  }));
  assert.equal(cancel.status, 200);
  assert.equal((await cancel.json() as any).status, "cancelled");
  const cancelledClaim = await cancelledRuntime.fetch(request("/invitation/claim", {
    invitationId: claims.invitationId,
    claimant: { playerId: "discord:222", displayName: null, avatarUrl: null },
    matchId: "cancelled-match",
  }));
  assert.equal(cancelledClaim.status, 409);

  const expiredRuntime = new InvitationObjectRuntime(new FakeStorage(), { now: () => 2_001_000 });
  await initialize(expiredRuntime);
  const expired = await expiredRuntime.fetch(request("/invitation/claim", {
    invitationId: claims.invitationId,
    claimant: { playerId: "discord:222", displayName: null, avatarUrl: null },
    matchId: "expired-match",
  }));
  assert.equal(expired.status, 410);
});
