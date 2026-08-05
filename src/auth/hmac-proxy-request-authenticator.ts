import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import {
  AuthenticationError,
  type AuthenticatedPrincipal,
  type RequestAuthenticator,
} from "./request-authenticator.ts";

const AUTH_VERSION = "1";
const MINIMUM_SECRET_BYTES = 32;
const DEFAULT_MAX_CLOCK_SKEW_MS = 60_000;
const DEFAULT_MAX_REPLAY_ENTRIES = 10_000;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const DIGEST_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const GAMEFRAME_PROXY_AUTH_HEADERS = {
  version: "x-gameframe-auth-version",
  principalKind: "x-gameframe-principal-kind",
  principalId: "x-gameframe-principal-id",
  issuedAt: "x-gameframe-issued-at",
  nonce: "x-gameframe-nonce",
  bodySha256: "x-gameframe-body-sha256",
  signature: "x-gameframe-signature",
  displayName: "x-gameframe-display-name",
  avatarUrl: "x-gameframe-avatar-url",
  serviceId: "x-gameframe-service-id",
} as const;

export type HmacProxyRequestAuthenticatorOptions = {
  proxySecret: string | Uint8Array;
  serviceToken: string | Uint8Array;
  now?: () => number;
  maxClockSkewMs?: number;
  maxReplayEntries?: number;
};

/**
 * Production boundary for a loopback service behind an authenticated edge.
 *
 * Player requests require an HMAC over method, path/query, identity metadata,
 * timestamp, nonce, and the exact request-body digest. Internal service calls
 * use a loopback bearer token plus an explicit service identity.
 */
export class HmacProxyRequestAuthenticator implements RequestAuthenticator {
  readonly #proxySecret: Buffer;
  readonly #serviceTokenDigest: Buffer;
  readonly #now: () => number;
  readonly #maxClockSkewMs: number;
  readonly #maxReplayEntries: number;
  readonly #replayExpirations = new Map<string, number>();

