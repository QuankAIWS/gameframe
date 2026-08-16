import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedPrincipal } from "../auth/request-authenticator.ts";
import { InvitationCoordinator } from "./invitation-coordinator.ts";
import type {
  DurableObjectNamespaceLike,
  DurableObjectStubLike,
  GameFrameWorkerEnv,
} from "./runtime-contracts.ts";

const invitation = {
  invitationId: "invite-1",
  gameId: "othello" as const,
  status: "claimed" as const,
  inviter: {
    playerId: "discord:inviter",
    displayName: "Inviter",
    avatarUrl: null,
  },
  claimant: {
    playerId: "discord:reader",
    displayName: "Reader",
    avatarUrl: null,
  },
  targetPlayerId: "discord:reader",
  targetRestricted: true,
  issuedAt: 1_700_000_000,
  expiresAt: 1_700_003_600,
  matchId: "match-1",
};

class ReadPurityNamespace implements DurableObjectNamespaceLike {
  matchFetches = 0;
  invitationFetches = 0;

  idFromName(name: string): unknown {
    return name;
  }

  get(id: unknown): DurableObjectStubLike {
    const objectName = String(id);
    if (objectName === `invite:${invitation.invitationId}`) {
      return {
        fetch: async (request) => {
          this.invitationFetches += 1;
          const url = new URL(request.url);
          assert.equal(request.method, "GET");
          assert.equal(url.pathname, "/invitation/view");
          assert.equal(url.searchParams.get("invitationId"), invitation.invitationId);
          assert.equal(url.searchParams.get("playerId"), invitation.claimant.playerId);
          return Response.json(invitation);
        },
      };
    }

    return {
      fetch: async () => {
        this.matchFetches += 1;
        throw new Error("Invitation status reads must not touch the match Durable Object.");
      },
    };
  }
}

test("viewing a claimed invitation is read-only and does not repair its match", async () => {
  const matches = new ReadPurityNamespace();
  const env: GameFrameWorkerEnv = {
    MATCHES: matches,
    SESSION_SECRET: "read-purity-test-secret-that-is-long-enough",
  };
  const principal: AuthenticatedPrincipal = {
    playerId: invitation.claimant.playerId,
    source: "discord",
    displayName: invitation.claimant.displayName ?? undefined,
  };

  const coordinator = new InvitationCoordinator(env, env.SESSION_SECRET!);
  const result = await coordinator.view(invitation.invitationId, principal);

  assert.equal(result.invitation.status, "claimed");
  assert.equal(result.invitation.matchId, invitation.matchId);
  assert.equal(result.resumePath, `/othello.html?match=${encodeURIComponent(invitation.matchId)}`);
  assert.equal(matches.invitationFetches, 1);
  assert.equal(matches.matchFetches, 0);
});
