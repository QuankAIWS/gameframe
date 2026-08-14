import assert from "node:assert/strict";
import test from "node:test";
import { deliverChallengeBestEffort, type ChallengeNotifier } from "./challenge-notification-port.ts";
import type { GameFrameWorkerEnv } from "./runtime-contracts.ts";

const env = { MATCHES: {} as GameFrameWorkerEnv["MATCHES"] } as GameFrameWorkerEnv;
const invitation = {
  invitationId: "notify-1",
  gameId: "american-checkers" as const,
  status: "pending" as const,
  inviter: { playerId: "discord:111", displayName: "Inviter", avatarUrl: null },
  claimant: null,
  targetPlayerId: "discord:222",
  targetRestricted: true,
  issuedAt: 1,
  expiresAt: 2,
  matchId: null,
};

test("best-effort challenge delivery is skipped without a targeted player", async () => {
  let calls = 0;
  const notifier: ChallengeNotifier = async () => {
    calls += 1;
    return true;
  };
  assert.equal(await deliverChallengeBestEffort(notifier, env, {
    origin: "https://gameframe.cc",
    invitation: { ...invitation, targetPlayerId: null, targetRestricted: false },
  }), false);
  assert.equal(calls, 0);
});

test("best-effort challenge delivery never leaks notifier failure into invitation creation", async () => {
  const notifier: ChallengeNotifier = async () => {
    throw new Error("delivery unavailable");
  };
  assert.equal(await deliverChallengeBestEffort(notifier, env, {
    origin: "https://gameframe.cc",
    invitation,
  }), false);
});

test("best-effort challenge delivery reports successful provider handoff", async () => {
  let observed = null;
  const notifier: ChallengeNotifier = async (_env, input) => {
    observed = input;
    return true;
  };
  assert.equal(await deliverChallengeBestEffort(notifier, env, {
    origin: "https://gameframe.cc",
    invitation,
  }), true);
  assert.equal(observed?.invitation.invitationId, "notify-1");
});
