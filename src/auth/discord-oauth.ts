import {
  AuthenticationError,
  type AuthenticatedPrincipal,
} from "./request-authenticator.ts";
import { readCookie } from "./signed-session.ts";

const DISCORD_AUTHORIZE_ENDPOINT = "https://discord.com/oauth2/authorize";
const DISCORD_TOKEN_ENDPOINT = "https://discord.com/api/v10/oauth2/token";
const DISCORD_CURRENT_USER_ENDPOINT = "https://discord.com/api/v10/users/@me";
const OAUTH_STATE_COOKIE = "gameframe_discord_oauth";
const OAUTH_STATE_TTL_SECONDS = 10 * 60;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface DiscordOAuthEnvironment {
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  DISCORD_ALLOWED_USER_IDS?: string;
  SESSION_SECRET?: string;
}

export interface DiscordOAuthDependencies {
  now?: () => number;
  fetcher?: typeof fetch;
  randomBytes?: (length: number) => Uint8Array;
}

export interface DiscordOAuthTransaction {
  returnTo: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
}

export interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  bot?: boolean;
}

export class DiscordOAuthError extends Error {
  readonly code:
    | "oauth_configuration_error"
    | "oauth_state_invalid"
    | "discord_oauth_exchange_failed"
    | "discord_identity_failed";

  constructor(code: DiscordOAuthError["code"], message: string) {
    super(message);
    this.name = "DiscordOAuthError";
    this.code = code;
  }
}

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

function defaultRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function safeReturnTo(value: string | null | undefined): string {
  const candidate = value?.trim() || "/";
  if (
    candidate.length > 1024 ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return "/";
  }
  return candidate;
}

function requireEnvironment(env: DiscordOAuthEnvironment) {
  const clientId = env.DISCORD_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.DISCORD_CLIENT_SECRET?.trim() ?? "";
  const allowedUsers = env.DISCORD_ALLOWED_USER_IDS?.trim() ?? "";
  const sessionSecret = env.SESSION_SECRET ?? "";
  if (!/^\d+$/.test(clientId)) {
    throw new DiscordOAuthError("oauth_configuration_error", "DISCORD_CLIENT_ID must be configured as a numeric Discord application ID.");
  }
  if (!clientSecret) {
    throw new DiscordOAuthError("oauth_configuration_error", "DISCORD_CLIENT_SECRET is not configured.");
  }
  if (!allowedUsers) {
    throw new DiscordOAuthError("oauth_configuration_error", "DISCORD_ALLOWED_USER_IDS is not configured; staging access fails closed.");
  }
  if (sessionSecret.length < 32) {
    throw new DiscordOAuthError("oauth_configuration_error", "SESSION_SECRET must contain at least 32 characters.");
  }
  const allowAll = allowedUsers === "*";
  const allowedUserIds = new Set(
    allowAll
      ? []
      : allowedUsers.split(",").map((value) => value.trim()).filter(Boolean),
  );
  if (!allowAll && (allowedUserIds.size === 0 || [...allowedUserIds].some((id) => !/^\d+$/.test(id)))) {
    throw new DiscordOAuthError(
      "oauth_configuration_error",
      "DISCORD_ALLOWED_USER_IDS must be '*' or a comma-separated list of numeric Discord user IDs.",
    );
  }
  return { clientId, clientSecret, sessionSecret, allowAll, allowedUserIds };
}

export class DiscordOAuthStateCodec {
  readonly #key: Promise<CryptoKey>;
  readonly #now: () => number;
  readonly #randomBytes: (length: number) => Uint8Array;

  constructor(secret: string, dependencies: DiscordOAuthDependencies = {}) {
    if (secret.length < 32) throw new Error("OAuth state signing requires a secret of at least 32 characters.");
    this.#key = crypto.subtle.importKey(
      "raw",
      encoder.encode(`scribbles-gameframe:discord-oauth-state:${secret}`),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
    this.#now = dependencies.now ?? (() => Date.now());
    this.#randomBytes = dependencies.randomBytes ?? defaultRandomBytes;
  }

