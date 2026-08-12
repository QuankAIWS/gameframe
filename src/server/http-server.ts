import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DevelopmentHeaderAuthenticator,
  rejectIdentityClaim,
  requirePlayerPrincipal,
  requirePrincipalSeat,
  type AuthenticatedPrincipal,
  type RequestAuthenticator,
} from "../auth/request-authenticator.ts";
import {
  RpgServiceError,
  type RpgPrincipal,
} from "../rpg/in-memory-rpg-service.ts";
import { InMemoryRpgEncounterMatchCoordinator } from "../rpg/in-memory-rpg-encounter-match-coordinator.ts";
import {
  RPG_CAMPAIGN_PROTOCOL_VERSION,
  RPG_ENCOUNTER_PROTOCOL_VERSION,
  StrictInMemoryRpgService,
} from "../rpg/strict-in-memory-rpg-service.ts";
import { InMemoryGameFrameService } from "./in-memory-match-service.ts";
import { InMemoryPlayerPlatform } from "./in-memory-player-platform.ts";

const publicRoot = fileURLToPath(new URL("../../public/", import.meta.url));
const LEGACY_RPG_PROTOCOL_VERSION = 1;
const RPG_RUNTIME_SERVICE_ID = "rpg-gm-runtime";

interface ApiError extends Error {
  code?: string;
  revision?: number;
  retryable?: boolean;
  status?: number;
  gameframeCoordinationRevision?: number;
  presentationSequence?: number;
  linkedNarrativeRevision?: number;
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
    if (body.length > 65_536) throw new Error("Request body is too large.");
  }
  return body ? JSON.parse(body) as Record<string, unknown> : {};
}

function authenticationRequest(request: IncomingMessage, url: URL): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) headers.set(name, value);
  }
  return new Request(url, { method: request.method, headers });
}

function matchRoute(pathname: string): { matchId: string; action: boolean } | null {
  const match = /^\/api\/matches\/([^/]+)(\/actions)?$/.exec(pathname);
  if (!match) return null;
  return { matchId: decodeURIComponent(match[1]), action: Boolean(match[2]) };
}

