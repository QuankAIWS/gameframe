import type { AuthenticatedPrincipal } from "../auth/request-authenticator.ts";
import { json } from "./http-utils.ts";

const MAX_REQUEST_BODY_BYTES = 131_072;
const DEFAULT_MAX_RESPONSE_BYTES = 262_144;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const MINIMUM_SECRET_BYTES = 32;
const NONCE_BYTES = 24;
const ALLOWED_CONTENT_TYPE = "application/json";
const encoder = new TextEncoder();

const SIGNED_HEADER_NAMES = {
  version: "x-gameframe-auth-version",
  principalKind: "x-gameframe-principal-kind",
  principalId: "x-gameframe-principal-id",
  issuedAt: "x-gameframe-issued-at",
  nonce: "x-gameframe-nonce",
  bodySha256: "x-gameframe-body-sha256",
  signature: "x-gameframe-signature",
  displayName: "x-gameframe-display-name",
  avatarUrl: "x-gameframe-avatar-url",
} as const;

export interface RpgEdgeProxyEnvironment {
  GAMEFRAME_RPG_ORIGIN_URL?: string;
  GAMEFRAME_RPG_PROXY_HMAC_SECRET?: string;
}

export interface RpgEdgeProxyDependencies {
  fetcher?: typeof fetch;
  now?: () => number;
  randomBytes?: (length: number) => Uint8Array;
  requestTimeoutMs?: number;
  maxResponseBytes?: number;
}

export type RpgEdgeRoute = {
  campaignId: string;
  operation: "attach" | "commands";
};

export function publicRpgEdgeRoute(pathname: string): RpgEdgeRoute | null {
  const match = /^\/api\/rpg\/campaigns\/([^/]+)\/(attach|commands)$/.exec(pathname);
  if (!match) return null;
  return {
    campaignId: decodeURIComponent(match[1]!),
    operation: match[2] as RpgEdgeRoute["operation"],
  };
}

export async function proxyPublicRpgRequest(
  request: Request,
  env: RpgEdgeProxyEnvironment,
  principal: AuthenticatedPrincipal,
  dependencies: RpgEdgeProxyDependencies = {},
): Promise<Response> {
  try {
    const requestUrl = new URL(request.url);
    const route = publicRpgEdgeRoute(requestUrl.pathname);
    if (!route) {
      throw new RpgEdgeProxyError(404, "not_found", "The requested RPG edge route does not exist.");
    }
    if (request.method !== "POST") {
      return json(405, {
        error: "method_not_allowed",
        message: "The requested RPG edge route accepts POST only.",
      }, { allow: "POST" });
    }
    if (principal.source !== "discord") {
      throw new RpgEdgeProxyError(
        403,
        "forbidden",
        "Public RPG routes require a Discord-authenticated player session.",
      );
    }

    requireSameOrigin(request, requestUrl);
    const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (contentType !== ALLOWED_CONTENT_TYPE) {
      throw new RpgEdgeProxyError(
        415,
        "unsupported_media_type",
        "RPG edge requests must use application/json.",
      );
    }

    const contentLength = request.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_REQUEST_BODY_BYTES) {
      throw new RpgEdgeProxyError(413, "request_too_large", "The RPG request body is too large.");
    }
    const body = new Uint8Array(await request.arrayBuffer());
    if (body.byteLength > MAX_REQUEST_BODY_BYTES) {
      throw new RpgEdgeProxyError(413, "request_too_large", "The RPG request body is too large.");
    }

    const configuration = configurationFor(env, requestUrl.origin);
    const upstreamUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, configuration.originUrl);
    const now = dependencies.now?.() ?? Date.now();
    if (!Number.isSafeInteger(now) || now < 0) {
      throw new RpgEdgeProxyError(500, "edge_clock_invalid", "The RPG edge clock is invalid.");
    }
    const randomBytes = dependencies.randomBytes ?? defaultRandomBytes;
    const nonce = encodeBase64Url(randomBytes(NONCE_BYTES));
    const signedHeaders = await createRpgEdgeProxyHeaders({
      proxySecret: configuration.proxySecret,
      method: request.method,
      url: upstreamUrl,
      body,
      playerId: principal.playerId,
      issuedAt: now,
      nonce,
      displayName: principal.displayName,
      avatarUrl: principal.avatarUrl,
    });
    signedHeaders.set("accept", "application/json");
    signedHeaders.set("content-type", ALLOWED_CONTENT_TYPE);

    const requestTimeoutMs = boundedInteger(
      dependencies.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
      "requestTimeoutMs",
      100,
      60_000,
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    let upstream: Response;
    try {
      upstream = await (dependencies.fetcher ?? fetch)(upstreamUrl, {
        method: "POST",
        headers: signedHeaders,
        body,
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new RpgEdgeProxyError(504, "upstream_timeout", "The RPG service did not respond in time.");
      }
      throw new RpgEdgeProxyError(502, "upstream_unavailable", "The RPG service is unavailable.");
    } finally {
      clearTimeout(timeout);
    }

    return await sanitizeUpstreamResponse(
      upstream,
      boundedInteger(
        dependencies.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES,
        "maxResponseBytes",
        1_024,
        1_048_576,
      ),
    );
  } catch (error) {
    if (error instanceof RpgEdgeProxyError) {
      return json(error.status, { error: error.code, message: error.message });
    }
    return json(500, {
      error: "edge_internal_error",
      message: "The RPG edge gateway could not complete the request.",
    });
  }
}

