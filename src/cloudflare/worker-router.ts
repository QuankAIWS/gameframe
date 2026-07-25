import {
  RejectingRequestAuthenticator,
  rejectIdentityClaim,
  requirePrincipalSeat,
  type RequestAuthenticator,
} from "../auth/request-authenticator.ts";
import { errorResponse, json, readJson } from "./http-utils.ts";
import type { GameFrameWorkerEnv } from "./runtime-contracts.ts";

interface WorkerRouterOptions {
  idGenerator?: () => string;
  authenticator?: RequestAuthenticator;
}

type MatchOperation = "view" | "actions" | "events";

function publicMatchRoute(pathname: string): { matchId: string; operation: MatchOperation } | null {
  const match = /^\/api\/matches\/([^/]+)(?:\/(actions|events))?$/.exec(pathname);
  if (!match) return null;
  return {
    matchId: decodeURIComponent(match[1]),
    operation: (match[2] as MatchOperation | undefined) ?? "view",
  };
}

function stubFor(env: GameFrameWorkerEnv, matchId: string) {
  return env.MATCHES.get(env.MATCHES.idFromName(matchId));
}

export function createGameFrameWorker(options: WorkerRouterOptions = {}) {
  const idGenerator = options.idGenerator ?? (() => crypto.randomUUID());
  const authenticator = options.authenticator ?? new RejectingRequestAuthenticator(
    "Cloudflare game APIs require a configured Discord or service identity verifier.",
  );

  return {
    async fetch(request: Request, env: GameFrameWorkerEnv): Promise<Response> {
      try {
        const url = new URL(request.url);

        if (request.method === "GET" && url.pathname === "/api/health") {
          return json(200, {
            status: "ok",
            service: "theo-gameframe",
            runtime: "cloudflare",
            realtime: "websocket-hibernation",
            authentication: "required",
          });
        }

        if (request.method === "POST" && url.pathname === "/api/matches") {
          const principal = await authenticator.authenticate(request);
          const body = await readJson(request);
          const playerIds = Array.isArray(body.playerIds)
            ? body.playerIds.map((playerId) => String(playerId))
            : [];
          requirePrincipalSeat(principal, playerIds);
          const matchId = idGenerator();
          return stubFor(env, matchId).fetch(new Request("https://match.internal/initialize", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ matchId, playerIds }),
          }));
        }

        const route = publicMatchRoute(url.pathname);
        if (route && request.method === "GET" && route.operation === "view") {
          const principal = await authenticator.authenticate(request);
          rejectIdentityClaim(principal, url.searchParams.get("playerId"));
          const internal = new URL("https://match.internal/view");
          internal.searchParams.set("matchId", route.matchId);
          internal.searchParams.set("playerId", principal.playerId);
          return stubFor(env, route.matchId).fetch(new Request(internal));
        }

        if (route && request.method === "POST" && route.operation === "actions") {
          const principal = await authenticator.authenticate(request);
          const body = await readJson(request);
          rejectIdentityClaim(principal, body.playerId);
          return stubFor(env, route.matchId).fetch(new Request("https://match.internal/actions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...body, matchId: route.matchId, playerId: principal.playerId }),
          }));
        }

        if (route && request.method === "GET" && route.operation === "events") {
          const principal = await authenticator.authenticate(request);
          rejectIdentityClaim(principal, url.searchParams.get("playerId"));
          const internal = new URL("https://match.internal/events");
          internal.searchParams.set("matchId", route.matchId);
          internal.searchParams.set("playerId", principal.playerId);
          return stubFor(env, route.matchId).fetch(new Request(internal, {
            method: "GET",
            headers: request.headers,
          }));
        }

        if (url.pathname.startsWith("/api/")) {
          return json(404, { error: "not_found" });
        }

        return env.ASSETS
          ? env.ASSETS.fetch(request)
          : new Response("Static assets binding is unavailable.", { status: 404 });
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}
