import {
  RejectingRequestAuthenticator,
  type RequestAuthenticator,
} from "../auth/request-authenticator.ts";
import {
  SignedCookieSessionAuthenticator,
  SignedSessionCodec,
} from "../auth/signed-session.ts";
import { errorResponse, json } from "./http-utils.ts";
import {
  proxyPublicRpgMatchRequest,
  publicRpgMatchEdgeRoute,
} from "./rpg-match-edge-proxy.ts";
import {
  proxyPublicRpgRequest,
  publicRpgEdgeRoute,
  type RpgEdgeProxyDependencies,
} from "./rpg-edge-proxy.ts";
import type { GameFrameWorkerEnv } from "./runtime-contracts.ts";
import { createGameFrameWorker } from "./worker-router.ts";

export interface RpgEdgeWorkerOptions {
  authenticator?: RequestAuthenticator;
  proxyDependencies?: RpgEdgeProxyDependencies;
}

/**
 * Adds the public RPG edge boundary in front of the existing GameFrame Worker.
 * Authenticated RPG campaign and RPG-bound tactical requests are HMAC-proxied to
 * the durable VM service. Ordinary games, OAuth, invitations, assets, and their
 * Durable Object match authority remain on the existing worker router.
 */
export function createRpgEdgeGameFrameWorker(options: RpgEdgeWorkerOptions = {}) {
  const gameFrame = createGameFrameWorker();
  let cachedAuthenticator: {
    secret: string;
    authenticator: RequestAuthenticator;
  } | null = null;

  function authenticatorFor(env: GameFrameWorkerEnv): RequestAuthenticator {
    if (options.authenticator) return options.authenticator;
    const secret = env.SESSION_SECRET?.trim() ?? "";
    if (!secret) {
      return new RejectingRequestAuthenticator(
        "Cloudflare RPG APIs require a configured Discord session verifier.",
      );
    }
    if (!cachedAuthenticator || cachedAuthenticator.secret !== secret) {
      cachedAuthenticator = {
        secret,
        authenticator: new SignedCookieSessionAuthenticator(new SignedSessionCodec(secret)),
      };
    }
    return cachedAuthenticator.authenticator;
  }

  return {
    async fetch(request: Request, env: GameFrameWorkerEnv): Promise<Response> {
      try {
        const url = new URL(request.url);
        if (request.method === "GET" && url.pathname === "/api/rpg/edge/health") {
          return json(200, {
            status: "ok",
            service: "scribbles-gameframe-rpg-edge",
            runtime: "cloudflare-worker",
            authentication: "discord-oauth-session",
            upstreamAuthentication: "gameframe-hmac-v1",
            configured: Boolean(
              env.GAMEFRAME_RPG_ORIGIN_URL?.trim()
              && env.GAMEFRAME_RPG_PROXY_HMAC_SECRET?.trim(),
            ),
          });
        }

        // The generic health endpoint advertises the Durable Object WebSocket
        // transport used by ordinary matches. An RPG battle page is intentionally
        // bound to VM SQLite authority, so keep that client on its existing HTTP
        // polling fallback instead of letting /events reconnect to another store.
        if (
          request.method === "GET"
          && url.pathname === "/api/health"
          && rpgMatchReferrer(request, url.origin)
        ) {
          const baseHealth = await gameFrame.fetch(request, env);
          if (!baseHealth.ok) return baseHealth;
          const value = await baseHealth.json() as Record<string, unknown>;
          return json(200, {
            ...value,
            realtime: "http-polling",
            rpgMatchAuthority: "vm-sqlite",
          });
        }

        if (publicRpgEdgeRoute(url.pathname)) {
          const principal = await authenticatorFor(env).authenticate(request);
          return await proxyPublicRpgRequest(
            request,
            env,
            principal,
            options.proxyDependencies,
          );
        }

        if (publicRpgMatchEdgeRoute(url.pathname)) {
          const principal = await authenticatorFor(env).authenticate(request);
          return await proxyPublicRpgMatchRequest(
            request,
            env,
            principal,
            options.proxyDependencies,
          );
        }

        if (url.pathname.startsWith("/api/rpg/")) {
          return json(404, {
            error: "not_found",
            message: "The requested public RPG route is not exposed by the edge gateway.",
          });
        }

        return await gameFrame.fetch(request, env);
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}

function rpgMatchReferrer(request: Request, publicOrigin: string): boolean {
  const referrer = request.headers.get("referer")?.trim();
  if (!referrer) return false;
  try {
    const url = new URL(referrer);
    if (url.origin !== publicOrigin || url.pathname !== "/monster-master.html") return false;
    return (url.searchParams.get("match") ?? "").startsWith("rpg:");
  } catch {
    return false;
  }
}
