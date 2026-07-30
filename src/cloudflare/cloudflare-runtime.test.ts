import assert from "node:assert/strict";
import test from "node:test";
import { DevelopmentHeaderAuthenticator } from "../auth/request-authenticator.ts";
import { TicTacToeMatchObjectRuntime } from "./match-object-runtime.ts";
import type {
  DurableObjectNamespaceLike,
  DurableObjectStubLike,
  DurableStorageLike,
  GameFrameWorkerEnv,
} from "./runtime-contracts.ts";
import { createGameFrameWorker } from "./worker-router.ts";

function authenticatedRequest(url: string, playerId: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("x-gameframe-player-id", playerId);
  return new Request(url, { ...init, headers });
}

function createTestWorker(options: { idGenerator?: () => string } = {}) {
  return createGameFrameWorker({
    ...options,
    authenticator: new DevelopmentHeaderAuthenticator(),
  });
}

class FakeStorage implements DurableStorageLike {
  readonly values = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    const value = this.values.get(key);
    return value === undefined ? undefined : structuredClone(value) as T;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.values.set(key, structuredClone(value));
  }
}

class FakeMatchNamespace implements DurableObjectNamespaceLike {
  readonly #storage = new Map<string, FakeStorage>();
  readonly #instances = new Map<string, TicTacToeMatchObjectRuntime>();
  #idSequence = 0;

  idFromName(name: string): unknown {
    return name;
  }

  get(id: unknown): DurableObjectStubLike {
    const name = String(id);
    return {
      fetch: (request) => this.#instance(name).fetch(request),
    };
  }

  evict(name: string): void {
    this.#instances.delete(name);
  }

  #instance(name: string): TicTacToeMatchObjectRuntime {
    let instance = this.#instances.get(name);
    if (!instance) {
      let storage = this.#storage.get(name);
      if (!storage) {
        storage = new FakeStorage();
        this.#storage.set(name, storage);
      }
      instance = new TicTacToeMatchObjectRuntime(storage, () => `object-action-${++this.#idSequence}`);
      this.#instances.set(name, instance);
    }
    return instance;
  }
}

function createEnvironment(namespace: DurableObjectNamespaceLike = new FakeMatchNamespace()): GameFrameWorkerEnv {
  return {
    MATCHES: namespace,
    ASSETS: { fetch: async () => new Response("asset", { status: 200 }) },
  };
}

test("Cloudflare router creates, advances, and restores a durable match", async () => {
  const namespace = new FakeMatchNamespace();
  const env = createEnvironment(namespace);
  const worker = createTestWorker({ idGenerator: () => "match-cloudflare-1" });

  const createdResponse = await worker.fetch(authenticatedRequest("https://games.example/api/matches", "human", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerIds: ["human", "theo"] }),
  }), env);
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json() as any;
  assert.equal(created.matchId, "match-cloudflare-1");

  const actionResponse = await worker.fetch(authenticatedRequest(
    "https://games.example/api/matches/match-cloudflare-1/actions", "human",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actionId: "human-action-1",
        expectedRevision: 0,
        action: { type: "place", cell: 0 },
      }),
    },
  ), env);
  assert.equal(actionResponse.status, 200);
  const advanced = await actionResponse.json() as any;
  assert.equal(advanced.revision, 2);
  assert.equal(advanced.observation.board[0], "X");
  assert.equal(advanced.observation.board[4], "O");

  namespace.evict("match-cloudflare-1");
  const restoredResponse = await worker.fetch(authenticatedRequest(
    "https://games.example/api/matches/match-cloudflare-1", "human",
  ), env);
  assert.equal(restoredResponse.status, 200);
  const restored = await restoredResponse.json() as any;
  assert.deepEqual(restored.observation.board, advanced.observation.board);
  assert.equal(restored.revision, 2);

  const duplicateResponse = await worker.fetch(authenticatedRequest(
    "https://games.example/api/matches/match-cloudflare-1/actions", "human",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actionId: "human-action-1",
        expectedRevision: 0,
        action: { type: "place", cell: 0 },
      }),
    },
  ), env);
  assert.equal(duplicateResponse.status, 200);
  const duplicate = await duplicateResponse.json() as any;
  assert.equal(duplicate.revision, 2);
  assert.deepEqual(duplicate.observation.board, advanced.observation.board);
});

test("Durable Object serialization rejects one of two competing revision-zero moves", async () => {
  const namespace = new FakeMatchNamespace();
  const env = createEnvironment(namespace);
  const worker = createTestWorker({ idGenerator: () => "match-race" });

  await worker.fetch(authenticatedRequest("https://games.example/api/matches", "human", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerIds: ["human", "theo"] }),
  }), env);

  const submit = (actionId: string, cell: number) => worker.fetch(authenticatedRequest(
    "https://games.example/api/matches/match-race/actions", "human",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        playerId: "human",
        actionId,
        expectedRevision: 0,
        action: { type: "place", cell },
      }),
    },
  ), env);

  const responses = await Promise.all([submit("race-1", 0), submit("race-2", 1)]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
});

