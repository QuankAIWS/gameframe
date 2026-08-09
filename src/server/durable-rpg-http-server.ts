import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import {
  AuthenticationError,
  DevelopmentHeaderAuthenticator,
  rejectIdentityClaim,
  requirePlayerPrincipal,
  type AuthenticatedPrincipal,
  type RequestAuthenticator,
} from "../auth/request-authenticator.ts";
import {
  DurableRpgCampaignService,
  DurableRpgCampaignServiceError,
  type DurableRpgPrincipal,
} from "../rpg/durable-rpg-campaign-service.ts";
import {
  MonsterMasterRpgEncounterConfigurationError,
} from "../rpg/monster-master-rpg-encounter-materializer.ts";
import {
  materializeRpgExplorationProjection,
  RpgExplorationMaterializationError,
} from "../rpg/rpg-exploration-materializer.ts";
import {
  RuntimeExplorationTransportError,
  type RuntimeExplorationHttpTransport,
} from "../rpg/runtime-exploration-transport.ts";
import {
  SqliteRpgEncounterMatchCoordinator,
} from "../rpg/sqlite-rpg-encounter-match-coordinator.ts";
import type { DurableCampaignBootstrap } from "../rpg/sqlite-rpg-campaign-store.ts";
import {
  SqliteRpgEncounterError,
  SqliteRpgEncounterStore,
} from "../rpg/sqlite-rpg-encounter-store.ts";
import {
  DurableRpgRealtimeHub,
  type RpgCampaignPosition,
} from "./durable-rpg-realtime-hub.ts";

const MAX_REQUEST_BODY_BYTES = 131_072;
const STAGING_ADMIN_RESET_PATH = "/api/rpg/admin/reset-staging";
const STAGING_ADMIN_RESET_CONFIRMATION = "RESET MONSTER MASTER STAGING";

type ApiError = Error & {
  code?: string;
  status?: number;
  retryable?: boolean;
  gameframeCoordinationRevision?: number;
  presentationSequence?: number;
  linkedNarrativeRevision?: number;
};

export type DurableRpgHttpServerOptions = {
  filePath: string;
  authenticator?: RequestAuthenticator;
  clock?: () => string;
  bootstrapCampaigns?: DurableCampaignBootstrap[];
  explorationTransport?: Pick<RuntimeExplorationHttpTransport, "attach">;
  stagingAdminReset?: {
    campaignId: string;
    requestReset: () => void | Promise<void>;
  };
};

export type DurableRpgHttpServer = Server & {
  closeRealtime(): Promise<void>;
};

/**
 * Production-shaped RPG boundary over the durable SQLite services.
 *
 * HTTP remains the only mutation/recovery authority. The attached WebSocket hub
 * exposes authenticated player projections after durable commits and can be
 * discarded/recreated without changing campaign or tactical truth.
 */
