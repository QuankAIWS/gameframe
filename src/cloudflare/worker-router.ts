import { errorResponse, json, readJson } from "./http-utils.ts";
import type { GameFrameWorkerEnv } from "./runtime-contracts.ts";

interface WorkerRouterOptions {
  idGenerator?: () => string;
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
          });
        }

        if (request.method === "POST" && url.pathname === "/api/matches") {
          const body = await readJson(request);
          const matchId = idGenerator();
          return stubFor(env, matchId).fetch(new Request("https://match.internal/initialize", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ matchId, playerIds: body.playerIds }),
          }));
        }

        const route = publicMatchRoute(url.pathname);
        if (route && request.method === "GET" && route.operation === "view") {
          const internal = new URL("https://match.internal/view");
          internal.searchParams.set("matchId", route.matchId);
          internal.searchParams.set("playerId", url.searchParams.get("playerId") ?? "");
          return stubFor(env, route.matchId).fetch(new Request(internal));
        }

        if (route && request.method === "POST" && route.operation === "actions") {
          const body = await readJson(request);
          return stubFor(env, route.matchId).fetch(new Request("https://match.internal/actions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...body, matchId: route.matchId }),
          }));
        }

        if (route && request.method === "GET" && route.operation === "events") {
          const internal = new URL("https://match.internal/events");
          internal.searchParams.set("matchId", route.matchId);
          internal.searchParams.set("playerId", url.searchParams.get("playerId") ?? "");
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
