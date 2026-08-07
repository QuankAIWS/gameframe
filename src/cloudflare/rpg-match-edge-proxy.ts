import type { AuthenticatedPrincipal } from "../auth/request-authenticator.ts";
import { json } from "./http-utils.ts";
import {
  createRpgEdgeProxyHeaders,
  type RpgEdgeProxyDependencies,
  type RpgEdgeProxyEnvironment,
} from "./rpg-edge-proxy.ts";

const MAX_REQUEST_BODY_BYTES = 131_072;
const DEFAULT_MAX_RESPONSE_BYTES = 262_144;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const MINIMUM_SECRET_BYTES = 32;
const NONCE_BYTES = 24;
const ALLOWED_CONTENT_TYPE = "application/json";

export type RpgMatchEdgeRoute = {
  matchId: string;
  operation: "view" | "actions";
};

/** Only RPG-bound matches leave the ordinary Durable Object match path. */
export function publicRpgMatchEdgeRoute(pathname: string): RpgMatchEdgeRoute | null {
  const match = /^\/api\/matches\/(rpg%3A[^/]+|rpg:[^/]+)(?:\/(actions))?$/.exec(pathname);
  if (!match) return null;
  const matchId = decodeURIComponent(match[1]!);
  if (!/^rpg:[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(matchId)) return null;
  return {
    matchId,
    operation: match[2] ? "actions" : "view",
  };
}

/**
 * Routes RPG tactical traffic through the same authenticated Worker→Tunnel→VM
 * boundary as campaign commands. Ordinary GameFrame matches continue to use the
 * existing Durable Object runtime.
 */
export async function proxyPublicRpgMatchRequest(
  request: Request,
  env: RpgEdgeProxyEnvironment,
  principal: AuthenticatedPrincipal,
  dependencies: RpgEdgeProxyDependencies = {},
): Promise<Response> {
  try {
    const requestUrl = new URL(request.url);
    const route = publicRpgMatchEdgeRoute(requestUrl.pathname);
    if (!route) {
      throw new RpgMatchEdgeProxyError(404, "not_found", "The requested RPG match route does not exist.");
    }
    if (principal.source !== "discord") {
      throw new RpgMatchEdgeProxyError(
        403,
        "forbidden",
        "Public RPG match routes require a Discord-authenticated player session.",
      );
    }
    const expectedMethod = route.operation === "view" ? "GET" : "POST";
    if (request.method !== expectedMethod) {
      return json(405, {
        error: "method_not_allowed",
        message: `The requested RPG match route accepts ${expectedMethod} only.`,
      }, { allow: expectedMethod });
    }

    const body = route.operation === "actions"
      ? await readMutationBody(request, requestUrl)
      : new Uint8Array();
    const configuration = configurationFor(env, requestUrl.origin);
    const upstreamUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, configuration.originUrl);
    const now = dependencies.now?.() ?? Date.now();
    if (!Number.isSafeInteger(now) || now < 0) {
      throw new RpgMatchEdgeProxyError(500, "edge_clock_invalid", "The RPG edge clock is invalid.");
    }
    const nonce = encodeBase64Url((dependencies.randomBytes ?? defaultRandomBytes)(NONCE_BYTES));
    const headers = await createRpgEdgeProxyHeaders({
      proxySecret: configuration.proxySecret,
      method: expectedMethod,
      url: upstreamUrl,
      body,
      playerId: principal.playerId,
      issuedAt: now,
      nonce,
      displayName: principal.displayName,
      avatarUrl: principal.avatarUrl,
    });
    headers.set("accept", "application/json");
    if (route.operation === "actions") headers.set("content-type", ALLOWED_CONTENT_TYPE);

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      boundedInteger(dependencies.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS, 100, 60_000),
    );
    let upstream: Response;
    try {
      upstream = await (dependencies.fetcher ?? fetch)(upstreamUrl, {
        method: expectedMethod,
        headers,
        ...(body.byteLength ? { body } : {}),
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new RpgMatchEdgeProxyError(504, "upstream_timeout", "The RPG match service did not respond in time.");
      }
      throw new RpgMatchEdgeProxyError(502, "upstream_unavailable", "The RPG match service is unavailable.");
    } finally {
      clearTimeout(timeout);
    }

    return await sanitizeUpstreamResponse(
      upstream,
      boundedInteger(dependencies.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES, 1_024, 1_048_576),
    );
  } catch (error) {
    if (error instanceof RpgMatchEdgeProxyError) {
      return json(error.status, { error: error.code, message: error.message });
    }
    return json(500, {
      error: "edge_internal_error",
      message: "The RPG match edge gateway could not complete the request.",
    });
  }
}

async function readMutationBody(request: Request, requestUrl: URL): Promise<Uint8Array> {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (origin !== requestUrl.origin) {
    throw new RpgMatchEdgeProxyError(
      403,
      "cross_origin_forbidden",
      "RPG match mutations require an exact same-origin browser request.",
    );
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== ALLOWED_CONTENT_TYPE) {
    throw new RpgMatchEdgeProxyError(
      415,
      "unsupported_media_type",
      "RPG match mutations must use application/json.",
    );
  }
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_REQUEST_BODY_BYTES) {
    throw new RpgMatchEdgeProxyError(413, "request_too_large", "The RPG match request body is too large.");
  }
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength > MAX_REQUEST_BODY_BYTES) {
    throw new RpgMatchEdgeProxyError(413, "request_too_large", "The RPG match request body is too large.");
  }
  return body;
}

function configurationFor(
  env: RpgEdgeProxyEnvironment,
  publicOrigin: string,
): { originUrl: URL; proxySecret: string } {
  const originValue = env.GAMEFRAME_RPG_ORIGIN_URL?.trim() ?? "";
  const proxySecret = env.GAMEFRAME_RPG_PROXY_HMAC_SECRET ?? "";
  if (!originValue || new TextEncoder().encode(proxySecret).byteLength < MINIMUM_SECRET_BYTES) {
    throw new RpgMatchEdgeProxyError(503, "edge_not_configured", "The RPG edge gateway is not configured.");
  }
  let originUrl: URL;
  try {
    originUrl = new URL(originValue);
  } catch {
    throw new RpgMatchEdgeProxyError(503, "edge_not_configured", "The RPG origin URL is invalid.");
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
    throw new RpgMatchEdgeProxyError(
      503,
      "edge_not_configured",
      "The RPG origin must be a distinct HTTPS origin root.",
    );
  }
  return { originUrl, proxySecret };
}

async function sanitizeUpstreamResponse(response: Response, maximumBytes: number): Promise<Response> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > maximumBytes) {
    throw new RpgMatchEdgeProxyError(502, "upstream_response_invalid", "The RPG match response is too large.");
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
        await reader.cancel("RPG match response exceeded edge limit").catch(() => undefined);
        throw new RpgMatchEdgeProxyError(
          502,
          "upstream_response_invalid",
          "The RPG match response is too large.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function normalizedResponseContentType(contentType: string | null): string {
  const normalized = contentType?.split(";", 1)[0]?.trim().toLowerCase();
  return normalized === "application/json" ? "application/json" : "text/plain; charset=utf-8";
}

function defaultRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function encodeBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function boundedInteger(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RpgMatchEdgeProxyError(500, "edge_configuration_invalid", "The RPG edge configuration is invalid.");
  }
  return value;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

class RpgMatchEdgeProxyError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "RpgMatchEdgeProxyError";
    this.status = status;
    this.code = code;
  }
}
