import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import {
  AuthenticationError,
  DevelopmentHeaderAuthenticator,
  type AuthenticatedPrincipal,
  type RequestAuthenticator,
} from "../auth/request-authenticator.ts";
import {
  DurableRpgCampaignService,
  DurableRpgCampaignServiceError,
  type DurableRpgPrincipal,
} from "../rpg/durable-rpg-campaign-service.ts";
import type { DurableCampaignBootstrap } from "../rpg/sqlite-rpg-campaign-store.ts";
import {
  SqliteRpgEncounterError,
  SqliteRpgEncounterStore,
} from "../rpg/sqlite-rpg-encounter-store.ts";

const MAX_REQUEST_BODY_BYTES = 131_072;

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
};

/**
 * Production-shaped RPG-only HTTP boundary over the durable SQLite services.
 * The existing GameFrame development server remains an explicit memory fixture.
 */
export function createDurableRpgHttpServer(options: DurableRpgHttpServerOptions) {
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
  for (const bootstrap of options.bootstrapCampaigns ?? []) {
    campaigns.bootstrapCampaign(bootstrap);
  }

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (request.method === "GET" && url.pathname === "/api/health") {
        return sendJson(response, 200, {
          status: "ok",
          service: "scribbles-gameframe-rpg",
          protocolVersion: 2,
          storage: "sqlite",
          capabilities: [
            "durable-campaigns",
            "durable-command-outbox",
            "runtime-narrative-linkage",
            "durable-encounters",
            "terminal-outcomes",
          ],
        });
      }

      const campaignRoute = matchCampaignRoute(url.pathname);
      if (campaignRoute && request.method === "POST") {
        const principal = await authenticate(authenticator, request, url);
        const body = await readJson(request);
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
          return sendJson(
            response,
            200,
            await campaigns.handleCommand(body, rpgPrincipal),
          );
        }
        return sendJson(
          response,
          200,
          await campaigns.appendRuntimeEvents(body, rpgPrincipal),
        );
      }

      const encounterRoute = matchEncounterRoute(url.pathname);
      if (encounterRoute?.operation === "collection" && request.method === "POST") {
        const principal = await authenticate(authenticator, request, url);
        const body = await readJson(request);
        return sendJson(
          response,
          200,
          encounters.launch(body, {
            serviceId: principal.playerId,
            createdAt: clock(),
          }),
        );
      }
      if (encounterRoute?.operation === "item" && request.method === "GET") {
        const principal = await authenticate(authenticator, request, url);
        return sendJson(
          response,
          200,
          encounters.get(encounterRoute.encounterId, {
            serviceId: principal.playerId,
          }),
        );
      }
      if (encounterRoute?.operation === "complete" && request.method === "POST") {
        const principal = await authenticate(authenticator, request, url);
        const body = await readJson(request);
        return sendJson(
          response,
          200,
          encounters.complete(encounterRoute.encounterId, body, {
            serviceId: principal.playerId,
            completedAt: clock(),
          }),
        );
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
  });

  let closed = false;
  server.once("close", () => {
    if (closed) return;
    closed = true;
    encounters.close();
    campaigns.close();
  });
  return server;
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

async function authenticate(
  authenticator: RequestAuthenticator,
  request: IncomingMessage,
  url: URL,
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
    new Request(url, { method: request.method, headers }),
  );
}

function toRpgPrincipal(principal: AuthenticatedPrincipal): DurableRpgPrincipal {
  return principal.source === "service"
    ? { kind: "runtime", serviceId: principal.playerId }
    : { kind: "player", playerId: principal.playerId };
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body, "utf8") > MAX_REQUEST_BODY_BYTES) {
      throw new HttpBoundaryError(413, "request-too-large", "Request body is too large.");
    }
  }
  if (!body) return {};
  try {
    const value = JSON.parse(body) as unknown;
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
  if (error instanceof DurableRpgCampaignServiceError) {
    return failure(
      error.status,
      error.code,
      error.message,
      error.retryable,
      error,
    );
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