export function createDurableRpgHttpServer(
  options: DurableRpgHttpServerOptions,
): DurableRpgHttpServer {
  if (!options || typeof options.filePath !== "string" || !options.filePath.trim()) {
    throw new TypeError("filePath is required");
  }
  const clock = options.clock ?? (() => new Date().toISOString());
  const authenticator = options.authenticator ?? new DevelopmentHeaderAuthenticator();
  const campaigns = new DurableRpgCampaignService({
    filePath: options.filePath,
    clock,
  });
  const encounters = new SqliteRpgEncounterStore({ filePath: options.filePath });
  const encounterMatches = new SqliteRpgEncounterMatchCoordinator({
    filePath: options.filePath,
    encounters,
    clock,
  });
  for (const bootstrap of options.bootstrapCampaigns ?? []) {
    campaigns.bootstrapCampaign(bootstrap);
  }

  const realtime = new DurableRpgRealtimeHub({
    authenticator,
    campaignPosition: async (campaignId, playerId): Promise<RpgCampaignPosition> => {
      const projection = await campaigns.attachCampaign(
        { protocolVersion: 2, campaignId },
        { kind: "player", playerId },
      );
      return {
        protocolVersion: 2,
        campaignId: projection.campaignId,
        gameframeCoordinationRevision: projection.gameframeCoordinationRevision,
        presentationSequence: projection.presentationSequence,
        linkedNarrativeRevision: projection.linkedNarrativeRevision,
      };
    },
    matchView: (matchId, playerId) => encounterMatches.viewMatchForPlayer(matchId, playerId),
  });

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (request.method === "GET" && url.pathname === "/api/health") {
        return sendJson(response, 200, {
          status: "ok",
          service: "scribbles-gameframe-rpg",
          protocolVersion: 2,
          storage: "sqlite",
          realtime: "websocket-origin",
          capabilities: [
            "durable-campaigns",
            "durable-command-outbox",
            "runtime-narrative-linkage",
            "durable-encounters",
            "terminal-outcomes",
            "websocket-realtime",
            ...(options.explorationTransport ? ["rpg-exploration-materialization"] : []),
          ],
        });
      }

      if (url.pathname === STAGING_ADMIN_RESET_PATH) {
        if (!options.stagingAdminReset) {
          return sendJson(response, 404, {
            error: "not-found",
            message: "Staging administrator controls are not configured.",
            retryable: false,
          });
        }
        if (request.method !== "POST") {
          response.setHeader("allow", "POST");
          return sendJson(response, 405, {
            error: "method-not-allowed",
            message: "The staging reset route accepts POST only.",
            retryable: false,
          });
        }
        const bodyBytes = await readRequestBody(request);
        const principal = await authenticate(authenticator, request, url, bodyBytes);
        if (principal.source !== "discord") {
          throw new AuthenticationError(
            "forbidden",
            "Staging administrator controls require a Discord-authenticated edge principal.",
          );
        }
        const body = parseJsonBody(bodyBytes);
        requireBodyIdentity(
          body.campaignId,
          options.stagingAdminReset.campaignId,
          "campaignId",
        );
        if (body.confirmation !== STAGING_ADMIN_RESET_CONFIRMATION) {
          throw new HttpBoundaryError(
            400,
            "reset-confirmation-required",
            `confirmation must equal ${STAGING_ADMIN_RESET_CONFIRMATION}`,
          );
        }
        await options.stagingAdminReset.requestReset();
        return sendJson(response, 202, {
          status: "resetting",
          campaignId: options.stagingAdminReset.campaignId,
        });
      }

      const explorationRoute = matchExplorationRoute(url.pathname);
      if (explorationRoute) {
        if (request.method !== "POST") {
          response.setHeader("allow", "POST");
          return sendJson(response, 405, {
            error: "method-not-allowed",
            message: "Exploration attachment accepts POST only.",
            retryable: false,
          });
        }
        if (!options.explorationTransport) {
          return sendJson(response, 503, {
            error: "runtime-exploration-unavailable",
            message: "Runtime exploration projection is not configured.",
            retryable: true,
          });
        }
        const bodyBytes = await readRequestBody(request);
        const principal = await authenticate(authenticator, request, url, bodyBytes);
        requirePlayerPrincipal(principal);
        const body = parseJsonBody(bodyBytes);
        normalizeBrowserExplorationAttach(body, explorationRoute.campaignId);
        const projection = await options.explorationTransport.attach({
          campaignId: explorationRoute.campaignId,
          authenticatedPlayerId: principal.playerId,
        });
        return sendJson(response, 200, {
          protocolVersion: 1,
          kind: "campaign.exploration_materialized",
          projection,
          materialization: materializeRpgExplorationProjection(projection),
        });
      }

      const campaignRoute = matchCampaignRoute(url.pathname);
      if (campaignRoute && request.method === "POST") {
        const bodyBytes = await readRequestBody(request);
        const principal = await authenticate(authenticator, request, url, bodyBytes);
        const body = parseJsonBody(bodyBytes);
        requireBodyIdentity(body.campaignId, campaignRoute.campaignId, "campaignId");
        const rpgPrincipal = toRpgPrincipal(principal);
        if (campaignRoute.operation === "attach") {
          return sendJson(
            response,
            200,
            await campaigns.attachCampaign(body, rpgPrincipal),
          );
        }
        if (campaignRoute.operation === "commands") {
          const committed = await campaigns.handleCommand(body, rpgPrincipal);
          realtime.notifyCampaign(campaignRoute.campaignId);
          return sendJson(response, 200, committed);
        }
        const linked = await campaigns.appendRuntimeEvents(body, rpgPrincipal);
        realtime.notifyCampaign(campaignRoute.campaignId);
        return sendJson(response, 200, linked);
      }

      const encounterRoute = matchEncounterRoute(url.pathname);
      if (encounterRoute?.operation === "collection" && request.method === "POST") {
        const bodyBytes = await readRequestBody(request);
        const principal = await authenticate(authenticator, request, url, bodyBytes);
        const body = parseJsonBody(bodyBytes);
        return sendJson(
          response,
          200,
          await encounterMatches.launchEncounter(body, {
            serviceId: principal.playerId,
            createdAt: clock(),
          }),
        );
      }
      if (encounterRoute?.operation === "item" && request.method === "GET") {
        const principal = await authenticate(
          authenticator,
          request,
          url,
          Buffer.alloc(0),
        );
        return sendJson(
          response,
          200,
          await encounterMatches.getEncounter(encounterRoute.encounterId, {
            serviceId: principal.playerId,
          }),
        );
      }
      if (encounterRoute?.operation === "complete" && request.method === "POST") {
        const bodyBytes = await readRequestBody(request);
        const principal = await authenticate(authenticator, request, url, bodyBytes);
        const body = parseJsonBody(bodyBytes);
        return sendJson(
          response,
          200,
          encounters.complete(encounterRoute.encounterId, body, {
            serviceId: principal.playerId,
            completedAt: clock(),
          }),
        );
      }

      const matchRoute = matchRpgMatchRoute(url.pathname);
      if (matchRoute?.operation === "view" && request.method === "GET") {
        const principal = await authenticate(
          authenticator,
          request,
          url,
          Buffer.alloc(0),
        );
        requirePlayerPrincipal(principal);
        rejectIdentityClaim(principal, url.searchParams.get("playerId"));
        return sendJson(
          response,
          200,
          await encounterMatches.viewMatchForPlayer(matchRoute.matchId, principal.playerId),
        );
      }
      if (matchRoute?.operation === "actions" && request.method === "POST") {
        const bodyBytes = await readRequestBody(request);
        const principal = await authenticate(authenticator, request, url, bodyBytes);
        requirePlayerPrincipal(principal);
        const body = parseJsonBody(bodyBytes);
        rejectIdentityClaim(principal, body.playerId);
        const view = await encounterMatches.submitMatchActionForPlayer({
          matchId: matchRoute.matchId,
          playerId: principal.playerId,
          actionId: String(body.actionId ?? ""),
          expectedRevision: Number(body.expectedRevision),
          action: body.action,
        });
        realtime.notifyMatch(matchRoute.matchId);
        return sendJson(response, 200, view);
      }

      return sendJson(response, 404, {
        error: "not-found",
        message: "The requested durable RPG route does not exist.",
        retryable: false,
      });
    } catch (error) {
      const normalized = normalizeError(error);
      return sendJson(response, normalized.status, normalized.body);
    }
  }) as DurableRpgHttpServer;

  server.closeRealtime = () => realtime.closeAll();
  server.on("upgrade", (request, socket, head) => {
    void realtime.handleUpgrade(request, socket, head).catch(() => socket.destroy());
  });

  let closed = false;
  server.once("close", () => {
    if (closed) return;
    closed = true;
    realtime.terminateAll();
    encounterMatches.close();
    encounters.close();
    campaigns.close();
  });
  return server;
}

