import { AuthenticationError } from "./request-authenticator.ts";

export type InvitationGameId =
  | "tic-tac-toe"
  | "american-checkers"
  | "tactical-movement-canary"
  | "tactical-combat-canary";

export interface MatchInvitationClaims {
  version: 1;
  invitationId: string;
  nonce: string;
  gameId: InvitationGameId;
  inviterPlayerId: string;
  targetPlayerId?: string;
  issuedAt: number;
  expiresAt: number;
}

export interface MatchInvitationTokenInput {
  invitationId: string;
  gameId: InvitationGameId;
  inviterPlayerId: string;
  targetPlayerId?: string;
  ttlSeconds?: number;
}

export interface MatchInvitationTokenCodecOptions {
  now?: () => number;
  randomBytes?: (length: number) => Uint8Array;
  defaultTtlSeconds?: number;
}

export class MatchInvitationError extends Error {
  readonly code:
    | "invitation_invalid"
    | "invitation_expired"
    | "invitation_target_mismatch";

  constructor(code: MatchInvitationError["code"], message: string) {
    super(message);
    this.name = "MatchInvitationError";
    this.code = code;
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function validPlayerId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 160;
}

export function isInvitationGameId(value: unknown): value is InvitationGameId {
  return value === "tic-tac-toe"
    || value === "american-checkers"
    || value === "tactical-movement-canary"
    || value === "tactical-combat-canary";
}

export function resumePathForGame(gameId: InvitationGameId, matchId: string): string {
  const encodedMatchId = encodeURIComponent(matchId);
  if (gameId === "tactical-movement-canary") return `/tactical.html?match=${encodedMatchId}`;
  if (gameId === "tactical-combat-canary") return `/combat.html?match=${encodedMatchId}`;
  return `/?match=${encodedMatchId}`;
}

export function discordTargetPlayerId(discordUserId: unknown): string | undefined {
  if (discordUserId === undefined || discordUserId === null || discordUserId === "") return undefined;
  const normalized = String(discordUserId).trim();
  if (!/^\d+$/.test(normalized)) {
    throw new MatchInvitationError(
      "invitation_invalid",
      "An invitation target must be a numeric Discord user ID.",
    );
  }
  return `discord:${normalized}`;
}

export function requireInvitationTarget(
  claims: MatchInvitationClaims,
  claimantPlayerId: string,
): void {
  if (claims.inviterPlayerId === claimantPlayerId) {
    throw new AuthenticationError("forbidden", "The invitation creator cannot claim the second seat.");
  }
  if (claims.targetPlayerId && claims.targetPlayerId !== claimantPlayerId) {
    throw new MatchInvitationError(
      "invitation_target_mismatch",
      "This invitation is restricted to a different authenticated Discord user.",
    );
  }
}

export class MatchInvitationTokenCodec {
  readonly #key: Promise<CryptoKey>;
  readonly #now: () => number;
  readonly #randomBytes: (length: number) => Uint8Array;
  readonly #defaultTtlSeconds: number;

  constructor(secret: string, options: MatchInvitationTokenCodecOptions = {}) {
    if (secret.length < 32) {
      throw new Error("Match invitation signing requires a secret of at least 32 characters.");
    }
    this.#key = crypto.subtle.importKey(
      "raw",
      encoder.encode(`scribbles-gameframe:match-invitation:${secret}`),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
    this.#now = options.now ?? (() => Date.now());
    this.#randomBytes = options.randomBytes ?? randomBytes;
    this.#defaultTtlSeconds = options.defaultTtlSeconds ?? DEFAULT_TTL_SECONDS;
  }

  async issue(input: MatchInvitationTokenInput): Promise<{
    token: string;
    claims: MatchInvitationClaims;
  }> {
    if (!input.invitationId.trim() || input.invitationId.length > 160) {
      throw new MatchInvitationError("invitation_invalid", "Invitation IDs must be non-empty and bounded.");
    }
    if (!isInvitationGameId(input.gameId)) {
      throw new MatchInvitationError("invitation_invalid", "The requested game cannot be invited.");
    }
    if (!validPlayerId(input.inviterPlayerId)) {
      throw new MatchInvitationError("invitation_invalid", "The invitation requires a valid inviter identity.");
    }
    if (input.targetPlayerId !== undefined && !validPlayerId(input.targetPlayerId)) {
      throw new MatchInvitationError("invitation_invalid", "The invitation target identity is invalid.");
    }
    if (input.targetPlayerId === input.inviterPlayerId) {
      throw new MatchInvitationError("invitation_invalid", "The invitation target must differ from the inviter.");
    }
    const ttlSeconds = input.ttlSeconds ?? this.#defaultTtlSeconds;
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 7 * 24 * 60 * 60) {
      throw new MatchInvitationError("invitation_invalid", "Invitation TTL must be between one minute and seven days.");
    }
    const issuedAt = Math.floor(this.#now() / 1000);
    const claims: MatchInvitationClaims = {
      version: 1,
      invitationId: input.invitationId,
      nonce: encodeBase64Url(this.#randomBytes(32)),
      gameId: input.gameId,
      inviterPlayerId: input.inviterPlayerId,
      ...(input.targetPlayerId ? { targetPlayerId: input.targetPlayerId } : {}),
      issuedAt,
      expiresAt: issuedAt + ttlSeconds,
    };
    const payload = encodeBase64Url(encoder.encode(JSON.stringify(claims)));
    const signature = new Uint8Array(await crypto.subtle.sign(
      "HMAC",
      await this.#key,
      encoder.encode(payload),
    ));
    return { token: `${payload}.${encodeBase64Url(signature)}`, claims };
  }

  async verify(token: string): Promise<MatchInvitationClaims> {
    if (!token || token.length > 4096) {
      throw new MatchInvitationError("invitation_invalid", "The match invitation is missing or invalid.");
    }
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra !== undefined) {
      throw new MatchInvitationError("invitation_invalid", "The match invitation is malformed.");
    }

    let signatureBytes: Uint8Array;
    let claims: Partial<MatchInvitationClaims>;
    try {
      signatureBytes = decodeBase64Url(signature);
      claims = JSON.parse(decoder.decode(decodeBase64Url(payload))) as Partial<MatchInvitationClaims>;
    } catch {
      throw new MatchInvitationError("invitation_invalid", "The match invitation is malformed.");
    }

    const signatureValid = await crypto.subtle.verify(
      "HMAC",
      await this.#key,
      signatureBytes,
      encoder.encode(payload),
    );
    const now = Math.floor(this.#now() / 1000);
    if (
      !signatureValid
      || claims.version !== 1
      || typeof claims.invitationId !== "string"
      || !claims.invitationId.trim()
      || claims.invitationId.length > 160
      || typeof claims.nonce !== "string"
      || claims.nonce.length < 32
      || !isInvitationGameId(claims.gameId)
      || !validPlayerId(claims.inviterPlayerId)
      || (claims.targetPlayerId !== undefined && !validPlayerId(claims.targetPlayerId))
      || claims.targetPlayerId === claims.inviterPlayerId
      || typeof claims.issuedAt !== "number"
      || typeof claims.expiresAt !== "number"
      || claims.issuedAt > now + 60
      || claims.expiresAt <= claims.issuedAt
    ) {
      throw new MatchInvitationError("invitation_invalid", "The match invitation is invalid.");
    }
    if (claims.expiresAt <= now) {
      throw new MatchInvitationError("invitation_expired", "The match invitation has expired.");
    }
    return claims as MatchInvitationClaims;
  }
}
