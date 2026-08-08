import type { AuthenticatedPrincipal } from "../auth/request-authenticator.ts";
import { createRpgEdgeProxyHeaders } from "./rpg-edge-proxy.ts";
import { json } from "./http-utils.ts";

const ADMIN_RESET_PATH = "/api/rpg/admin/reset-staging";
const MAX_REQUEST_BODY_BYTES = 16_384;
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

export interface RpgAdminEdgeEnvironment {
  GAMEFRAME_RPG_ORIGIN_URL?: string;
  GAMEFRAME_RPG_PROXY_HMAC_SECRET?: string;
}

export function isPublicRpgAdminRoute(pathname: string): boolean {
  return pathname === ADMIN_RESET_PATH;
}

/**
 * Privileged staging control-plane proxy. Caller authorization is performed by
 * the Worker before this function is entered. The VM still requires the normal
 * signed GameFrame HMAC envelope, so the origin is not directly callable by a
 * browser even when the tunnel hostname is known.
 */
export async function proxyPublicRpgAdminRequest(
  request: Request,
  env: RpgAdminEdgeEnvironment,
  principal: AuthenticatedPrincipal,
): Promise<Response> {
  try {
    const requestUrl = new URL(request.url);
    if (!isPublicRpgAdminRoute(requestUrl.pathname)) {
      return json(404, { error: "not_found" });
    }
    if (request.method !== "POST") {
      return json(405, { error: "method_not_allowed" }, { allow: "POST" });
    }
    const origin = request.headers.get("origin")?.trim() ?? "";
    if (origin !== requestUrl.origin) {
      return json(403, {
        error: "cross_origin_forbidden",
        message: "Staging administrator mutations require an exact same-origin request.",
      });
    }
    const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (contentType !== "application/json") {
      return json(415, {
        error: "unsupported_media_type",
        message: "Staging administrator requests require application/json.",
      });
    }
    const body = new Uint8Array(await request.arrayBuffer());
    if (body.byteLength > MAX_REQUEST_BODY_BYTES) {
      return json(413, { error: "request_too_large" });
    }

    const originValue = env.GAMEFRAME_RPG_ORIGIN_URL?.trim() ?? "";
    const proxySecret = env.GAMEFRAME_RPG_PROXY_HMAC_SECRET ?? "";
    if (!originValue || !proxySecret) {
      return json(503, { error: "edge_not_configured" });
    }
    const upstreamBase = new URL(originValue);
    if (upstreamBase.protocol !== "https:" || upstreamBase.origin === requestUrl.origin) {
      return json(503, { error: "edge_not_configured" });
    }
    const upstreamUrl = new URL(requestUrl.pathname, upstreamBase);
    const nonceBytes = new Uint8Array(24);
    crypto.getRandomValues(nonceBytes);
    let binary = "";
    for (const byte of nonceBytes) binary += String.fromCharCode(byte);
    const nonce = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    const headers = await createRpgEdgeProxyHeaders({
      proxySecret,
      method: "POST",
      url: upstreamUrl,
      body,
      playerId: principal.playerId,
      issuedAt: Date.now(),
      nonce,
      ...(principal.displayName ? { displayName: principal.displayName } : {}),
      ...(principal.avatarUrl ? { avatarUrl: principal.avatarUrl } : {}),
    });
    headers.set("accept", "application/json");
    headers.set("content-type", "application/json");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);
    try {
      const upstream = await fetch(upstreamUrl, {
        method: "POST",
        headers,
        body,
        redirect: "manual",
        signal: controller.signal,
      });
      const bytes = new Uint8Array(await upstream.arrayBuffer());
      return new Response(bytes, {
        status: upstream.status,
        headers: {
          "cache-control": "no-store",
          "content-type": upstream.headers.get("content-type")?.startsWith("application/json")
            ? "application/json; charset=utf-8"
            : "application/octet-stream",
        },
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return json(502, {
      error: "admin_upstream_unavailable",
      message: error instanceof Error ? error.message : "The staging administrator request failed.",
    });
  }
}
