import {
  AuthenticationError,
  type AuthenticatedPrincipal,
  type PrincipalSource,
  type RequestAuthenticator,
} from "./request-authenticator.ts";

interface SessionPayload {
  version: 1;
  playerId: string;
  source: PrincipalSource;
  issuedAt: number;
  expiresAt: number;
  displayName?: string;
  avatarUrl?: string;
}

export interface SignedSessionCodecOptions {
  now?: () => number;
  defaultTtlSeconds?: number;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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

function validSource(value: unknown): value is PrincipalSource {
  return value === "development" || value === "discord" || value === "service";
}

function validOptionalText(value: unknown, maximumLength: number): value is string | undefined {
  return value === undefined || (typeof value === "string" && value.length > 0 && value.length <= maximumLength);
}

export class SignedSessionCodec {
  readonly #key: Promise<CryptoKey>;
  readonly #now: () => number;
  readonly #defaultTtlSeconds: number;

  constructor(secret: string, options: SignedSessionCodecOptions = {}) {
    if (secret.length < 32) {
      throw new Error("The session secret must contain at least 32 characters.");
    }
    this.#key = crypto.subtle.importKey(
      "raw",
      textEncoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
    this.#now = options.now ?? (() => Date.now());
    this.#defaultTtlSeconds = options.defaultTtlSeconds ?? 60 * 60 * 12;
  }

  async issue(
    principal: AuthenticatedPrincipal,
    ttlSeconds = this.#defaultTtlSeconds,
  ): Promise<string> {
    if (!principal.playerId.trim()) throw new Error("A session requires a player ID.");
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error("Session TTL must be positive.");
    }
    if (principal.displayName && principal.displayName.length > 100) {
      throw new Error("Session display names may not exceed 100 characters.");
    }
    if (principal.avatarUrl && principal.avatarUrl.length > 512) {
      throw new Error("Session avatar URLs may not exceed 512 characters.");
    }
    const issuedAt = Math.floor(this.#now() / 1000);
    const payload: SessionPayload = {
      version: 1,
      playerId: principal.playerId,
      source: principal.source,
      issuedAt,
      expiresAt: issuedAt + Math.floor(ttlSeconds),
      ...(principal.displayName ? { displayName: principal.displayName } : {}),
      ...(principal.avatarUrl ? { avatarUrl: principal.avatarUrl } : {}),
    };
    const encodedPayload = encodeBase64Url(textEncoder.encode(JSON.stringify(payload)));
    const signature = new Uint8Array(await crypto.subtle.sign(
      "HMAC",
      await this.#key,
      textEncoder.encode(encodedPayload),
    ));
    return `${encodedPayload}.${encodeBase64Url(signature)}`;
  }

  async verify(token: string): Promise<AuthenticatedPrincipal> {
    if (!token || token.length > 4096) {
      throw new AuthenticationError("authentication_required", "The session token is missing or invalid.");
    }
    const [encodedPayload, encodedSignature, extra] = token.split(".");
    if (!encodedPayload || !encodedSignature || extra !== undefined) {
      throw new AuthenticationError("authentication_required", "The session token is malformed.");
    }

    let signature: Uint8Array;
    let payloadBytes: Uint8Array;
    try {
      signature = decodeBase64Url(encodedSignature);
      payloadBytes = decodeBase64Url(encodedPayload);
    } catch {
      throw new AuthenticationError("authentication_required", "The session token is malformed.");
    }

    const valid = await crypto.subtle.verify(
      "HMAC",
      await this.#key,
      signature,
      textEncoder.encode(encodedPayload),
    );
    if (!valid) {
      throw new AuthenticationError("authentication_required", "The session signature is invalid.");
    }

    let payload: Partial<SessionPayload>;
    try {
      payload = JSON.parse(textDecoder.decode(payloadBytes)) as Partial<SessionPayload>;
    } catch {
      throw new AuthenticationError("authentication_required", "The session payload is invalid.");
    }

    const now = Math.floor(this.#now() / 1000);
    if (
      payload.version !== 1 ||
      typeof payload.playerId !== "string" ||
      !payload.playerId.trim() ||
      !validSource(payload.source) ||
      typeof payload.issuedAt !== "number" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= now ||
      payload.issuedAt > now + 60 ||
      payload.expiresAt <= payload.issuedAt ||
      !validOptionalText(payload.displayName, 100) ||
      !validOptionalText(payload.avatarUrl, 512)
    ) {
      throw new AuthenticationError("authentication_required", "The session is expired or invalid.");
    }

    return {
      playerId: payload.playerId,
      source: payload.source,
      ...(payload.displayName ? { displayName: payload.displayName } : {}),
      ...(payload.avatarUrl ? { avatarUrl: payload.avatarUrl } : {}),
    };
  }
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const item of header.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    const key = item.slice(0, separator).trim();
    if (key !== name) continue;
    return item.slice(separator + 1).trim();
  }
  return null;
}

export class SignedCookieSessionAuthenticator implements RequestAuthenticator {
  readonly #codec: SignedSessionCodec;
  readonly #cookieName: string;

  constructor(codec: SignedSessionCodec, cookieName = "gameframe_session") {
    this.#codec = codec;
    this.#cookieName = cookieName;
  }

  async authenticate(request: Request): Promise<AuthenticatedPrincipal> {
    const token = readCookie(request, this.#cookieName);
    if (!token) {
      throw new AuthenticationError("authentication_required", "An authenticated GameFrame session is required.");
    }
    return this.#codec.verify(token);
  }
}

export interface SessionCookieOptions {
  maxAgeSeconds: number;
  cookieName?: string;
}

function validateCookieOptions(options: SessionCookieOptions): string {
  if (!Number.isInteger(options.maxAgeSeconds) || options.maxAgeSeconds <= 0) {
    throw new Error("Cookie max age must be a positive integer.");
  }
  return options.cookieName ?? "gameframe_session";
}

export function createWebsiteSessionCookie(
  token: string,
  options: SessionCookieOptions,
): string {
  const cookieName = validateCookieOptions(options);
  return [
    `${cookieName}=${token}`,
    "Path=/",
    `Max-Age=${options.maxAgeSeconds}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

export function clearWebsiteSessionCookie(cookieName = "gameframe_session"): string {
  return `${cookieName}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export interface DiscordActivityCookieOptions extends SessionCookieOptions {
  clientId: string;
}

export function createDiscordActivitySessionCookie(
  token: string,
  options: DiscordActivityCookieOptions,
): string {
  if (!/^\d+$/.test(options.clientId)) {
    throw new Error("Discord client ID must contain only digits.");
  }
  const cookieName = validateCookieOptions(options);
  return [
    `${cookieName}=${token}`,
    `Domain=${options.clientId}.discordsays.com`,
    "Path=/",
    `Max-Age=${options.maxAgeSeconds}`,
    "HttpOnly",
    "Secure",
    "SameSite=None",
    "Partitioned",
  ].join("; ");
}

export function clearDiscordActivitySessionCookie(
  clientId: string,
  cookieName = "gameframe_session",
): string {
  if (!/^\d+$/.test(clientId)) throw new Error("Discord client ID must contain only digits.");
  return [
    `${cookieName}=`,
    `Domain=${clientId}.discordsays.com`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "Secure",
    "SameSite=None",
    "Partitioned",
  ].join("; ");
}