function matchExplorationRoute(pathname: string): { campaignId: string } | undefined {
  const match = /^\/api\/rpg\/campaigns\/([^/]+)\/exploration\/attach$/.exec(pathname);
  if (!match) return undefined;
  return { campaignId: decodeURIComponent(match[1]!) };
}

function matchCampaignRoute(
  pathname: string,
): { campaignId: string; operation: "attach" | "commands" | "events" } | undefined {
  const match = /^\/api\/rpg\/campaigns\/([^/]+)\/(attach|commands|events)$/.exec(pathname);
  if (!match) return undefined;
  return {
    campaignId: decodeURIComponent(match[1]!),
    operation: match[2] as "attach" | "commands" | "events",
  };
}

function matchEncounterRoute(pathname: string):
  | { operation: "collection" }
  | { operation: "item" | "complete"; encounterId: string }
  | undefined {
  if (pathname === "/api/rpg/encounters") return { operation: "collection" };
  const match = /^\/api\/rpg\/encounters\/([^/]+)(\/complete)?$/.exec(pathname);
  if (!match) return undefined;
  return {
    encounterId: decodeURIComponent(match[1]!),
    operation: match[2] ? "complete" : "item",
  };
}

function matchRpgMatchRoute(pathname: string):
  | { operation: "view" | "actions"; matchId: string }
  | undefined {
  const match = /^\/api\/matches\/([^/]+)(\/actions)?$/.exec(pathname);
  if (!match) return undefined;
  const matchId = decodeURIComponent(match[1]!);
  if (!matchId.startsWith("rpg:")) return undefined;
  return {
    matchId,
    operation: match[2] ? "actions" : "view",
  };
}

