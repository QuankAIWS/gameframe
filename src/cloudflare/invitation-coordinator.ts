import type { AuthenticatedPrincipal } from "../auth/request-authenticator.ts";
import {
  MatchInvitationTokenCodec,
  invitationTargetPlayerId,
  isInvitationGameId,
  requireInvitationTarget,
  resumePathForGame,
  type InvitationGameId,
} from "../auth/match-invitation.ts";
import type {
  InvitationClaimResult,
  PublicMatchInvitation,
} from "./invitation-object-runtime.ts";
import type { GameFrameWorkerEnv } from "./runtime-contracts.ts";

interface InternalErrorBody {
  error?: string;
  message?: string;
}

export interface InvitationCoordinatorOptions {
  idGenerator?: () => string;
  now?: () => number;
}

export interface CreatedInvitationResponse {
  invitation: PublicMatchInvitation;
  inviteUrl: string;
  token: string;
}

export interface ClaimedInvitationResponse {
  invitation: PublicMatchInvitation;
  resumePath: string;
}

function participant(principal: AuthenticatedPrincipal) {
  return {
    playerId: principal.playerId,
    displayName: principal.displayName ?? null,
    avatarUrl: principal.avatarUrl ?? null,
  };
}

async function internalJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as InternalErrorBody;
  if (!response.ok) {
    throw Object.assign(new Error(body.message ?? `Internal invitation request failed with ${response.status}.`), {
      code: body.error ?? "invitation_internal_error",
    });
  }
  return body as T;
}

function invitationStub(env: GameFrameWorkerEnv, invitationId: string) {
  return env.MATCHES.get(env.MATCHES.idFromName(`invite:${invitationId}`));
}

function matchStub(env: GameFrameWorkerEnv, matchId: string) {
  return env.MATCHES.get(env.MATCHES.idFromName(matchId));
}

function invitationUrl(origin: string, token: string): string {
  const url = new URL("/invite.html", origin);
  url.searchParams.set("token", token);
  return url.toString();
}

export class InvitationCoordinator {
  readonly #env: GameFrameWorkerEnv;
  readonly #idGenerator: () => string;
  readonly #codec: MatchInvitationTokenCodec;

  constructor(
    env: GameFrameWorkerEnv,
    sessionSecret: string,
    options: InvitationCoordinatorOptions = {},
  ) {
    this.#env = env;
    this.#idGenerator = options.idGenerator ?? (() => crypto.randomUUID());
    this.#codec = new MatchInvitationTokenCodec(sessionSecret, {
      ...(options.now ? { now: options.now } : {}),
    });
  }

  async create(
    origin: string,
    principal: AuthenticatedPrincipal,
    body: Record<string, unknown>,
  ): Promise<CreatedInvitationResponse> {
    if (!isInvitationGameId(body.gameId)) {
      throw Object.assign(new Error("The requested game cannot be invited."), {
        code: "unknown_game",
      });
    }
    const gameId = body.gameId as InvitationGameId;
    const targetPlayerId = invitationTargetPlayerId(body.targetPlayerId, body.targetDiscordUserId);
    const invitationId = this.#idGenerator();
    const { token, claims } = await this.#codec.issue({
      invitationId,
      gameId,
      inviterPlayerId: principal.playerId,
      ...(targetPlayerId ? { targetPlayerId } : {}),
    });
    const invitation = await internalJson<PublicMatchInvitation>(
      await invitationStub(this.#env, invitationId).fetch(new Request(
        "https://invitation.internal/invitation/initialize",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ claims, inviter: participant(principal) }),
        },
      )),
    );
    return {
      invitation,
      inviteUrl: invitationUrl(origin, token),
      token,
    };
  }

  async claim(
    principal: AuthenticatedPrincipal,
    token: string,
  ): Promise<ClaimedInvitationResponse> {
    const claims = await this.#codec.verify(token);
    requireInvitationTarget(claims, principal.playerId);
    const requestedMatchId = this.#idGenerator();
    const claim = await internalJson<InvitationClaimResult>(
      await invitationStub(this.#env, claims.invitationId).fetch(new Request(
        "https://invitation.internal/invitation/claim",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            invitationId: claims.invitationId,
            claimant: participant(principal),
            matchId: requestedMatchId,
          }),
        },
      )),
    );
    await this.#ensureMatch(claim.invitation);
    return {
      invitation: claim.invitation,
      resumePath: resumePathForGame(claim.invitation.gameId, claim.invitation.matchId!),
    };
  }

  async view(
    invitationId: string,
    principal: AuthenticatedPrincipal,
  ): Promise<ClaimedInvitationResponse | { invitation: PublicMatchInvitation; resumePath: null }> {
    const url = new URL("https://invitation.internal/invitation/view");
    url.searchParams.set("invitationId", invitationId);
    url.searchParams.set("playerId", principal.playerId);
    const invitation = await internalJson<PublicMatchInvitation>(
      await invitationStub(this.#env, invitationId).fetch(new Request(url)),
    );
    if (invitation.status === "claimed" && invitation.matchId) {
      await this.#ensureMatch(invitation);
      return {
        invitation,
        resumePath: resumePathForGame(invitation.gameId, invitation.matchId),
      };
    }
    return { invitation, resumePath: null };
  }

  async cancel(
    invitationId: string,
    principal: AuthenticatedPrincipal,
  ): Promise<{ invitation: PublicMatchInvitation; resumePath: null }> {
    const invitation = await internalJson<PublicMatchInvitation>(
      await invitationStub(this.#env, invitationId).fetch(new Request(
        "https://invitation.internal/invitation/cancel",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            invitationId,
            playerId: principal.playerId,
          }),
        },
      )),
    );
    return { invitation, resumePath: null };
  }

  async #ensureMatch(invitation: PublicMatchInvitation): Promise<void> {
    const matchId = invitation.matchId;
    const claimant = invitation.claimant;
    if (invitation.status !== "claimed" || !matchId || !claimant) {
      throw Object.assign(new Error("A claimed invitation requires a match and claimant."), {
        code: "invitation_conflict",
      });
    }
    const playerIds = [invitation.inviter.playerId, claimant.playerId];
    const stub = matchStub(this.#env, matchId);
    const initialized = await stub.fetch(new Request("https://match.internal/initialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        matchId,
        playerIds,
        gameId: invitation.gameId,
      }),
    }));
    if (initialized.status === 201) return;
    if (initialized.status !== 409) {
      await internalJson(initialized);
      return;
    }

    const viewUrl = new URL("https://match.internal/view");
    viewUrl.searchParams.set("matchId", matchId);
    viewUrl.searchParams.set("playerId", invitation.inviter.playerId);
    const existing = await internalJson<{
      gameId: string;
      matchId: string;
      playerIds: string[];
    }>(await stub.fetch(new Request(viewUrl)));
    if (
      existing.gameId !== invitation.gameId
      || existing.matchId !== matchId
      || existing.playerIds.length !== 2
      || existing.playerIds[0] !== playerIds[0]
      || existing.playerIds[1] !== playerIds[1]
    ) {
      throw Object.assign(new Error("The claimed invitation conflicts with an existing match."), {
        code: "invitation_conflict",
      });
    }
  }
}