  async issue(returnTo: string): Promise<string> {
    const issuedAt = Math.floor(this.#now() / 1000);
    const transaction: DiscordOAuthTransaction = {
      returnTo: safeReturnTo(returnTo),
      nonce: encodeBase64Url(this.#randomBytes(32)),
      issuedAt,
      expiresAt: issuedAt + OAUTH_STATE_TTL_SECONDS,
    };
    const payload = encodeBase64Url(encoder.encode(JSON.stringify(transaction)));
    const signature = new Uint8Array(await crypto.subtle.sign(
      "HMAC",
      await this.#key,
      encoder.encode(payload),
    ));
    return `${payload}.${encodeBase64Url(signature)}`;
  }

  async verify(token: string): Promise<DiscordOAuthTransaction> {
    if (!token || token.length > 4096) {
      throw new DiscordOAuthError("oauth_state_invalid", "The Discord OAuth transaction is missing or invalid.");
    }
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra !== undefined) {
      throw new DiscordOAuthError("oauth_state_invalid", "The Discord OAuth transaction is malformed.");
    }
    let signatureBytes: Uint8Array;
    let transaction: Partial<DiscordOAuthTransaction>;
    try {
      signatureBytes = decodeBase64Url(signature);
      transaction = JSON.parse(decoder.decode(decodeBase64Url(payload))) as Partial<DiscordOAuthTransaction>;
    } catch {
      throw new DiscordOAuthError("oauth_state_invalid", "The Discord OAuth transaction is malformed.");
    }
    const valid = await crypto.subtle.verify(
      "HMAC",
      await this.#key,
      signatureBytes,
      encoder.encode(payload),
    );
    const now = Math.floor(this.#now() / 1000);
    if (
      !valid ||
      typeof transaction.returnTo !== "string" ||
      safeReturnTo(transaction.returnTo) !== transaction.returnTo ||
      typeof transaction.nonce !== "string" ||
      transaction.nonce.length < 32 ||
      typeof transaction.issuedAt !== "number" ||
      typeof transaction.expiresAt !== "number" ||
      transaction.issuedAt > now + 60 ||
      transaction.expiresAt <= now ||
      transaction.expiresAt <= transaction.issuedAt
    ) {
      throw new DiscordOAuthError("oauth_state_invalid", "The Discord OAuth transaction is expired or invalid.");
    }
    return transaction as DiscordOAuthTransaction;
  }
}

export function createWebsiteOAuthStateCookie(state: string): string {
  return [
    `${OAUTH_STATE_COOKIE}=${state}`,
    "Path=/auth/discord/callback",
    `Max-Age=${OAUTH_STATE_TTL_SECONDS}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

export function clearWebsiteOAuthStateCookie(): string {
  return `${OAUTH_STATE_COOKIE}=; Path=/auth/discord/callback; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export function createActivityOAuthStateCookie(state: string, clientId: string): string {
  return [
    `${OAUTH_STATE_COOKIE}=${state}`,
    `Domain=${clientId}.discordsays.com`,
    "Path=/auth/discord/activity/session",
    `Max-Age=${OAUTH_STATE_TTL_SECONDS}`,
    "HttpOnly",
    "Secure",
    "SameSite=None",
    "Partitioned",
  ].join("; ");
}

export function clearActivityOAuthStateCookie(clientId: string): string {
  return [
    `${OAUTH_STATE_COOKIE}=`,
    `Domain=${clientId}.discordsays.com`,
    "Path=/auth/discord/activity/session",
    "Max-Age=0",
    "HttpOnly",
    "Secure",
    "SameSite=None",
    "Partitioned",
  ].join("; ");
}

export function readDiscordOAuthStateCookie(request: Request): string | null {
  return readCookie(request, OAUTH_STATE_COOKIE);
}

export class DiscordOAuthClient {
  readonly clientId: string;
  readonly #clientSecret: string;
  readonly #allowAll: boolean;
  readonly #allowedUserIds: Set<string>;
  readonly #fetcher: typeof fetch;
  readonly stateCodec: DiscordOAuthStateCodec;

  constructor(env: DiscordOAuthEnvironment, dependencies: DiscordOAuthDependencies = {}) {
    const configuration = requireEnvironment(env);
    this.clientId = configuration.clientId;
    this.#clientSecret = configuration.clientSecret;
    this.#allowAll = configuration.allowAll;
    this.#allowedUserIds = configuration.allowedUserIds;
    this.#fetcher = dependencies.fetcher ?? fetch;
    this.stateCodec = new DiscordOAuthStateCodec(configuration.sessionSecret, dependencies);
  }

  authorizationUrl(state: string, redirectUri: string): string {
    const url = new URL(DISCORD_AUTHORIZE_ENDPOINT);
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "identify");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "consent");
    return url.toString();
  }

  async validateState(request: Request, suppliedState: string): Promise<DiscordOAuthTransaction> {
    const cookieState = readDiscordOAuthStateCookie(request);
    if (!cookieState || !constantTimeEqual(cookieState, suppliedState)) {
      throw new DiscordOAuthError("oauth_state_invalid", "The Discord OAuth state did not match the initiating browser.");
    }
    return this.stateCodec.verify(suppliedState);
  }

  async exchangeCode(code: string, redirectUri?: string): Promise<DiscordTokenResponse> {
    if (!code.trim() || code.length > 2048) {
      throw new DiscordOAuthError("discord_oauth_exchange_failed", "Discord did not provide a valid authorization code.");
    }
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.#clientSecret,
      grant_type: "authorization_code",
      code,
    });
    if (redirectUri) body.set("redirect_uri", redirectUri);
    const response = await this.#fetcher(DISCORD_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) {
      throw new DiscordOAuthError("discord_oauth_exchange_failed", `Discord rejected the authorization code (${response.status}).`);
    }
    const token = await response.json() as Partial<DiscordTokenResponse>;
    if (
      typeof token.access_token !== "string" ||
      !token.access_token ||
      typeof token.token_type !== "string" ||
      token.token_type.toLowerCase() !== "bearer" ||
      typeof token.expires_in !== "number" ||
      typeof token.scope !== "string" ||
      !token.scope.split(/\s+/).includes("identify")
    ) {
      throw new DiscordOAuthError("discord_oauth_exchange_failed", "Discord returned an invalid OAuth token response.");
    }
    return token as DiscordTokenResponse;
  }

  async currentUser(accessToken: string): Promise<DiscordUser> {
    const response = await this.#fetcher(DISCORD_CURRENT_USER_ENDPOINT, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new DiscordOAuthError("discord_identity_failed", `Discord user lookup failed (${response.status}).`);
    }
    const user = await response.json() as Partial<DiscordUser>;
    if (
      typeof user.id !== "string" ||
      !/^\d+$/.test(user.id) ||
      typeof user.username !== "string" ||
      !user.username ||
      user.bot === true
    ) {
      throw new DiscordOAuthError("discord_identity_failed", "Discord returned an invalid or unsupported user identity.");
    }
    return user as DiscordUser;
  }

  principalFor(user: DiscordUser): AuthenticatedPrincipal {
    if (!this.#allowAll && !this.#allowedUserIds.has(user.id)) {
      throw new AuthenticationError("forbidden", "This Discord account is not permitted to access the GameFrame staging deployment.");
    }
    const displayName = user.global_name?.trim() || user.username;
    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
      : undefined;
    return {
      playerId: `discord:${user.id}`,
      source: "discord",
      displayName,
      ...(avatarUrl ? { avatarUrl } : {}),
    };
  }
}