export type CreateRpgEdgeProxyHeadersInput = {
  proxySecret: string | Uint8Array;
  method: string;
  url: string | URL;
  body: Uint8Array;
  playerId: string;
  issuedAt: number;
  nonce: string;
  displayName?: string;
  avatarUrl?: string;
};

/** Worker-compatible implementation of the accepted GameFrame HMAC contract. */
export async function createRpgEdgeProxyHeaders(
  input: CreateRpgEdgeProxyHeadersInput,
): Promise<Headers> {
  const secret = secretBytes(input.proxySecret);
  const playerId = requiredText(input.playerId, "playerId", 160);
  const nonce = requiredText(input.nonce, "nonce", 128);
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) {
    throw new TypeError("nonce is invalid");
  }
  if (!Number.isSafeInteger(input.issuedAt) || input.issuedAt < 0) {
    throw new TypeError("issuedAt must be a non-negative integer");
  }
  const displayName = optionalText(input.displayName, "displayName", 160);
  const avatarUrl = optionalAvatarUrl(input.avatarUrl);
  const bodySha256 = encodeBase64Url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", input.body)),
  );
  const issuedAt = String(input.issuedAt);
  const canonical = JSON.stringify([
    "gameframe-hmac-v1",
    input.method.toUpperCase(),
    pathAndQuery(input.url),
    playerId,
    issuedAt,
    nonce,
    bodySha256,
    displayName ?? "",
    avatarUrl ?? "",
  ]);
  const key = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = encodeBase64Url(new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(canonical),
  )));
  const headers = new Headers({
    [SIGNED_HEADER_NAMES.version]: "1",
    [SIGNED_HEADER_NAMES.principalKind]: "player",
    [SIGNED_HEADER_NAMES.principalId]: playerId,
    [SIGNED_HEADER_NAMES.issuedAt]: issuedAt,
    [SIGNED_HEADER_NAMES.nonce]: nonce,
    [SIGNED_HEADER_NAMES.bodySha256]: bodySha256,
    [SIGNED_HEADER_NAMES.signature]: signature,
  });
  if (displayName) headers.set(SIGNED_HEADER_NAMES.displayName, displayName);
  if (avatarUrl) headers.set(SIGNED_HEADER_NAMES.avatarUrl, avatarUrl);
  return headers;
}

