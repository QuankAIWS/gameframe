import assert from "node:assert/strict";
import test from "node:test";
import { MatchSocketHub } from "./match-socket-hub.ts";
import type {
  DurableObjectContextLike,
  DurableStorageLike,
  HibernationWebSocketLike,
} from "./runtime-contracts.ts";

class FakeStorage implements DurableStorageLike {
  async get<T>(): Promise<T | undefined> {
    return undefined;
  }

  async put<T>(): Promise<void> {
    // Storage is irrelevant to the socket projection tests.
  }
}

class FakeSocket implements HibernationWebSocketLike {
  readonly messages: unknown[] = [];
  attachment: unknown = null;
  closed: { code?: number; reason?: string } | null = null;

  send(message: string | ArrayBuffer): void {
    const text = typeof message === "string" ? message : new TextDecoder().decode(message);
    this.messages.push(JSON.parse(text));
  }

  close(code?: number, reason?: string): void {
    this.closed = { code, reason };
  }

  serializeAttachment(attachment: unknown): void {
    this.attachment = structuredClone(attachment);
  }

  deserializeAttachment<T>(): T | null {
    return this.attachment === null ? null : structuredClone(this.attachment) as T;
  }
}

class FakeContext implements DurableObjectContextLike {
  readonly storage = new FakeStorage();
  readonly sockets: Array<{ socket: FakeSocket; tags: string[] }> = [];

  acceptWebSocket(socket: HibernationWebSocketLike, tags: string[] = []): void {
    this.sockets.push({ socket: socket as FakeSocket, tags: [...tags] });
  }

  getWebSockets(tag?: string): HibernationWebSocketLike[] {
    return this.sockets
      .filter((entry) => !tag || entry.tags.includes(tag))
      .map((entry) => entry.socket);
  }
}

function view(matchId: string, playerId: string, revision = 2) {
  return {
    matchId,
    revision,
    eventCount: revision,
    observation: {
      gameId: "tic-tac-toe",
      board: ["X", null, null, null, "O", null, null, null, null],
      yourMark: playerId === "human" ? "X" : "O",
      nextPlayerId: "human",
      legalActions: [{ type: "place", cell: 1 }],
      status: { lifecycle: "active", winnerPlayerId: null, draw: false },
    },
  } as const;
}

test("socket hub attaches a player and immediately sends an authoritative view", async () => {
  const context = new FakeContext();
  const socket = new FakeSocket();
  const hub = new MatchSocketHub(context, async (matchId, playerId) => view(matchId, playerId));

  await hub.attach(socket, "match-1", "human");

  assert.deepEqual(context.sockets[0].tags, ["match:match-1", "player:human"]);
  assert.deepEqual(socket.attachment, { matchId: "match-1", playerId: "human" });
  assert.deepEqual(socket.messages[0], {
    type: "match_state",
    reason: "initial",
    view: view("match-1", "human"),
  });
});

test("socket hub broadcasts player-specific views to every match subscriber", async () => {
  const context = new FakeContext();
  const human = new FakeSocket();
  const theo = new FakeSocket();
  const otherMatch = new FakeSocket();
  const hub = new MatchSocketHub(context, async (matchId, playerId) => view(matchId, playerId, 4));

  await hub.attach(human, "match-1", "human");
  await hub.attach(theo, "match-1", "theo");
  await hub.attach(otherMatch, "match-2", "human");
  human.messages.length = 0;
  theo.messages.length = 0;
  otherMatch.messages.length = 0;

  await hub.broadcast("match-1");

  assert.equal(human.messages.length, 1);
  assert.equal(theo.messages.length, 1);
  assert.equal(otherMatch.messages.length, 0);
  assert.equal((human.messages[0] as any).view.observation.yourMark, "X");
  assert.equal((theo.messages[0] as any).view.observation.yourMark, "O");
  assert.equal((human.messages[0] as any).reason, "update");
});

test("socket hub permits refresh but rejects game commands over WebSocket", async () => {
  const context = new FakeContext();
  const socket = new FakeSocket();
  const hub = new MatchSocketHub(context, async (matchId, playerId) => view(matchId, playerId));
  await hub.attach(socket, "match-1", "human");
  socket.messages.length = 0;

  await hub.handleMessage(socket, JSON.stringify({ type: "refresh" }));
  await hub.handleMessage(socket, JSON.stringify({ type: "place", cell: 2 }));
  await hub.handleMessage(socket, "not-json");

  assert.equal((socket.messages[0] as any).reason, "refresh");
  assert.equal((socket.messages[1] as any).code, "unsupported_message");
  assert.equal((socket.messages[2] as any).code, "invalid_json");
});
