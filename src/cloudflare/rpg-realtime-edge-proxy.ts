import type { AuthenticatedPrincipal } from "../auth/request-authenticator.ts";
import { json } from "./http-utils.ts";
import {
  createRpgEdgeProxyHeaders,
  type RpgEdgeProxyDependencies,
  type RpgEdgeProxyEnvironment,
} from "./rpg-edge-proxy.ts";

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const MINIMUM_SECRET_BYTES = 32;
const NONCE_BYTES = 24;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

export type RpgRealtimeEdgeRoute =
  | { kind: "campaign"; campaignId: string }
  | { kind: "match"; matchId: string };

export function publicRpgRealtimeEdgeRoute(pathname: string): RpgRealtimeEdgeRoute | null {
  const campaign = /^\/api\/rpg\/campaigns\/([^/]+)\/realtime$/.exec(pathname);
  if (campaign) {
    const campaignId = decodedIdentifier(campaign[1]!);
    return campaignId ? { kind: "campaign", campaignId } : null;
  }
  const match = /^\/api\/matches\/(rpg%3A[^/]+|rpg:[^/]+)\/events$/.exec(pathname);
  if (!match) return null;
  const matchId = decodedIdentifier(match[1]!);
  return matchId?.startsWith("rpg:") ? { kind: "match", matchId } : null;
}

/**
 * Authenticates an RPG WebSocket handshake at the public Worker and forwards
 * only the signed upgrade to the private VM origin. The returned 101 response
 * is intentionally passed through untouched so Cloudflare proxies WebSocket
 * frames without making the Worker or a Durable Object another state authority.
 */
export async function proxyPublicRpgRealtimeRequest(
  request: Request,
  env: RpgEdgeProxyEnvironment,
  principal: AuthenticatedPrincipal,
  dependencies: RpgEdgeProxyDependencies = {},
): Promise<Response> {
  try {
    const requestUrl = new URL(request.url);
    const route = publicRpgRealtimeEdgeRoute(requestUrl.pathname);
    if (!route) {
      throw new RpgRealtimeEdgeProxyError(404, "not_found", "The requested RPG realtime route does not exist.");
    }
    if (principal.source !== "discord") {
      throw new RpgRealtimeEdgeProxyError(
        403,
        "forbidden",
        "Public RPG realtime routes require a Discord-authenticated player session.",
      );
    }
    if (request.method !== "GET") {
      return json(405, {
        error: "method_not_allowed",
        message: "RPG realtime routes accept GET WebSocket upgrades only.",
      }, { allow: "GET" });
    }
    if (request.headers.get("upgrade")?.trim().toLowerCase() !== "websocket") {
      return json(426, {
        error: "upgrade_required",
        message: "RPG realtime routes require a WebSocket upgrade.",
      }, { upgrade: "websocket" });
    }
    requireSameOrigin(request, requestUrl);

    const configuration = configurationFor(env, requestUrl.origin);
    const upstreamUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, configuration.originUrl);
    const now = dependencies.now?.() ?? Date.now();
    if (!Number.isSafeInteger(now) || now < 0) {
      throw new RpgRealtimeEdgeProxyError(500, "edge_clock_invalid", "The RPG edge clock is invalid.");
    }
    const nonce = encodeBase64Url((dependencies.randomBytes ?? defaultRandomBytes)(NONCE_BYTES));
    const headers = await createRpgEdgeProxyHeaders({
      proxySecret: configuration.proxySecret,
      method: "GET",
      url: upstreamUrl,
      body: new Uint8Array(),
      playerId: principal.playerId,
      issuedAt: now,
      nonce,
      displayName: principal.displayName,
      avatarUrl: principal.avatarUrl,
    });
    headers.set("upgrade", "websocket");

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      boundedInteger(dependencies.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS, 100, 60_000),
    );
    let upstream: Response;
    try {
      upstream = await (dependencies.fetcher ?? fetch)(upstreamUrl, {
        method: "GET",
        headers,
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new RpgRealtimeEdgeProxyError(504, "upstream_timeout", "The RPG realtime service did not respond in time.");
      }
      throw new RpgRealtimeEdgeProxyError(502, "upstream_unavailable", "The RPG realtime service is unavailable.");
    } finally {
      clearTimeout(timeout);
    }

    if (upstream.status !== 101) {
      const status = upstream.status === 401 || upstream.status === 403 || upstream.status === 404
        ? upstream.status
        : 502;
      throw new RpgRealtimeEdgeProxyError(
        status,
        status === 403 ? "forbidden" : status === 404 ? "not_found" : "upstream_upgrade_failed",
        "The RPG realtime service refused the WebSocket upgrade.",
      );
    }
    return upstream;
  } catch (error) {
    if (error instanceof RpgRealtimeEdgeProxyError) {
      return json(error.status, { error: error.code, message: error.message });
    }
    return json(500, {
      error: "edge_internal_error",
      message: "The RPG realtime edge gateway could not complete the request.",
    });
  }
}

function requireSameOrigin(request: Request, requestUrl: URL): void {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (origin !== requestUrl.origin) {
    throw new RpgRealtimeEdgeProxyError(
      403,
      "cross_origin_forbidden",
      "RPG realtime upgrades require an exact same-origin browser request.",
    );
  }
}

function configurationFor(
  env: RpgEdgeProxyEnvironment,
  publicOrigin: string,
): { originUrl: URL; proxySecret: string } {
  const originValue = env.GAMEFRAME_RPG_ORIGIN_URL?.trim() ?? "";
  const proxySecret = env.GAMEFRAME_RPG_PROXY_HMAC_SECRET ?? "";
  if (!originValue || new TextEncoder().encode(proxySecret).byteLength < MINIMUM_SECRET_BYTES) {
    throw new RpgRealtimeEdgeProxyError(503, "edge_not_configured", "The RPG edge gateway is not configured.");
  }
  let originUrl: URL;
  try {
    originUrl = new URL(originValue);
  } catch {
    throw new RpgRealtimeEdgeProxyError(503, "edge_not_configured", "The RPG origin URL is invalid.");
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
    throw new RpgRealtimeEdgeProxyError(
      503,
      "edge_not_configured",
      "The RPG origin must be a distinct HTTPS origin root.",
    );
  }
  return { originUrl, proxySecret };
}

function decodedIdentifier(value: string): string | undefined {
  try {
    const decoded = decodeURIComponent(value);
    return IDENTIFIER_PATTERN.test(decoded) ? decoded : undefined;
  } catch {
    return undefined;
  }
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
    throw new RpgRealtimeEdgeProxyError(500, "edge_configuration_invalid", "The RPG edge configuration is invalid.");
  }
  return value;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

class RpgRealtimeEdgeProxyError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "RpgRealtimeEdgeProxyError";
    this.status = status;
    this.code = code;
  }
}
