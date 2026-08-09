import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";

import { WebSocket, WebSocketServer, type RawData } from "ws";

import {
  AuthenticationError,
  requirePlayerPrincipal,
  type RequestAuthenticator,
} from "../auth/request-authenticator.ts";

const MAX_CLIENT_MESSAGE_BYTES = 4_096;
const MAX_SOCKETS_PER_PLAYER = 6;
const MIN_CLIENT_REFRESH_INTERVAL_MS = 1_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const SERVICE_RESTART_CODE = 1012;
const NORMAL_CLOSE_CODE = 1000;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

type JsonRecord = Record<string, unknown>;

export type RpgCampaignPosition = {
  protocolVersion: 2;
  campaignId: string;
  gameframeCoordinationRevision: number;
  presentationSequence: number;
  linkedNarrativeRevision: number;
};

export type DurableRpgRealtimeHubOptions = {
  authenticator: RequestAuthenticator;
  campaignPosition(
    campaignId: string,
    playerId: string,
  ): Promise<RpgCampaignPosition>;
  matchView(matchId: string, playerId: string): Promise<JsonRecord>;
};

type CampaignAttachment = {
  kind: "campaign";
  resourceId: string;
  playerId: string;
  alive: boolean;
  lastClientRefreshAt: number;
  queuedReason?: RealtimeReason;
  refreshInFlight?: Promise<void>;
};

type MatchAttachment = {
  kind: "match";
  resourceId: string;
  playerId: string;
  alive: boolean;
  lastClientRefreshAt: number;
  queuedReason?: RealtimeReason;
  refreshInFlight?: Promise<void>;
};

type SocketAttachment = CampaignAttachment | MatchAttachment;
type RealtimeReason = "initial" | "update" | "refresh";

type ParsedRoute =
  | { kind: "campaign"; resourceId: string }
  | { kind: "match"; resourceId: string };

/**
 * Realtime projection transport for the VM-owned RPG authority.
 *
 * WebSockets never become an alternate mutation path. HTTP/SQLite remain
 * authoritative; a socket is only an authenticated, player-scoped projection
 * channel and can always be reconstructed from durable state after reconnect.
 */
