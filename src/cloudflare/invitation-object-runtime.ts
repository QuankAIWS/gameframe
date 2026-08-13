import type { InvitationGameId, MatchInvitationClaims } from "../auth/match-invitation.ts";
import { isInvitationGameId } from "../auth/match-invitation.ts";
import { errorResponse, json, readJson } from "./http-utils.ts";
import type { DurableStorageLike } from "./runtime-contracts.ts";

export const INVITATION_RECORD_KEY = "gameframe:match-invitation:v1";

export type InvitationStatus = "pending" | "claimed" | "cancelled" | "declined" | "expired";

export interface InvitationParticipantProfile {
  playerId: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface StoredMatchInvitation {
  version: 1;
  invitationId: string;
  nonce: string;
  gameId: InvitationGameId;
  inviter: InvitationParticipantProfile;
  targetPlayerId?: string;
  issuedAt: number;
  expiresAt: number;
  status: "pending" | "claimed" | "cancelled" | "declined";
  claimant?: InvitationParticipantProfile;
  matchId?: string;
  cancelledAt?: number;
  declinedAt?: number;
  claimedAt?: number;
}

export interface PublicMatchInvitation {
  invitationId: string;
  gameId: InvitationGameId;
  status: InvitationStatus;
  inviter: InvitationParticipantProfile;
  claimant: InvitationParticipantProfile | null;
  targetPlayerId: string | null;
  targetRestricted: boolean;
  issuedAt: number;
  expiresAt: number;
  matchId: string | null;
}

export interface InvitationClaimResult {
  invitation: PublicMatchInvitation;
  claimedNew: boolean;
}

export interface InvitationObjectRuntimeOptions {
  now?: () => number;
}

interface InvitationRuntimeError extends Error {
  code?: string;
}

function boundedText(value: unknown, name: string, maximum = 160): string {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > maximum) {
    throw Object.assign(new Error(`${name} must be non-empty and bounded.`), {
      code: "invitation_invalid",
    });
  }
  return normalized;
}

function optionalProfileText(value: unknown, maximum: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).trim();
  if (!normalized || normalized.length > maximum) {
    throw Object.assign(new Error("Invitation profile metadata is invalid."), {
      code: "invitation_invalid",
    });
  }
  return normalized;
}

function participant(value: unknown): InvitationParticipantProfile {
  const input = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    playerId: boundedText(input.playerId, "Invitation participant ID"),
    displayName: optionalProfileText(input.displayName, 100),
    avatarUrl: optionalProfileText(input.avatarUrl, 512),
  };
}

function publicStatus(record: StoredMatchInvitation, nowSeconds: number): InvitationStatus {
  if (record.status === "pending" && record.expiresAt <= nowSeconds) return "expired";
  return record.status;
}

function publicInvitation(record: StoredMatchInvitation, nowSeconds: number): PublicMatchInvitation {
  return {
    invitationId: record.invitationId,
    gameId: record.gameId,
    status: publicStatus(record, nowSeconds),
    inviter: structuredClone(record.inviter),
    claimant: record.claimant ? structuredClone(record.claimant) : null,
    targetPlayerId: record.targetPlayerId ?? null,
    targetRestricted: Boolean(record.targetPlayerId),
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
    matchId: record.matchId ?? null,
  };
}

function sameClaims(record: StoredMatchInvitation, claims: MatchInvitationClaims): boolean {
  return record.invitationId === claims.invitationId
    && record.nonce === claims.nonce
    && record.gameId === claims.gameId
    && record.inviter.playerId === claims.inviterPlayerId
    && record.targetPlayerId === claims.targetPlayerId
    && record.issuedAt === claims.issuedAt
    && record.expiresAt === claims.expiresAt;
}

export class InvitationObjectRuntime {
  readonly #storage: DurableStorageLike;
  readonly #now: () => number;
  #tail: Promise<void> = Promise.resolve();

  constructor(storage: DurableStorageLike, options: InvitationObjectRuntimeOptions = {}) {
    this.#storage = storage;
    this.#now = options.now ?? (() => Date.now());
  }

  fetch(request: Request): Promise<Response> {
    const execute = async () => this.#handle(request);
    const result = this.#tail.then(execute, execute);
    this.#tail = result.then(() => undefined, () => undefined);
    return result;
  }