  constructor(options: HmacProxyRequestAuthenticatorOptions) {
    if (!options || typeof options !== "object") {
      throw new TypeError("HMAC proxy authenticator options are required.");
    }
    this.#proxySecret = secretBytes(options.proxySecret, "proxySecret");
    this.#serviceTokenDigest = sha256(secretBytes(options.serviceToken, "serviceToken"));
    this.#now = options.now ?? Date.now;
    this.#maxClockSkewMs = boundedInteger(
      options.maxClockSkewMs ?? DEFAULT_MAX_CLOCK_SKEW_MS,
      "maxClockSkewMs",
      1_000,
      300_000,
    );
    this.#maxReplayEntries = boundedInteger(
      options.maxReplayEntries ?? DEFAULT_MAX_REPLAY_ENTRIES,
      "maxReplayEntries",
      100,
      1_000_000,
    );
  }

  async authenticate(request: Request): Promise<AuthenticatedPrincipal> {
    const authorization = request.headers.get("authorization")?.trim() ?? "";
    const serviceId = request.headers.get(GAMEFRAME_PROXY_AUTH_HEADERS.serviceId)?.trim() ?? "";
    if (authorization || serviceId) {
      return this.#authenticateService(request, authorization, serviceId);
    }
    return await this.#authenticatePlayer(request);
  }

  #authenticateService(
    request: Request,
    authorization: string,
    serviceIdValue: string,
  ): AuthenticatedPrincipal {
    if (hasPlayerProxyClaims(request.headers)) {
      throw invalid("A request cannot combine service and signed player identities.");
    }
    if (!authorization || !serviceIdValue) {
      throw required("Service requests require bearer authorization and a service identity.");
    }
    const match = /^Bearer ([^\s]+)$/.exec(authorization);
    if (!match || !safeEqual(sha256(Buffer.from(match[1]!, "utf8")), this.#serviceTokenDigest)) {
      throw invalid("Service bearer authorization is invalid.");
    }
    const serviceId = identifier(serviceIdValue, "service identity");
    return {
      playerId: serviceId,
      source: "service",
      displayName: "Authenticated RPG service",
    };
  }

  async #authenticatePlayer(request: Request): Promise<AuthenticatedPrincipal> {
    const headers = request.headers;
    const version = requiredHeader(headers, GAMEFRAME_PROXY_AUTH_HEADERS.version);
    if (version !== AUTH_VERSION) throw invalid("Signed player auth version is unsupported.");
    const principalKind = requiredHeader(headers, GAMEFRAME_PROXY_AUTH_HEADERS.principalKind);
    if (principalKind !== "player") {
      throw invalid("Signed proxy requests may assert only player identities.");
    }
    const playerId = identifier(
      requiredHeader(headers, GAMEFRAME_PROXY_AUTH_HEADERS.principalId),
      "player identity",
    );
    const issuedAtText = requiredHeader(headers, GAMEFRAME_PROXY_AUTH_HEADERS.issuedAt);
    if (!/^\d{13}$/.test(issuedAtText)) {
      throw invalid("Signed player issued-at must be Unix epoch milliseconds.");
    }
    const issuedAt = Number(issuedAtText);
    const now = this.#now();
    if (!Number.isSafeInteger(now) || Math.abs(now - issuedAt) > this.#maxClockSkewMs) {
      throw invalid("Signed player request is outside the accepted clock window.");
    }
    const nonce = requiredHeader(headers, GAMEFRAME_PROXY_AUTH_HEADERS.nonce);
    if (!NONCE_PATTERN.test(nonce)) throw invalid("Signed player nonce is invalid.");
    const claimedBodyHash = requiredHeader(headers, GAMEFRAME_PROXY_AUTH_HEADERS.bodySha256);
    if (!DIGEST_PATTERN.test(claimedBodyHash)) {
      throw invalid("Signed player body digest is invalid.");
    }
    const actualBodyHash = hashBody(new Uint8Array(await request.arrayBuffer()));
    if (!safeEqualText(actualBodyHash, claimedBodyHash)) {
      throw invalid("Signed player body digest does not match the request body.");
    }
    const displayName = optionalMetadata(
      headers.get(GAMEFRAME_PROXY_AUTH_HEADERS.displayName),
      "display name",
      160,
    );
    const avatarUrl = optionalAvatarUrl(headers.get(GAMEFRAME_PROXY_AUTH_HEADERS.avatarUrl));
    const signature = requiredHeader(headers, GAMEFRAME_PROXY_AUTH_HEADERS.signature);
    if (!DIGEST_PATTERN.test(signature)) throw invalid("Signed player signature is invalid.");

    const expected = signCanonical(
      this.#proxySecret,
      canonicalRequest({
        method: request.method,
        url: request.url,
        playerId,
        issuedAt: issuedAtText,
        nonce,
        bodySha256: claimedBodyHash,
        displayName,
        avatarUrl,
      }),
    );
    if (!safeEqualText(signature, expected)) {
      throw invalid("Signed player signature verification failed.");
    }

    this.#purgeExpired(now);
    const replayKey = `${playerId}:${nonce}`;
    if (this.#replayExpirations.has(replayKey)) {
      throw invalid("Signed player request nonce was already used.");
    }
    if (this.#replayExpirations.size >= this.#maxReplayEntries) {
      throw invalid("Signed player replay cache is at capacity.");
    }
    this.#replayExpirations.set(replayKey, issuedAt + this.#maxClockSkewMs);

    return {
      playerId,
      source: "discord",
      ...(displayName ? { displayName } : {}),
      ...(avatarUrl ? { avatarUrl } : {}),
    };
  }

  #purgeExpired(now: number): void {
    for (const [key, expiresAt] of this.#replayExpirations) {
      if (expiresAt < now) this.#replayExpirations.delete(key);
    }
  }
}

export type SignGameFrameProxyRequestInput = {
  proxySecret: string | Uint8Array;
  method: string;
  url: string | URL;
  body?: string | Uint8Array;
  playerId: string;
  issuedAt: number;
  nonce: string;
  displayName?: string;
  avatarUrl?: string;
};

