import assert from "node:assert/strict";
import test from "node:test";

import { DevelopmentHeaderAuthenticator } from "../auth/request-authenticator.ts";
import { GameFrameMatchObjectRuntime } from "./match-object-runtime.ts";
import type {
  DurableObjectNamespaceLike,
  DurableObjectStubLike,
  DurableStorageLike,
  GameFrameWorkerEnv,
} from "./runtime-contracts.ts";
import { createGameFrameWorker } from "./worker-router.ts";

class MemoryStorage implements DurableStorageLike {
  readonly values = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    const value = this.values.get(key);
    return value === undefined ? undefined : structuredClone(value) as T;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.values.set(key, structuredClone(value));
  }
}

class MatchNamespace implements DurableObjectNamespaceLike {
  readonly #storage = new Map<string, MemoryStorage>();
  readonly #runtime = new Map<string, GameFrameMatchObjectRuntime>();

  idFromName(name: string): unknown {
    return name;
  }

  get(id: unknown): DurableObjectStubLike {
    const name = String(id);
    return { fetch: (request) => this.#instance(name).fetch(request) };
  }

  #instance(name: string): GameFrameMatchObjectRuntime {
    let runtime = this.#runtime.get(name);
    if (runtime) return runtime;
    let storage = this.#storage.get(name);
    if (!storage) {
      storage = new MemoryStorage();
      this.#storage.set(name, storage);
    }
    runtime = new GameFrameMatchObjectRuntime(storage);
    this.#runtime.set(name, runtime);
    return runtime;
  }
}

function request(url: string, playerId: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-gameframe-player-id", playerId);
  return new Request(url, { ...init, headers });
}

test("public match resign route terminates the authoritative match as a loss for the caller", async () => {
  const env: GameFrameWorkerEnv = { MATCHES: new MatchNamespace() };
  const worker = createGameFrameWorker({
    idGenerator: () => "resign-route-match",
    authenticator: new DevelopmentHeaderAuthenticator(),
  });

  const created = await worker.fetch(request("https://games.example/api/matches", "alice", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      gameId: "tic-tac-toe",
      playerIds: ["alice", "bob"],
    }),
  }), env);
  assert.equal(created.status, 201);

  const resigned = await worker.fetch(request(
    "https://games.example/api/matches/resign-route-match/resign",
    "alice",
    { method: "POST" },
  ), env);
  assert.equal(resigned.status, 200);
  const resignedView = await resigned.json() as any;
  assert.equal(resignedView.observation.status.lifecycle, "completed");
  assert.equal(resignedView.observation.status.winnerPlayerId, "bob");
  assert.equal(resignedView.observation.status.resignedPlayerId, "alice");

  const viewed = await worker.fetch(request(
    "https://games.example/api/matches/resign-route-match",
    "bob",
  ), env);
  assert.equal(viewed.status, 200);
  const viewedBody = await viewed.json() as any;
  assert.equal(viewedBody.observation.status.lifecycle, "completed");
  assert.equal(viewedBody.observation.status.winnerPlayerId, "bob");

  const action = await worker.fetch(request(
    "https://games.example/api/matches/resign-route-match/actions",
    "bob",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actionId: "after-resign",
        expectedRevision: 0,
        action: { type: "place", cell: 4 },
      }),
    },
  ), env);
  assert.equal(action.status, 409);
  assert.equal((await action.json() as any).error, "match_completed");
});