function configurationFor(
  env: RpgEdgeProxyEnvironment,
  publicOrigin: string,
): { originUrl: URL; proxySecret: string } {
  const originValue = env.GAMEFRAME_RPG_ORIGIN_URL?.trim() ?? "";
  const proxySecret = env.GAMEFRAME_RPG_PROXY_HMAC_SECRET ?? "";
  if (!originValue || !proxySecret) {
    throw new RpgEdgeProxyError(
      503,
      "edge_not_configured",
      "The RPG edge gateway is not configured.",
    );
  }
  if (new TextEncoder().encode(proxySecret).byteLength < MINIMUM_SECRET_BYTES) {
    throw new RpgEdgeProxyError(
      503,
      "edge_not_configured",
      "The RPG edge gateway secret is invalid.",
    );
  }
  let originUrl: URL;
  try {
    originUrl = new URL(originValue);
  } catch {
    throw new RpgEdgeProxyError(503, "edge_not_configured", "The RPG origin URL is invalid.");
  }
  if (
    originUrl.protocol !== "https:"
    || originUrl.username
    || originUrl.password
    || originUrl.search
    || originUrl.hash
    || originUrl.pathname !== "/"
    || originUrl.origin === publicOrigin
  ) {
    throw new RpgEdgeProxyError(
      503,
      "edge_not_configured",
      "The RPG origin must be a distinct HTTPS origin root.",
    );
  }
  return { originUrl, proxySecret };
}

function requireSameOrigin(request: Request, requestUrl: URL): void {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (origin !== requestUrl.origin) {
    throw new RpgEdgeProxyError(
      403,
      "cross_origin_forbidden",
      "RPG mutations require an exact same-origin browser request.",
    );
  }
}

async function sanitizeUpstreamResponse(
  response: Response,
  maximumBytes: number,
): Promise<Response> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > maximumBytes) {
    throw new RpgEdgeProxyError(502, "upstream_response_invalid", "The RPG service response is too large.");
  }
  const bytes = await readBoundedBody(response, maximumBytes);
  const headers = new Headers({
    "cache-control": "no-store",
    "content-type": normalizedResponseContentType(response.headers.get("content-type")),
  });
  const retryAfter = response.headers.get("retry-after")?.trim();
  if (retryAfter && /^\d{1,6}$/.test(retryAfter)) headers.set("retry-after", retryAfter);
  return new Response(bytes, { status: response.status, headers });
}

async function readBoundedBody(response: Response, maximumBytes: number): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel("RPG response exceeded edge limit").catch(() => undefined);
        throw new RpgEdgeProxyError(
          502,
          "upstream_response_invalid",
          "The RPG service response is too large.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function normalizedResponseContentType(value: string | null): string {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized.startsWith("application/json")
    ? "application/json; charset=utf-8"
    : "application/octet-stream";
}

function pathAndQuery(value: string | URL): string {
  const url = value instanceof URL ? value : new URL(value);
  return `${url.pathname}${url.search}`;
}

function defaultRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function secretBytes(value: string | Uint8Array): Uint8Array {
  const bytes = typeof value === "string" ? encoder.encode(value) : new Uint8Array(value);
  if (bytes.byteLength < MINIMUM_SECRET_BYTES) {
    throw new TypeError(`proxySecret must contain at least ${MINIMUM_SECRET_BYTES} bytes`);
  }
  return bytes;
}

function requiredText(value: string, label: string, maximumLength: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximumLength || /[\r\n\0]/.test(normalized)) {
    throw new TypeError(`${label} is invalid`);
  }
  return normalized;
}

function optionalText(
  value: string | undefined,
  label: string,
  maximumLength: number,
): string | undefined {
  if (value === undefined || value === "") return undefined;
  return requiredText(value, label, maximumLength);
}

function optionalAvatarUrl(value: string | undefined): string | undefined {
  const normalized = optionalText(value, "avatarUrl", 2_048);
  if (!normalized) return undefined;
  const url = new URL(normalized);
  if (url.protocol !== "https:") throw new TypeError("avatarUrl must use https");
  return url.toString();
}

function boundedInteger(
  value: number,
  label: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${label} must be an integer from ${minimum} through ${maximum}`);
  }
  return value;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

class RpgEdgeProxyError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "RpgEdgeProxyError";
    this.status = status;
    this.code = code;
  }
}
