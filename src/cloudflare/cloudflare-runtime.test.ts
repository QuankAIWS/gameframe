import assert from "node:assert/strict";
import test from "node:test";
import { TicTacToeMatchObjectRuntime } from "./match-object-runtime.ts";
import type {
  DurableObjectNamespaceLike,
  DurableObjectStubLike,
  DurableStorageLike,
  GameFrameWorkerEnv,
} from "./runtime-contracts.ts";
import { createGameFrameWorker } from "./worker-router.ts";

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
  const worker = createGameFrameWorker({ idGenerator: () => "match-cloudflare-1" });

  const createdResponse = await worker.fetch(new Request("https://games.example/api/matches", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ humanPlayerId: "human" }),
  }), env);
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json() as any;
  assert.equal(created.matchId, "match-cloudflare-1");

  const actionResponse = await worker.fetch(new Request(
    "https://games.example/api/matches/match-cloudflare-1/actions",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        playerId: "human",
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
  const restoredResponse = await worker.fetch(new Request(
    "https://games.example/api/matches/match-cloudflare-1?playerId=human",
  ), env);
  assert.equal(restoredResponse.status, 200);
  const restored = await restoredResponse.json() as any;
  assert.deepEqual(restored.observation.board, advanced.observation.board);
  assert.equal(restored.revision, 2);

  const duplicateResponse = await worker.fetch(new Request(
    "https://games.example/api/matches/match-cloudflare-1/actions",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        playerId: "human",
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
  const worker = createGameFrameWorker({ idGenerator: () => "match-race" });

  await worker.fetch(new Request("https://games.example/api/matches", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ humanPlayerId: "human" }),
  }), env);

  const submit = (actionId: string, cell: number) => worker.fetch(new Request(
    "https://games.example/api/matches/match-race/actions",
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
  const worker = createGameFrameWorker();

  const response = await worker.fetch(new Request(
    "https://games.example/api/matches/match-events/events?playerId=human",
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
    body: JSON.stringify({ matchId: "match-notify", humanPlayerId: "human" }),
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