function publicPlayerProfileRoute(pathname: string): string | null {
  const match = /^\/api\/players\/([^/]+)\/profile$/.exec(pathname);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function rpgCampaignRoute(pathname: string): { campaignId: string; operation: "attach" | "commands" | "events" } | null {
  const match = /^\/api\/rpg\/campaigns\/([^/]+)\/(attach|commands|events)$/.exec(pathname);
  if (!match) return null;
  return { campaignId: decodeURIComponent(match[1]), operation: match[2] as "attach" | "commands" | "events" };
}

function rpgEncounterRoute(pathname: string): { encounterId?: string; operation: "collection" | "item" | "complete" } | null {
  if (pathname === "/api/rpg/encounters") return { operation: "collection" };
  const match = /^\/api\/rpg\/encounters\/([^/]+)(\/complete)?$/.exec(pathname);
  if (!match) return null;
  return { encounterId: decodeURIComponent(match[1]), operation: match[2] ? "complete" : "item" };
}

function rpgPrincipal(principal: AuthenticatedPrincipal): RpgPrincipal {
  return principal.source === "service"
    ? { kind: "runtime", serviceId: principal.playerId }
    : { kind: "player", playerId: principal.playerId };
}

function requireCampaignPath(body: Record<string, unknown>, campaignId: string): void {
  if (body.campaignId !== campaignId) {
    throw new RpgServiceError({ code: "invalid-command", message: "Campaign ID in the request body must match the route.", status: 400 });
  }
}

function legacyRpgCompatibilityEnabled(): boolean {
  return process.env.GAMEFRAME_ENABLE_RPG_V1_COMPATIBILITY === "1";
}

function requireRpgProtocol(body: Record<string, unknown>): void {
  if (body.protocolVersion === RPG_CAMPAIGN_PROTOCOL_VERSION || body.protocolVersion === RPG_ENCOUNTER_PROTOCOL_VERSION) return;
  if (body.protocolVersion === LEGACY_RPG_PROTOCOL_VERSION && legacyRpgCompatibilityEnabled()) return;
  throw new RpgServiceError({
    code: "unsupported-protocol-version",
    message: `RPG protocol version ${String(body.protocolVersion)} is not available on this server.`,
    status: 400,
  });
}

function requireServicePrincipal(principal: AuthenticatedPrincipal, expectedServiceId: string, message: string): void {
  if (principal.source !== "service" || principal.playerId !== expectedServiceId) {
    throw new RpgServiceError({ code: "forbidden", message, status: 403 });
  }
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
  if (Number.isInteger(error.status)) return Number(error.status);
  if (error.code === "authentication_required") return 401;
  if (error.code === "forbidden" || error.code === "identity_mismatch") return 403;
  if (error.code === "stale_revision" || error.code === "match_exists") return 409;
  if (error.code === "match_not_found") return 404;
  return 400;
}

export function createGameFrameServer(
  matchService = new InMemoryGameFrameService(),
  authenticator: RequestAuthenticator = new DevelopmentHeaderAuthenticator(),
  rpgService = new StrictInMemoryRpgService(),
) {
  const encounterMatches = new InMemoryRpgEncounterMatchCoordinator({ rpg: rpgService, matches: matchService });
  const players = new InMemoryPlayerPlatform();

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
          playerPlatform: true,
          rpg: {
            campaignProtocolVersion: RPG_CAMPAIGN_PROTOCOL_VERSION,
            encounterProtocolVersion: RPG_ENCOUNTER_PROTOCOL_VERSION,
            storage: "memory",
            capabilities: [
              "runtime-events", "bounded-choice", "deterministic-check", "terminal-outcome", "campaign-return",
              "dual-revision-linkage", "runtime-commit-receipts", "encounter-match-binding",
              "shared-team-encounter-control", "automatic-encounter-completion",
              ...(legacyRpgCompatibilityEnabled() ? ["legacy-v1-compatibility"] : []),
            ],
          },
          games: [
            "tic-tac-toe",
            "american-checkers",
            "othello",
            "tactical-movement-canary",
            "tactical-combat-canary",
            "monster-master-duel",
          ],
        });
      }

      if (request.method === "GET" && url.pathname === "/api/session") {
        const principal = await authenticator.authenticate(authenticationRequest(request, url));
        players.register(principal);
        return json(response, 200, {
          authenticated: true,
          playerId: principal.playerId,
          source: principal.source,
          displayName: principal.displayName ?? null,
          avatarUrl: principal.avatarUrl ?? null,
        });
      }

      if (request.method === "GET" && url.pathname === "/api/players") {
        const principal = await authenticator.authenticate(authenticationRequest(request, url));
        players.register(principal);
        return json(response, 200, { players: players.playersFor(principal.playerId) });
      }

      if (request.method === "GET" && url.pathname === "/api/me/feed") {
        const principal = await authenticator.authenticate(authenticationRequest(request, url));
        players.register(principal);
        return json(response, 200, players.feedFor(principal.playerId));
      }

      if (request.method === "GET" && url.pathname === "/api/me/progression") {
        const principal = await authenticator.authenticate(authenticationRequest(request, url));
        players.register(principal);
        return json(response, 200, players.progressionFor(principal.playerId));
      }

      const viewedPlayerId = request.method === "GET" ? publicPlayerProfileRoute(url.pathname) : null;
      if (viewedPlayerId) {
        const principal = await authenticator.authenticate(authenticationRequest(request, url));
        players.register(principal);
        return json(response, 200, players.publicProfile(viewedPlayerId));
      }

      if (request.method === "POST" && url.pathname === "/api/me/preferences") {
        const principal = await authenticator.authenticate(authenticationRequest(request, url));
        players.register(principal);
        const body = await readJson(request);
        return json(response, 200, players.updateFavorites(principal.playerId, body.favoriteGameIds));
      }

      if (request.method === "POST" && url.pathname === "/api/me/cascade/progression") {
        const principal = await authenticator.authenticate(authenticationRequest(request, url));
        players.register(principal);
        const body = await readJson(request);
        return json(response, 200, players.recordCascadeProgression(principal.playerId, body));
      }

      if (request.method === "POST" && url.pathname === "/api/scores") {
        const principal = await authenticator.authenticate(authenticationRequest(request, url));
        players.register(principal);
        const body = await readJson(request);
        return json(response, 200, players.submitScore(principal.playerId, body));
      }

      if (request.method === "GET" && url.pathname === "/api/leaderboard") {
        const principal = await authenticator.authenticate(authenticationRequest(request, url));
        players.register(principal);
        return json(response, 200, players.leaderboard());
      }

      if (request.method === "POST" && url.pathname === "/auth/logout") {
        return json(response, 200, { authenticated: false });
      }

      const campaignRoute = rpgCampaignRoute(url.pathname);
      if (campaignRoute && request.method === "POST") {
        const principal = await authenticator.authenticate(authenticationRequest(request, url));
        const body = await readJson(request);
        requireRpgProtocol(body);
        requireCampaignPath(body, campaignRoute.campaignId);
        if (campaignRoute.operation === "attach") {
          return json(response, 200, await rpgService.attachCampaign(body, rpgPrincipal(principal)));
        }
        if (campaignRoute.operation === "events") {
          requireServicePrincipal(principal, RPG_RUNTIME_SERVICE_ID, "Campaign runtime events require the RPG GM runtime service principal.");
          return json(response, 200, await rpgService.appendRuntimeEvents(body, rpgPrincipal(principal)));
        }
        const result = await rpgService.handleCommand(body, rpgPrincipal(principal)) as { kind?: string };
        return json(
          response,
          result.kind === "campaign.command_rejected" || result.kind === "gameframe.command_rejected" ? 409 : 200,
          result,
        );
      }

      const encounterRoute = rpgEncounterRoute(url.pathname);
      if (encounterRoute?.operation === "collection" && request.method === "POST") {
        const principal = await authenticator.authenticate(authenticationRequest(request, url));
        requireServicePrincipal(principal, RPG_RUNTIME_SERVICE_ID, "Encounter launch requires the RPG GM runtime service principal.");
        const body = await readJson(request);
        requireRpgProtocol(body);
        return json(response, 200, await encounterMatches.launchEncounter(body, rpgPrincipal(principal)));
      }
      if (encounterRoute?.operation === "complete" && encounterRoute.encounterId && request.method === "POST") {
        const principal = await authenticator.authenticate(authenticationRequest(request, url));
        const body = await readJson(request);
        requireRpgProtocol(body);
        return json(response, 200, await rpgService.completeEncounter(encounterRoute.encounterId, body, rpgPrincipal(principal)));
      }
      if (encounterRoute?.operation === "item" && encounterRoute.encounterId && request.method === "GET") {
        const principal = await authenticator.authenticate(authenticationRequest(request, url));
        return json(response, 200, await encounterMatches.getEncounterForPrincipal(encounterRoute.encounterId, rpgPrincipal(principal)));
      }

      if (request.method === "POST" && url.pathname === "/api/matches") {
        const principal = await authenticator.authenticate(authenticationRequest(request, url));
        const body = await readJson(request);
        const playerIds = Array.isArray(body.playerIds) ? body.playerIds.map((playerId) => String(playerId)) : [];
        requirePrincipalSeat(principal, playerIds);
        const gameId = String(body.gameId ?? "tic-tac-toe");
        const view = await matchService.createMatch(gameId, playerIds);
        players.indexMatch(view);
        return json(response, 201, view);
      }

      const route = matchRoute(url.pathname);
      if (route && request.method === "GET" && !route.action) {
        const principal = await authenticator.authenticate(authenticationRequest(request, url));
        requirePlayerPrincipal(principal);
        rejectIdentityClaim(principal, url.searchParams.get("playerId"));
        const view = await encounterMatches.viewMatchForPrincipal(route.matchId, principal.playerId);
        await encounterMatches.synchronizeMatch(view);
        players.indexMatch(view);
        return json(response, 200, view);
      }

      if (route && request.method === "POST" && route.action) {
        const principal = await authenticator.authenticate(authenticationRequest(request, url));
        requirePlayerPrincipal(principal);
        const body = await readJson(request);
        rejectIdentityClaim(principal, body.playerId);
        const view = await encounterMatches.submitMatchActionForPrincipal({
          matchId: route.matchId,
          playerId: principal.playerId,
          actionId: String(body.actionId ?? ""),
          expectedRevision: Number(body.expectedRevision),
          action: body.action,
        });
        await encounterMatches.synchronizeMatch(view);
        players.indexMatch(view);
        return json(response, 200, view);
      }

      if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) {
        return json(response, 404, { error: "not_found" });
      }

      return await serveStatic(url.pathname, response);
    } catch (caught) {
      const error = caught as ApiError;
      return json(response, errorStatus(error), {
        error: error.code ?? "bad_request",
        message: error.message,
        revision: error.revision,
        retryable: error.retryable,
        gameframeCoordinationRevision: error.gameframeCoordinationRevision,
        presentationSequence: error.presentationSequence,
        linkedNarrativeRevision: error.linkedNarrativeRevision,
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