test("Cloudflare router forwards WebSocket upgrade requests to the match object", async () => {
  let captured: Request | null = null;
  const namespace: DurableObjectNamespaceLike = {
    idFromName: (name) => name,
    get: () => ({
      fetch: async (request) => {
        captured = request;
        return new Response(JSON.stringify({ forwarded: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    }),
  };
  const worker = createTestWorker();

  const response = await worker.fetch(authenticatedRequest(
    "https://games.example/api/matches/match-events/events", "human",
    { headers: { Upgrade: "websocket", "Sec-WebSocket-Protocol": "gameframe-v1" } },
  ), createEnvironment(namespace));

  assert.equal(response.status, 200);
  assert.ok(captured);
  const forwarded = captured as Request;
  assert.equal(new URL(forwarded.url).pathname, "/events");
  assert.equal(new URL(forwarded.url).searchParams.get("matchId"), "match-events");
  assert.equal(new URL(forwarded.url).searchParams.get("playerId"), "human");
  assert.equal(forwarded.headers.get("Upgrade"), "websocket");
  assert.equal(forwarded.headers.get("Sec-WebSocket-Protocol"), "gameframe-v1");
});

test("match runtime projection failures do not roll back committed actions", async () => {
  const storage = new FakeStorage();
  let notifications = 0;
  const runtime = new TicTacToeMatchObjectRuntime(
    storage,
    (() => {
      let sequence = 0;
      return () => `runtime-action-${++sequence}`;
    })(),
    {
      onMatchUpdated: async () => {
        notifications += 1;
        throw new Error("socket projection unavailable");
      },
    },
  );

  const initialized = await runtime.fetch(new Request("https://match.internal/initialize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ matchId: "match-notify", playerIds: ["human", "theo"] }),
  }));
  assert.equal(initialized.status, 201);

  const advanced = await runtime.fetch(new Request("https://match.internal/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      matchId: "match-notify",
      playerId: "human",
      actionId: "human-1",
      expectedRevision: 0,
      action: { type: "place", cell: 0 },
    }),
  }));

  assert.equal(advanced.status, 200);
  assert.equal((await advanced.json() as any).revision, 2);
  assert.equal(notifications, 2);
});

test("Cloudflare runtime preserves two-human turn ownership without auto-playing Theo", async () => {
  const env = createEnvironment();
  const worker = createTestWorker({ idGenerator: () => "match-two-human" });

  const created = await worker.fetch(authenticatedRequest("https://games.example/api/matches", "alice", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerIds: ["alice", "bob"] }),
  }), env);
  assert.equal(created.status, 201);

  const afterAlice = await worker.fetch(authenticatedRequest(
    "https://games.example/api/matches/match-two-human/actions", "alice",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actionId: "alice-cloudflare-1",
        expectedRevision: 0,
        action: { type: "place", cell: 0 },
      }),
    },
  ), env);

  assert.equal(afterAlice.status, 200);
  const aliceView = await afterAlice.json() as any;
  assert.equal(aliceView.revision, 1);
  assert.equal(aliceView.observation.nextPlayerId, "bob");
  assert.deepEqual(aliceView.playerIds, ["alice", "bob"]);

  const bobResponse = await worker.fetch(authenticatedRequest(
    "https://games.example/api/matches/match-two-human", "bob",
  ), env);
  const bobView = await bobResponse.json() as any;
  assert.equal(bobView.observation.yourMark, "O");
  assert.ok(bobView.observation.legalActions.some((action: any) => action.cell === 4));
});

test("Cloudflare public APIs fail closed without a configured identity verifier", async () => {
  const worker = createGameFrameWorker({ idGenerator: () => "match-closed" });
  const response = await worker.fetch(new Request("https://games.example/api/matches", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerIds: ["alice", "theo"] }),
  }), createEnvironment());

  assert.equal(response.status, 401);
  assert.equal((await response.json() as any).error, "authentication_required");
});

test("Cloudflare boundary rejects seat and action identity spoofing", async () => {
  const env = createEnvironment();
  const worker = createTestWorker({ idGenerator: () => "match-authz" });

  const forbiddenCreate = await worker.fetch(authenticatedRequest(
    "https://games.example/api/matches", "mallory", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerIds: ["alice", "theo"] }),
    },
  ), env);
  assert.equal(forbiddenCreate.status, 403);

  const created = await worker.fetch(authenticatedRequest(
    "https://games.example/api/matches", "alice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerIds: ["alice", "bob"] }),
    },
  ), env);
  assert.equal(created.status, 201);

  const spoofedAction = await worker.fetch(authenticatedRequest(
    "https://games.example/api/matches/match-authz/actions", "alice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        playerId: "bob",
        actionId: "spoof-1",
        expectedRevision: 0,
        action: { type: "place", cell: 0 },
      }),
    },
  ), env);
  assert.equal(spoofedAction.status, 403);
  assert.equal((await spoofedAction.json() as any).error, "identity_mismatch");

  const unchanged = await worker.fetch(authenticatedRequest(
    "https://games.example/api/matches/match-authz", "alice",
  ), env).then((response) => response.json() as Promise<any>);
  assert.equal(unchanged.revision, 0);
});

test("Cloudflare boundary accepts a signed Discord-style session cookie", async () => {
  const { SignedSessionCodec } = await import("../auth/signed-session.ts");
  const secret = "0123456789abcdef0123456789abcdef";
  const codec = new SignedSessionCodec(secret);
  const token = await codec.issue({ playerId: "discord:123", source: "discord" });
  const env = { ...createEnvironment(), SESSION_SECRET: secret };
  const worker = createGameFrameWorker({ idGenerator: () => "match-cookie" });

  const created = await worker.fetch(new Request("https://games.example/api/matches", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `gameframe_session=${token}`,
    },
    body: JSON.stringify({ playerIds: ["discord:123", "theo"] }),
  }), env);

  assert.equal(created.status, 201);
  assert.equal((await created.json() as any).matchId, "match-cookie");

  const [payload, signature] = token.split(".");
  const tamperedPayload = `${payload[0] === "A" ? "B" : "A"}${payload.slice(1)}`;
  const tampered = await worker.fetch(new Request("https://games.example/api/matches/match-cookie", {
    headers: { cookie: `gameframe_session=${tamperedPayload}.${signature}` },
  }), env);
  assert.equal(tampered.status, 401);
});