  async #handle(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (request.method === "POST" && url.pathname === "/invitation/initialize") {
        return json(201, await this.#initialize(await readJson(request)));
      }
      if (request.method === "GET" && url.pathname === "/invitation/view") {
        return json(200, await this.#view(
          String(url.searchParams.get("invitationId") ?? ""),
          String(url.searchParams.get("playerId") ?? ""),
        ));
      }
      if (request.method === "POST" && url.pathname === "/invitation/claim") {
        return json(200, await this.#claim(await readJson(request)));
      }
      if (request.method === "POST" && url.pathname === "/invitation/cancel") {
        return json(200, await this.#cancel(await readJson(request)));
      }
      if (request.method === "POST" && url.pathname === "/invitation/decline") {
        return json(200, await this.#decline(await readJson(request)));
      }
      return json(404, { error: "not_found" });
    } catch (caught) {
      return errorResponse(caught as InvitationRuntimeError);
    }
  }

  async #record(invitationId: string): Promise<StoredMatchInvitation> {
    const record = await this.#storage.get<StoredMatchInvitation>(INVITATION_RECORD_KEY);
    if (!record || record.invitationId !== invitationId) {
      throw Object.assign(new Error(`Unknown invitation: ${invitationId}`), {
        code: "invitation_not_found",
      });
    }
    return record;
  }

  async #initialize(body: Record<string, unknown>): Promise<PublicMatchInvitation> {
    const claimsInput = body.claims && typeof body.claims === "object" && !Array.isArray(body.claims)
      ? body.claims as Record<string, unknown>
      : {};
    const claims: MatchInvitationClaims = {
      version: 1,
      invitationId: boundedText(claimsInput.invitationId, "Invitation ID"),
      nonce: boundedText(claimsInput.nonce, "Invitation nonce", 256),
      gameId: claimsInput.gameId as InvitationGameId,
      inviterPlayerId: boundedText(claimsInput.inviterPlayerId, "Invitation inviter ID"),
      ...(claimsInput.targetPlayerId
        ? { targetPlayerId: boundedText(claimsInput.targetPlayerId, "Invitation target ID") }
        : {}),
      issuedAt: Number(claimsInput.issuedAt),
      expiresAt: Number(claimsInput.expiresAt),
    };
    if (
      !isInvitationGameId(claims.gameId)
      || !Number.isInteger(claims.issuedAt)
      || !Number.isInteger(claims.expiresAt)
      || claims.expiresAt <= claims.issuedAt
    ) {
      throw Object.assign(new Error("Invitation claims are invalid."), {
        code: "invitation_invalid",
      });
    }
    const inviter = participant(body.inviter);
    if (inviter.playerId !== claims.inviterPlayerId) {
      throw Object.assign(new Error("Invitation claims do not match the inviter principal."), {
        code: "invitation_invalid",
      });
    }

    const existing = await this.#storage.get<StoredMatchInvitation>(INVITATION_RECORD_KEY);
    if (existing) {
      if (!sameClaims(existing, claims)) {
        throw Object.assign(new Error("The invitation object is already initialized differently."), {
          code: "invitation_conflict",
        });
      }
      return publicInvitation(existing, Math.floor(this.#now() / 1000));
    }

    const record: StoredMatchInvitation = {
      version: 1,
      invitationId: claims.invitationId,
      nonce: claims.nonce,
      gameId: claims.gameId,
      inviter,
      ...(claims.targetPlayerId ? { targetPlayerId: claims.targetPlayerId } : {}),
      issuedAt: claims.issuedAt,
      expiresAt: claims.expiresAt,
      status: "pending",
    };
    await this.#storage.put(INVITATION_RECORD_KEY, record);
    return publicInvitation(record, Math.floor(this.#now() / 1000));
  }

  async #view(invitationIdValue: string, playerIdValue: string): Promise<PublicMatchInvitation> {
    const invitationId = boundedText(invitationIdValue, "Invitation ID");
    const playerId = boundedText(playerIdValue, "Invitation viewer ID");
    const record = await this.#record(invitationId);
    if (
      record.inviter.playerId !== playerId
      && record.targetPlayerId !== playerId
      && record.claimant?.playerId !== playerId
    ) {
      throw Object.assign(new Error("The authenticated player cannot view this invitation."), {
        code: "forbidden",
      });
    }
    return publicInvitation(record, Math.floor(this.#now() / 1000));
  }

  async #claim(body: Record<string, unknown>): Promise<InvitationClaimResult> {
    const invitationId = boundedText(body.invitationId, "Invitation ID");
    const claimant = participant(body.claimant);
    const requestedMatchId = boundedText(body.matchId, "Invitation match ID");
    const record = await this.#record(invitationId);
    const nowSeconds = Math.floor(this.#now() / 1000);

    if (record.status === "cancelled") {
      throw Object.assign(new Error("The match invitation was cancelled."), {
        code: "invitation_cancelled",
      });
    }
    if (record.status === "declined") {
      throw Object.assign(new Error("The match invitation was declined."), {
        code: "invitation_declined",
      });
    }
    if (record.status === "pending" && record.expiresAt <= nowSeconds) {
      throw Object.assign(new Error("The match invitation has expired."), {
        code: "invitation_expired",
      });
    }
    if (record.inviter.playerId === claimant.playerId) {
      throw Object.assign(new Error("The invitation creator cannot claim the second seat."), {
        code: "forbidden",
      });
    }
    if (record.targetPlayerId && record.targetPlayerId !== claimant.playerId) {
      throw Object.assign(new Error("The invitation is restricted to another authenticated player."), {
        code: "invitation_target_mismatch",
      });
    }
    if (record.status === "claimed") {
      if (record.claimant?.playerId !== claimant.playerId) {
        throw Object.assign(new Error("The match invitation has already been claimed."), {
          code: "invitation_claimed",
        });
      }
      return {
        invitation: publicInvitation(record, nowSeconds),
        claimedNew: false,
      };
    }

    const claimed: StoredMatchInvitation = {
      ...record,
      status: "claimed",
      claimant,
      matchId: requestedMatchId,
      claimedAt: nowSeconds,
    };
    await this.#storage.put(INVITATION_RECORD_KEY, claimed);
    return {
      invitation: publicInvitation(claimed, nowSeconds),
      claimedNew: true,
    };
  }

  async #cancel(body: Record<string, unknown>): Promise<PublicMatchInvitation> {
    const invitationId = boundedText(body.invitationId, "Invitation ID");
    const playerId = boundedText(body.playerId, "Invitation cancellation player ID");
    const record = await this.#record(invitationId);
    const nowSeconds = Math.floor(this.#now() / 1000);
    if (record.inviter.playerId !== playerId) {
      throw Object.assign(new Error("Only the invitation creator can cancel it."), {
        code: "forbidden",
      });
    }
    if (record.status === "claimed") {
      throw Object.assign(new Error("A claimed invitation cannot be cancelled."), {
        code: "invitation_claimed",
      });
    }
    if (record.status === "declined") return publicInvitation(record, nowSeconds);
    if (record.status === "cancelled") return publicInvitation(record, nowSeconds);
    const cancelled: StoredMatchInvitation = {
      ...record,
      status: "cancelled",
      cancelledAt: nowSeconds,
    };
    await this.#storage.put(INVITATION_RECORD_KEY, cancelled);
    return publicInvitation(cancelled, nowSeconds);
  }

  async #decline(body: Record<string, unknown>): Promise<PublicMatchInvitation> {
    const invitationId = boundedText(body.invitationId, "Invitation ID");
    const playerId = boundedText(body.playerId, "Invitation decline player ID");
    const record = await this.#record(invitationId);
    const nowSeconds = Math.floor(this.#now() / 1000);
    if (!record.targetPlayerId || record.targetPlayerId !== playerId) {
      throw Object.assign(new Error("Only the targeted invitation recipient can decline it."), {
        code: "forbidden",
      });
    }
    if (record.status === "claimed") {
      throw Object.assign(new Error("A claimed invitation cannot be declined."), {
        code: "invitation_claimed",
      });
    }
    if (record.status === "cancelled") {
      throw Object.assign(new Error("A cancelled invitation cannot be declined."), {
        code: "invitation_cancelled",
      });
    }
    if (record.status === "declined") return publicInvitation(record, nowSeconds);
    if (record.expiresAt <= nowSeconds) {
      throw Object.assign(new Error("The match invitation has expired."), {
        code: "invitation_expired",
      });
    }
    const declined: StoredMatchInvitation = {
      ...record,
      status: "declined",
      declinedAt: nowSeconds,
    };
    await this.#storage.put(INVITATION_RECORD_KEY, declined);
    return publicInvitation(declined, nowSeconds);
  }
}