/** Reference signer used by tests and the future authenticated edge gateway. */
export function signGameFrameProxyRequest(
  input: SignGameFrameProxyRequestInput,
): Headers {
  const secret = secretBytes(input.proxySecret, "proxySecret");
  const playerId = identifier(input.playerId, "player identity");
  if (!Number.isSafeInteger(input.issuedAt) || input.issuedAt < 0) {
    throw new TypeError("issuedAt must be non-negative Unix epoch milliseconds.");
  }
  if (!NONCE_PATTERN.test(input.nonce)) throw new TypeError("nonce is invalid.");
  const displayName = optionalMetadata(input.displayName, "display name", 160);
  const avatarUrl = optionalAvatarUrl(input.avatarUrl);
  const body = typeof input.body === "string"
    ? Buffer.from(input.body, "utf8")
    : Buffer.from(input.body ?? new Uint8Array());
  const bodySha256 = hashBody(body);
  const issuedAt = String(input.issuedAt);
  const signature = signCanonical(
    secret,
    canonicalRequest({
      method: input.method,
      url: String(input.url),
      playerId,
      issuedAt,
      nonce: input.nonce,
      bodySha256,
      displayName,
      avatarUrl,
    }),
  );
  const headers = new Headers({
    [GAMEFRAME_PROXY_AUTH_HEADERS.version]: AUTH_VERSION,
    [GAMEFRAME_PROXY_AUTH_HEADERS.principalKind]: "player",
    [GAMEFRAME_PROXY_AUTH_HEADERS.principalId]: playerId,
    [GAMEFRAME_PROXY_AUTH_HEADERS.issuedAt]: issuedAt,
    [GAMEFRAME_PROXY_AUTH_HEADERS.nonce]: input.nonce,
    [GAMEFRAME_PROXY_AUTH_HEADERS.bodySha256]: bodySha256,
    [GAMEFRAME_PROXY_AUTH_HEADERS.signature]: signature,
  });
  if (displayName) headers.set(GAMEFRAME_PROXY_AUTH_HEADERS.displayName, displayName);
  if (avatarUrl) headers.set(GAMEFRAME_PROXY_AUTH_HEADERS.avatarUrl, avatarUrl);
  return headers;
}

function canonicalRequest(input: {
  method: string;
  url: string;
  playerId: string;
  issuedAt: string;
  nonce: string;
  bodySha256: string;
  displayName?: string;
  avatarUrl?: string;
}): string {
  const url = new URL(input.url);
  return JSON.stringify([
    "gameframe-hmac-v1",
    input.method.toUpperCase(),
    `${url.pathname}${url.search}`,
    input.playerId,
    input.issuedAt,
    input.nonce,
    input.bodySha256,
    input.displayName ?? "",
    input.avatarUrl ?? "",
  ]);
}

function signCanonical(secret: Uint8Array, canonical: string): string {
  return createHmac("sha256", secret).update(canonical, "utf8").digest("base64url");
}

function hashBody(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("base64url");
}

function sha256(value: Uint8Array): Buffer {
  return createHash("sha256").update(value).digest();
}

function safeEqualText(left: string, right: string): boolean {
  return safeEqual(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function safeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  return timingSafeEqual(left, right);
}

function secretBytes(value: string | Uint8Array, label: string): Buffer {
  const bytes = typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value);
  if (bytes.byteLength < MINIMUM_SECRET_BYTES) {
    throw new TypeError(`${label} must contain at least ${MINIMUM_SECRET_BYTES} bytes.`);
  }
  return bytes;
}

function requiredHeader(headers: Headers, name: string): string {
  const value = headers.get(name)?.trim();
  if (!value) throw required(`Signed player requests require the ${name} header.`);
  return value;
}

function hasPlayerProxyClaims(headers: Headers): boolean {
  return [
    GAMEFRAME_PROXY_AUTH_HEADERS.principalId,
    GAMEFRAME_PROXY_AUTH_HEADERS.signature,
    GAMEFRAME_PROXY_AUTH_HEADERS.nonce,
  ].some((name) => Boolean(headers.get(name)?.trim()));
}

function identifier(value: string, label: string): string {
  if (!IDENTIFIER_PATTERN.test(value)) throw invalid(`${label} is invalid.`);
  return value;
}

function optionalMetadata(
  value: string | null | undefined,
  label: string,
  maximumLength: number,
): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > maximumLength || /[\r\n\0]/.test(normalized)) {
    throw invalid(`Signed player ${label} is invalid.`);
  }
  return normalized;
}

function optionalAvatarUrl(value: string | null | undefined): string | undefined {
  const normalized = optionalMetadata(value, "avatar URL", 2_048);
  if (!normalized) return undefined;
  let url: URL;
  try {
    url = new URL(normalized);
  } catch (error) {
    throw new AuthenticationError("identity_mismatch", "Signed player avatar URL is invalid.");
  }
  if (url.protocol !== "https:") {
    throw invalid("Signed player avatar URL must use https.");
  }
  return url.toString();
}

function boundedInteger(
  value: number,
  label: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${label} must be an integer from ${minimum} through ${maximum}.`);
  }
  return value;
}

function required(message: string): AuthenticationError {
  return new AuthenticationError("authentication_required", message);
}

function invalid(message: string): AuthenticationError {
  return new AuthenticationError("identity_mismatch", message);
}
