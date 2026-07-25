import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { InMemoryTicTacToeService } from "./in-memory-match-service.ts";

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
    if (body.length > 16_384) {
      throw new Error("Request body is too large.");
    }
  }
  return body ? JSON.parse(body) as Record<string, unknown> : {};
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

export function createGameFrameServer(service = new InMemoryTicTacToeService()) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");

      if (request.method === "GET" && url.pathname === "/api/health") {
        return json(response, 200, { status: "ok", service: "theo-gameframe" });
      }

      if (request.method === "POST" && url.pathname === "/api/matches") {
        const body = await readJson(request);
        const humanPlayerId = String(body.humanPlayerId ?? "").trim();
        return json(response, 201, service.createHumanVsTheo(humanPlayerId));
      }

      const route = matchRoute(url.pathname);
      if (route && request.method === "GET" && !route.action) {
        const playerId = url.searchParams.get("playerId") ?? "";
        return json(response, 200, service.view(route.matchId, playerId));
      }

      if (route && request.method === "POST" && route.action) {
        const body = await readJson(request);
        const view = await service.submitHumanAction({
          matchId: route.matchId,
          playerId: String(body.playerId ?? ""),
          actionId: String(body.actionId ?? ""),
          expectedRevision: Number(body.expectedRevision),
          action: { type: "place", cell: Number((body.action as { cell?: unknown } | undefined)?.cell) },
        });
        return json(response, 200, view);
      }

      if (url.pathname.startsWith("/api/")) {
        return json(response, 404, { error: "not_found" });
      }

      return await serveStatic(url.pathname, response);
    } catch (caught) {
      const error = caught as ApiError;
      const status = error.code === "stale_revision" ? 409 : 400;
      return json(response, status, {
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
    console.log(`Theo GameFrame development server: http://127.0.0.1:${port}`);
  });
}
