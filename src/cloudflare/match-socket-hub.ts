import type { PublicMatchView } from "../server/tic-tac-toe-match-service.ts";
import type {
  DurableObjectContextLike,
  HibernationWebSocketLike,
} from "./runtime-contracts.ts";

interface MatchSocketAttachment {
  matchId: string;
  playerId: string;
}

interface MatchStateMessage {
  type: "match_state";
  reason: "initial" | "update" | "refresh";
  view: PublicMatchView;
}

interface SocketErrorMessage {
  type: "protocol_error";
  code: string;
  message: string;
}

export type MatchViewResolver = (
  matchId: string,
  playerId: string,
) => Promise<PublicMatchView>;

function matchTag(matchId: string): string {
  return `match:${matchId}`;
}

function readAttachment(socket: HibernationWebSocketLike): MatchSocketAttachment | null {
  try {
    const attachment = socket.deserializeAttachment?.<MatchSocketAttachment>();
    if (!attachment || typeof attachment.matchId !== "string" || typeof attachment.playerId !== "string") {
      return null;
    }
    return attachment;
  } catch {
    return null;
  }
}

function sendJson(socket: HibernationWebSocketLike, value: unknown): boolean {
  try {
    socket.send(JSON.stringify(value));
    return true;
  } catch {
    try {
      socket.close?.(1011, "Unable to deliver match state.");
    } catch {
      // The connection is already unusable.
    }
    return false;
  }
}

export class MatchSocketHub {
  readonly #context: DurableObjectContextLike;
  readonly #resolveView: MatchViewResolver;

  constructor(context: DurableObjectContextLike, resolveView: MatchViewResolver) {
    this.#context = context;
    this.#resolveView = resolveView;
  }

  async attach(
    socket: HibernationWebSocketLike,
    matchId: string,
    playerId: string,
  ): Promise<void> {
    if (!matchId.trim() || !playerId.trim()) {
      throw new Error("A match ID and player ID are required for real-time updates.");
    }

    const attachment: MatchSocketAttachment = { matchId, playerId };
    const view = await this.#resolveView(matchId, playerId);
    socket.serializeAttachment?.(attachment);
    this.#context.acceptWebSocket(socket, [matchTag(matchId), `player:${playerId}`]);
    sendJson(socket, {
      type: "match_state",
      reason: "initial",
      view,
    } satisfies MatchStateMessage);
  }

  async broadcast(matchId: string): Promise<void> {
    const sockets = this.#context.getWebSockets(matchTag(matchId));
    await Promise.all(sockets.map(async (socket) => {
      const attachment = readAttachment(socket);
      if (!attachment || attachment.matchId !== matchId) {
        return;
      }
      await this.#sendState(socket, attachment, "update");
    }));
  }

  async handleMessage(
    socket: HibernationWebSocketLike,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const attachment = readAttachment(socket);
    if (!attachment) {
      sendJson(socket, {
        type: "protocol_error",
        code: "missing_attachment",
        message: "The connection is missing its match identity.",
      } satisfies SocketErrorMessage);
      return;
    }

    const text = typeof message === "string"
      ? message
      : new TextDecoder().decode(message);

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      sendJson(socket, {
        type: "protocol_error",
        code: "invalid_json",
        message: "WebSocket messages must be valid JSON.",
      } satisfies SocketErrorMessage);
      return;
    }

    if ((parsed as { type?: unknown } | null)?.type === "refresh") {
      await this.#sendState(socket, attachment, "refresh");
      return;
    }

    sendJson(socket, {
      type: "protocol_error",
      code: "unsupported_message",
      message: "Only refresh messages are accepted. Game actions use the HTTP command boundary.",
    } satisfies SocketErrorMessage);
  }

  async #sendState(
    socket: HibernationWebSocketLike,
    attachment: MatchSocketAttachment,
    reason: MatchStateMessage["reason"],
  ): Promise<void> {
    try {
      const view = await this.#resolveView(attachment.matchId, attachment.playerId);
      sendJson(socket, {
        type: "match_state",
        reason,
        view,
      } satisfies MatchStateMessage);
    } catch (caught) {
      const error = caught as Error & { code?: string };
      sendJson(socket, {
        type: "protocol_error",
        code: error.code ?? "view_unavailable",
        message: error.message,
      } satisfies SocketErrorMessage);
    }
  }
}