function normalizeBrowserExplorationAttach(
  body: Record<string, unknown>,
  campaignId: string,
): void {
  const allowed = new Set(["protocolVersion", "kind", "campaignId"]);
  const unknown = Object.keys(body).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new HttpBoundaryError(
      400,
      "invalid-exploration-request",
      `Exploration request contains unsupported fields: ${unknown.sort().join(", ")}`,
    );
  }
  if (body.protocolVersion !== 1 || body.kind !== "campaign.exploration.attach") {
    throw new HttpBoundaryError(
      400,
      "invalid-exploration-request",
      "Exploration request protocol or kind is not supported.",
    );
  }
  requireBodyIdentity(body.campaignId, campaignId, "campaignId");
}

async function authenticate(
  authenticator: RequestAuthenticator,
  request: IncomingMessage,
  url: URL,
  body: Uint8Array,
): Promise<AuthenticatedPrincipal> {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => headers.append(name, entry));
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }
  return await authenticator.authenticate(
    new Request(url, {
      method: request.method,
      headers,
      ...(body.byteLength > 0 ? { body } : {}),
    }),
  );
}

function toRpgPrincipal(principal: AuthenticatedPrincipal): DurableRpgPrincipal {
  return principal.source === "service"
    ? { kind: "runtime", serviceId: principal.playerId }
    : { kind: "player", playerId: principal.playerId };
}

async function readRequestBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_REQUEST_BODY_BYTES) {
      throw new HttpBoundaryError(413, "request-too-large", "Request body is too large.");
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, totalBytes);
}

function parseJsonBody(body: Uint8Array): Record<string, unknown> {
  if (body.byteLength === 0) return {};
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(body);
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("JSON body must be an object");
    }
    return value as Record<string, unknown>;
  } catch (error) {
    throw new HttpBoundaryError(400, "invalid-json", "Request body is not valid JSON.", error);
  }
}

function requireBodyIdentity(value: unknown, expected: string, label: string): void {
  if (value !== expected) {
    throw new HttpBoundaryError(
      400,
      "route-identity-mismatch",
      `${label} in the request body must match the route.`,
    );
  }
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(value));
}

class HttpBoundaryError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "HttpBoundaryError";
    this.status = status;
    this.code = code;
  }
}

function normalizeError(error: unknown): {
  status: number;
  body: Record<string, unknown>;
} {
  if (error instanceof HttpBoundaryError) {
    return failure(error.status, error.code, error.message, false);
  }
  if (error instanceof AuthenticationError) {
    return failure(
      error.code === "authentication_required" ? 401 : 403,
      error.code,
      error.message,
      false,
    );
  }
  if (error instanceof RuntimeExplorationTransportError) {
    return failure(
      error.status && error.status >= 400 && error.status < 500 ? 502 : 503,
      error.code,
      error.message,
      error.retryable,
    );
  }
  if (error instanceof RpgExplorationMaterializationError) {
    return failure(422, "unsupported-materialization", error.message, false);
  }
  if (error instanceof DurableRpgCampaignServiceError) {
    return failure(
      error.status,
      error.code,
      error.message,
      error.retryable,
      error,
    );
  }
  if (error instanceof MonsterMasterRpgEncounterConfigurationError) {
    return failure(error.status, error.code, error.message, error.retryable);
  }
  if (error instanceof SqliteRpgEncounterError) {
    const status = error.code === "campaign-not-found" || error.code === "encounter-not-found"
      ? 404
      : error.code === "encounter-access-denied" || error.code === "participant-not-authorized"
        ? 403
        : error.code === "invalid-input" || error.code === "invalid-terminal-outcome"
          ? 400
          : error.code === "corrupt-store"
            ? 500
            : 409;
    return failure(
      status,
      error.code,
      error.message,
      error.code === "coordination-revision-conflict"
        || error.code === "runtime-source-revision-conflict",
    );
  }
  const apiError = error as ApiError;
  return failure(
    Number.isInteger(apiError?.status) ? Number(apiError.status) : 500,
    typeof apiError?.code === "string" ? apiError.code : "internal-error",
    "The durable RPG HTTP service could not complete the request.",
    false,
  );
}

function failure(
  status: number,
  code: string,
  message: string,
  retryable: boolean,
  position?: ApiError,
): { status: number; body: Record<string, unknown> } {
  return {
    status,
    body: {
      error: code,
      message,
      retryable,
      ...(Number.isInteger(position?.gameframeCoordinationRevision)
        ? { gameframeCoordinationRevision: position!.gameframeCoordinationRevision }
        : {}),
      ...(Number.isInteger(position?.presentationSequence)
        ? { presentationSequence: position!.presentationSequence }
        : {}),
      ...(Number.isInteger(position?.linkedNarrativeRevision)
        ? { linkedNarrativeRevision: position!.linkedNarrativeRevision }
        : {}),
    },
  };
}