export class DurableRpgRealtimeHub {
  readonly #authenticator: RequestAuthenticator;
  readonly #campaignPosition: DurableRpgRealtimeHubOptions["campaignPosition"];
  readonly #matchView: DurableRpgRealtimeHubOptions["matchView"];
  readonly #server = new WebSocketServer({
    noServer: true,
    clientTracking: false,
    maxPayload: MAX_CLIENT_MESSAGE_BYTES,
    perMessageDeflate: false,
  });
  readonly #attachments = new Map<WebSocket, SocketAttachment>();
  readonly #pendingByPlayer = new Map<string, number>();
  readonly #heartbeat: NodeJS.Timeout;
  #closing = false;

  constructor(options: DurableRpgRealtimeHubOptions) {
    if (!options?.authenticator) throw new TypeError("authenticator is required");
    this.#authenticator = options.authenticator;
    this.#campaignPosition = options.campaignPosition;
    this.#matchView = options.matchView;
    this.#heartbeat = setInterval(() => this.#heartbeatSockets(), HEARTBEAT_INTERVAL_MS);
    this.#heartbeat.unref?.();
  }

  async handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): Promise<void> {
    if (this.#closing) {
      return rejectUpgrade(socket, 503, "Service Unavailable");
    }
    const route = parseRealtimeRoute(request.url ?? "/");
    if (!route) {
      return rejectUpgrade(socket, 404, "Not Found");
    }
    if (request.method !== "GET") {
      return rejectUpgrade(socket, 405, "Method Not Allowed");
    }
    if (String(request.headers.upgrade ?? "").toLowerCase() !== "websocket") {
      return rejectUpgrade(socket, 426, "Upgrade Required", {
        Upgrade: "websocket",
      });
    }

    let releaseReservation: (() => void) | undefined;
    try {
      const principal = await authenticateUpgrade(this.#authenticator, request);
      requirePlayerPrincipal(principal);
      const playerId = principal.playerId;
      releaseReservation = this.#reservePlayerConnection(playerId);
      const initial = route.kind === "campaign"
        ? await this.#campaignPosition(route.resourceId, playerId)
        : await this.#matchView(route.resourceId, playerId);

      this.#server.handleUpgrade(request, socket, head, (webSocket) => {
        releaseReservation?.();
        releaseReservation = undefined;
        if (this.#closing) {
          webSocket.close(SERVICE_RESTART_CODE, "RPG service is restarting.");
          return;
        }
        const attachment: SocketAttachment = {
          kind: route.kind,
          resourceId: route.resourceId,
          playerId,
          alive: true,
          lastClientRefreshAt: 0,
        };
        this.#attachments.set(webSocket, attachment);
        webSocket.on("pong", () => {
          const current = this.#attachments.get(webSocket);
          if (current) current.alive = true;
        });
        webSocket.on("message", (data, isBinary) => {
          void this.#handleMessage(webSocket, data, isBinary);
        });
        webSocket.once("close", () => this.#attachments.delete(webSocket));
        webSocket.once("error", () => {
          // close/terminate owns cleanup; transport errors never mutate RPG state.
        });
        if (route.kind === "campaign") {
          sendJson(webSocket, campaignPositionMessage(initial as RpgCampaignPosition, "initial"));
        } else {
          sendJson(webSocket, {
            type: "match_state",
            reason: "initial",
            view: initial,
          });
        }
      });
    } catch (error) {
      releaseReservation?.();
      const status = upgradeErrorStatus(error);
      return rejectUpgrade(socket, status, status === 401
        ? "Unauthorized"
        : status === 403
          ? "Forbidden"
          : status === 404
            ? "Not Found"
            : status === 429
              ? "Too Many Requests"
              : "Internal Server Error");
    }
  }

  notifyCampaign(campaignId: string): void {
    this.#notify("campaign", campaignId);
  }

  notifyMatch(matchId: string): void {
    this.#notify("match", matchId);
  }

  async closeAll(): Promise<void> {
    if (this.#closing && this.#attachments.size === 0) return;
    this.#closing = true;
    clearInterval(this.#heartbeat);
    const sockets = [...this.#attachments.keys()];
    if (sockets.length === 0) return;
    await Promise.all(sockets.map((socket) => new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      socket.once("close", finish);
      try {
        socket.close(SERVICE_RESTART_CODE, "RPG service is restarting.");
      } catch {
        socket.terminate();
        finish();
        return;
      }
      const timer = setTimeout(() => {
        try {
          socket.terminate();
        } finally {
          finish();
        }
      }, 500);
      timer.unref?.();
    })));
    this.#attachments.clear();
    this.#pendingByPlayer.clear();
  }

  terminateAll(): void {
    this.#closing = true;
    clearInterval(this.#heartbeat);
    for (const socket of this.#attachments.keys()) {
      try {
        socket.terminate();
      } catch {
        // Already closed.
      }
    }
    this.#attachments.clear();
    this.#pendingByPlayer.clear();
  }

  #reservePlayerConnection(playerId: string): () => void {
    const active = [...this.#attachments.values()].filter(
      (attachment) => attachment.playerId === playerId,
    ).length;
    const pending = this.#pendingByPlayer.get(playerId) ?? 0;
    if (active + pending >= MAX_SOCKETS_PER_PLAYER) {
      throw Object.assign(new Error("The player already has the maximum number of RPG realtime connections."), {
        status: 429,
        code: "realtime_connection_limit",
      });
    }
    this.#pendingByPlayer.set(playerId, pending + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const remaining = (this.#pendingByPlayer.get(playerId) ?? 1) - 1;
      if (remaining > 0) this.#pendingByPlayer.set(playerId, remaining);
      else this.#pendingByPlayer.delete(playerId);
    };
  }

  #notify(kind: SocketAttachment["kind"], resourceId: string): void {
    for (const [socket, attachment] of this.#attachments) {
      if (attachment.kind !== kind || attachment.resourceId !== resourceId) continue;
      this.#queueRefresh(socket, "update");
    }
  }

  #queueRefresh(socket: WebSocket, reason: RealtimeReason): void {
    const attachment = this.#attachments.get(socket);
    if (!attachment || socket.readyState !== WebSocket.OPEN) return;
    attachment.queuedReason = strongerReason(attachment.queuedReason, reason);
    if (attachment.refreshInFlight) return;
    attachment.refreshInFlight = (async () => {
      while (attachment.queuedReason && socket.readyState === WebSocket.OPEN) {
        const nextReason = attachment.queuedReason;
        attachment.queuedReason = undefined;
        try {
          if (attachment.kind === "campaign") {
            const position = await this.#campaignPosition(
              attachment.resourceId,
              attachment.playerId,
            );
            sendJson(socket, campaignPositionMessage(position, nextReason));
          } else {
            const view = await this.#matchView(attachment.resourceId, attachment.playerId);
            sendJson(socket, {
              type: "match_state",
              reason: nextReason,
              view,
            });
          }
        } catch (error) {
          sendJson(socket, {
            type: "protocol_error",
            code: errorCode(error),
            message: "The authoritative RPG projection is unavailable.",
          });
        }
      }
    })().finally(() => {
      attachment.refreshInFlight = undefined;
      if (attachment.queuedReason && socket.readyState === WebSocket.OPEN) {
        this.#queueRefresh(socket, attachment.queuedReason);
      }
    });
  }

  async #handleMessage(socket: WebSocket, data: RawData, isBinary: boolean): Promise<void> {
    const attachment = this.#attachments.get(socket);
    if (!attachment) return;
    if (isBinary) {
      return sendJson(socket, {
        type: "protocol_error",
        code: "binary_unsupported",
        message: "RPG realtime accepts JSON text messages only.",
      });
    }
    const text = rawDataText(data);
    if (Buffer.byteLength(text, "utf8") > MAX_CLIENT_MESSAGE_BYTES) {
      socket.close(1009, "RPG realtime message is too large.");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return sendJson(socket, {
        type: "protocol_error",
        code: "invalid_json",
        message: "RPG realtime messages must be valid JSON.",
      });
    }
    if ((parsed as { type?: unknown } | null)?.type === "refresh") {
      const now = Date.now();
      if (now - attachment.lastClientRefreshAt < MIN_CLIENT_REFRESH_INTERVAL_MS) {
        return sendJson(socket, {
          type: "protocol_error",
          code: "refresh_rate_limited",
          message: "RPG realtime refresh requests are rate limited.",
        });
      }
      attachment.lastClientRefreshAt = now;
      this.#queueRefresh(socket, "refresh");
      return;
    }
    sendJson(socket, {
      type: "protocol_error",
      code: "unsupported_message",
      message: "Only refresh is accepted. RPG commands use the HTTP authority boundary.",
    });
  }

  #heartbeatSockets(): void {
    for (const [socket, attachment] of this.#attachments) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      if (!attachment.alive) {
        socket.terminate();
        continue;
      }
      attachment.alive = false;
      try {
        socket.ping();
      } catch {
        socket.terminate();
      }
    }
  }
}

