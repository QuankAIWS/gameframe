import type {
  DurableObjectContextLike,
  HibernationWebSocketLike,
} from "./runtime-contracts.ts";

export type PlayerEventTopic = "feed" | "progression" | "preferences";

interface PlayerEventSocketAttachment {
  channel: "player-events";
  playerId: string;
}

interface PlayerEventsReadyMessage {
  type: "player_events_ready";
  playerId: string;
}

interface PlayerEventMessage {
  type: "player_event";
  topics: PlayerEventTopic[];
}

interface SocketErrorMessage {
  type: "protocol_error";
  code: string;
  message: string;
}

const PLAYER_EVENT_TAG = "player-events";

function readAttachment(socket: HibernationWebSocketLike): PlayerEventSocketAttachment | null {
  try {
    const attachment = socket.deserializeAttachment?.<PlayerEventSocketAttachment>();
    if (
      !attachment
      || attachment.channel !== "player-events"
      || typeof attachment.playerId !== "string"
      || !attachment.playerId.trim()
    ) {
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
      socket.close?.(1011, "Unable to deliver player event.");
    } catch {
      // The connection is already unusable.
    }
    return false;
  }
}

function normalizedTopics(topics: readonly PlayerEventTopic[]): PlayerEventTopic[] {
  return [...new Set(topics)].filter((topic): topic is PlayerEventTopic => (
    topic === "feed" || topic === "progression" || topic === "preferences"
  ));
}

export class PlayerEventSocketHub {
  readonly #context: DurableObjectContextLike;

  constructor(context: DurableObjectContextLike) {
    this.#context = context;
  }

  owns(socket: HibernationWebSocketLike): boolean {
    return readAttachment(socket) !== null;
  }

  attach(socket: HibernationWebSocketLike, playerId: string): void {
    const normalizedPlayerId = playerId.trim();
    if (!normalizedPlayerId) {
      throw new Error("A player ID is required for player events.");
    }

    socket.serializeAttachment?.({
      channel: "player-events",
      playerId: normalizedPlayerId,
    } satisfies PlayerEventSocketAttachment);
    this.#context.acceptWebSocket(socket, [PLAYER_EVENT_TAG]);
    sendJson(socket, {
      type: "player_events_ready",
      playerId: normalizedPlayerId,
    } satisfies PlayerEventsReadyMessage);
  }

  broadcast(topics: readonly PlayerEventTopic[]): void {
    const nextTopics = normalizedTopics(topics);
    if (!nextTopics.length) return;

    for (const socket of this.#context.getWebSockets(PLAYER_EVENT_TAG)) {
      if (!readAttachment(socket)) continue;
      sendJson(socket, {
        type: "player_event",
        topics: nextTopics,
      } satisfies PlayerEventMessage);
    }
  }

  handleMessage(socket: HibernationWebSocketLike, message: string | ArrayBuffer): void {
    const attachment = readAttachment(socket);
    if (!attachment) {
      sendJson(socket, {
        type: "protocol_error",
        code: "missing_attachment",
        message: "The connection is missing its player-event identity.",
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
      sendJson(socket, {
        type: "player_events_ready",
        playerId: attachment.playerId,
      } satisfies PlayerEventsReadyMessage);
      return;
    }

    sendJson(socket, {
      type: "protocol_error",
      code: "unsupported_message",
      message: "Only refresh messages are accepted. Player changes use authenticated HTTP commands.",
    } satisfies SocketErrorMessage);
  }
}
