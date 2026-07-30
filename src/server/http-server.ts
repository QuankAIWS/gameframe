import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DevelopmentHeaderAuthenticator,
  rejectIdentityClaim,
  requirePrincipalSeat,
  type RequestAuthenticator,
} from "../auth/request-authenticator.ts";
import { InMemoryGameFrameService } from "./in-memory-match-service.ts";

const publicRoot = fileURLToPath(new URL("../../public/", import.meta.url));

interface ApiError extends Error {
  code?: string;
  revision?: number;
}

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(value));
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 65_536) {
      throw new Error("Request body is too large.");
    }
  }
  return body ? JSON.parse(body) as Record<string, unknown> : {};
}

function authenticationRequest(request: IncomingMessage, url: URL): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }
  return new Request(url, { method: request.method, headers });
}

function matchRoute(pathname: string): { matchId: string; action: boolean } | null {
  const match = /^\/api\/matches\/([^/]+)(\/actions)?$/.exec(pathname);
  if (!match) return null;
  return { matchId: decodeURIComponent(match[1]), action: Boolean(match[2]) };
}

function contentType(path: string): string {
  return ({
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
  } as Record<string, string>)[extname(path)] ?? "application/octet-stream";
}

async function serveStatic(pathname: string, response: ServerResponse): Promise<void> {
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const safe = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
  const path = join(publicRoot, safe);
  try {
    const data = await readFile(path);
    response.writeHead(200, { "content-type": contentType(path) });
    response.end(data);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

function errorStatus(error: ApiError): number {
  if (error.code === "authentication_required") return 401;
  if (error.code === "forbidden" || error.code === "identity_mismatch") return 403;
  if (error.code === "stale_revision" || error.code === "match_exists") return 409;
  if (error.code === "match_not_found") return 404;
  return 400;
}

export function createGameFrameServer(
  service = new InMemoryGameFrameService(),
  authenticator: RequestAuthenticator = new DevelopmentHeaderAuthenticator(),
) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");

      if (request.method === "GET" && url.pathname === "/api/health") {
        return json(response, 200, {
          status: "ok",
          service: "scribbles-gameframe",
          runtime: "node-local",
          realtime: false,
          authentication: "development-header",
          games: ["tic-tac-toe", "american-checkers", "tactical-movement-canary"],
        });
      }

      if (request.method === "POST" && url.pathname === "/api/matches") {
        const principal = await authenticator.authenticate(authenticationRequest(request, url));
        const body = await readJson(request);
        const playerIds = Array.isArray(body.playerIds)
          ? body.playerIds.map((playerId) => String(playerId))
          : [];
        requirePrincipalSeat(principal, playerIds);
        const gameId = String(body.gameId ?? "tic-tac-toe");
        return json(response, 201, await service.createMatch(gameId, playerIds));
      }

      const route = matchRoute(url.pathname);
      if (route && request.method === "GET" && !route.action) {
        const principal = await authenticator.authenticate(authenticationRequest(request, url));
        rejectIdentityClaim(principal, url.searchParams.get("playerId"));
        return json(response, 200, await service.view(route.matchId, principal.playerId));
      }

      if (route && request.method === "POST" && route.action) {
        const principal = await authenticator.authenticate(authenticationRequest(request, url));
        const body = await readJson(request);
        rejectIdentityClaim(principal, body.playerId);
        const view = await service.submitAction({
          matchId: route.matchId,
          playerId: principal.playerId,
          actionId: String(body.actionId ?? ""),
          expectedRevision: Number(body.expectedRevision),
          action: body.action,
        });
        return json(response, 200, view);
      }

      if (url.pathname.startsWith("/api/")) {
        return json(response, 404, { error: "not_found" });
      }

      return await serveStatic(url.pathname, response);
    } catch (caught) {
      const error = caught as ApiError;
      return json(response, errorStatus(error), {
        error: error.code ?? "bad_request",
        message: error.message,
        revision: error.revision,
      });
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT ?? 8787);
  const server = createGameFrameServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`Scribbles GameFrame development server: http://127.0.0.1:${port}`);
  });
}