function campaignPositionMessage(position: RpgCampaignPosition, reason: RealtimeReason) {
  return {
    type: "campaign_position",
    reason,
    protocolVersion: 2,
    campaignId: position.campaignId,
    gameframeCoordinationRevision: position.gameframeCoordinationRevision,
    presentationSequence: position.presentationSequence,
    linkedNarrativeRevision: position.linkedNarrativeRevision,
  } as const;
}

function parseRealtimeRoute(pathAndQuery: string): ParsedRoute | null {
  let url: URL;
  try {
    url = new URL(pathAndQuery, "http://127.0.0.1");
  } catch {
    return null;
  }
  const campaign = /^\/api\/rpg\/campaigns\/([^/]+)\/realtime$/.exec(url.pathname);
  if (campaign) {
    const resourceId = decodedIdentifier(campaign[1]);
    return resourceId ? { kind: "campaign", resourceId } : null;
  }
  const match = /^\/api\/matches\/([^/]+)\/events$/.exec(url.pathname);
  if (match) {
    const resourceId = decodedIdentifier(match[1]);
    return resourceId?.startsWith("rpg:") ? { kind: "match", resourceId } : null;
  }
  return null;
}

async function authenticateUpgrade(
  authenticator: RequestAuthenticator,
  request: IncomingMessage,
) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const entry of value) headers.append(name, entry);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }
  return await authenticator.authenticate(new Request(
    new URL(request.url ?? "/", "http://127.0.0.1"),
    { method: "GET", headers },
  ));
}

function decodedIdentifier(value: string): string | undefined {
  try {
    const decoded = decodeURIComponent(value);
    return IDENTIFIER_PATTERN.test(decoded) ? decoded : undefined;
  } catch {
    return undefined;
  }
}

function rawDataText(data: RawData): string {
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8");
}

function sendJson(socket: WebSocket, value: unknown): void {
  if (socket.readyState !== WebSocket.OPEN) return;
  try {
    socket.send(JSON.stringify(value));
  } catch {
    try {
      socket.close(1011, "Unable to deliver RPG realtime projection.");
    } catch {
      socket.terminate();
    }
  }
}

function strongerReason(
  current: RealtimeReason | undefined,
  next: RealtimeReason,
): RealtimeReason {
  if (current === "refresh" || next === "refresh") return "refresh";
  if (current === "update" || next === "update") return "update";
  return next;
}

function upgradeErrorStatus(error: unknown): number {
  if (error instanceof AuthenticationError) {
    return error.code === "authentication_required" ? 401 : 403;
  }
  const status = Number((error as { status?: unknown } | null)?.status);
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
}

function errorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && code ? code : "projection_unavailable";
}

function rejectUpgrade(
  socket: Duplex,
  status: number,
  reason: string,
  headers: Record<string, string> = {},
): void {
  if (socket.destroyed) return;
  const lines = [
    `HTTP/1.1 ${status} ${reason}`,
    "Connection: close",
    "Content-Length: 0",
    ...Object.entries(headers).map(([name, value]) => `${name}: ${value}`),
    "",
    "",
  ];
  try {
    socket.end(lines.join("\r\n"));
  } catch {
    socket.destroy();
  }
}

export function normalRealtimeCloseCode(): number {
  return NORMAL_CLOSE_CODE;
}
