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
 * Only authenticated Discord sessions reach the HMAC-signing proxy. All other
 * assets, OAuth routes, invitations, and Durable Object game APIs retain the
 * existing worker router.
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

        if (publicRpgEdgeRoute(url.pathname)) {
          const principal = await authenticatorFor(env).authenticate(request);
          return await proxyPublicRpgRequest(
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
