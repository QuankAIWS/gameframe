import assert from "node:assert/strict";
import test from "node:test";
import { PlayerEventSocketHub } from "./player-event-socket-hub.ts";
import type {
  DurableObjectContextLike,
  DurableStorageLike,
  HibernationWebSocketLike,
} from "./runtime-contracts.ts";

class MemoryStorage implements DurableStorageLike {
  readonly values = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> { return this.values.get(key) as T | undefined; }
  async put<T>(key: string, value: T): Promise<void> { this.values.set(key, structuredClone(value)); }
}

class TestSocket implements HibernationWebSocketLike {
  attachment: unknown = null;
  readonly sent: unknown[] = [];
  closed = false;

  send(message: string | ArrayBuffer): void {
    const text = typeof message === "string" ? message : new TextDecoder().decode(message);
    this.sent.push(JSON.parse(text));
  }

  close(): void { this.closed = true; }
  serializeAttachment(attachment: unknown): void { this.attachment = structuredClone(attachment); }
  deserializeAttachment<T>(): T | null { return this.attachment as T | null; }
}

class TestContext implements DurableObjectContextLike {
  readonly storage = new MemoryStorage();
  readonly sockets: Array<{ socket: HibernationWebSocketLike; tags: string[] }> = [];

  acceptWebSocket(socket: HibernationWebSocketLike, tags: string[] = []): void {
    this.sockets.push({ socket, tags: [...tags] });
  }

  getWebSockets(tag?: string): HibernationWebSocketLike[] {
    return this.sockets
      .filter((entry) => !tag || entry.tags.includes(tag))
      .map((entry) => entry.socket);
  }
}

test("player event sockets attach once and receive compact invalidations", () => {
  const context = new TestContext();
  const hub = new PlayerEventSocketHub(context);
  const socket = new TestSocket();

  hub.attach(socket, "discord:123");
  assert.equal(hub.owns(socket), true);
  assert.deepEqual(socket.sent, [{ type: "player_events_ready", playerId: "discord:123" }]);

  hub.broadcast(["feed", "feed", "progression"]);
  assert.deepEqual(socket.sent.at(-1), {
    type: "player_event",
    topics: ["feed", "progression"],
  });
});

test("player event sockets accept refresh but reject mutation-like messages", () => {
  const context = new TestContext();
  const hub = new PlayerEventSocketHub(context);
  const socket = new TestSocket();
  hub.attach(socket, "discord:456");

  hub.handleMessage(socket, JSON.stringify({ type: "refresh" }));
  assert.deepEqual(socket.sent.at(-1), { type: "player_events_ready", playerId: "discord:456" });

  hub.handleMessage(socket, JSON.stringify({ type: "accept_invitation", invitationId: "invite-1" }));
  assert.deepEqual(socket.sent.at(-1), {
    type: "protocol_error",
    code: "unsupported_message",
    message: "Only refresh messages are accepted. Player changes use authenticated HTTP commands.",
  });
});
