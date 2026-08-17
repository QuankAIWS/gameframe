import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedPrincipal, RequestAuthenticator } from "../auth/request-authenticator.ts";
import { CascadeTelemetryObjectRuntime } from "./cascade-telemetry-object-runtime.ts";
import { PlayerPlatformObjectRuntime } from "./player-platform-object-runtime.ts";
import { createRpgEdgeGameFrameWorker } from "./rpg-edge-worker.ts";
import type {
  DurableObjectNamespaceLike,
  DurableObjectStubLike,
  DurableStorageLike,
  GameFrameWorkerEnv,
} from "./runtime-contracts.ts";

class MemoryStorage implements DurableStorageLike {
  readonly values = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> { return this.values.get(key) as T | undefined; }
  async put<T>(key: string, value: T): Promise<void> { this.values.set(key, structuredClone(value)); }
}

class CompositePlayerStub implements DurableObjectStubLike {
  readonly #platform: PlayerPlatformObjectRuntime;
  readonly #telemetry: CascadeTelemetryObjectRuntime;

  constructor(storage = new MemoryStorage()) {
    this.#platform = new PlayerPlatformObjectRuntime(storage);
    this.#telemetry = new CascadeTelemetryObjectRuntime(storage);
  }

  fetch(request: Request): Promise<Response> {
    return new URL(request.url).pathname.startsWith("/telemetry/")
      ? this.#telemetry.fetch(request)
      : this.#platform.fetch(request);
  }
}

class MemoryNamespace implements DurableObjectNamespaceLike {
  readonly #stubs = new Map<string, CompositePlayerStub>();
  idFromName(name: string): unknown { return name; }
  get(id: unknown): DurableObjectStubLike {
    const name = String(id);
    let stub = this.#stubs.get(name);
    if (!stub) {
      stub = new CompositePlayerStub();
      this.#stubs.set(name, stub);
    }
    return stub;
  }
}

class FixedAuthenticator implements RequestAuthenticator {
  readonly #principal: AuthenticatedPrincipal;
  constructor(principal: AuthenticatedPrincipal) { this.#principal = principal; }
  async authenticate(): Promise<AuthenticatedPrincipal> { return this.#principal; }
}

function workerFor(principal: AuthenticatedPrincipal) {
  return createRpgEdgeGameFrameWorker({ authenticator: new FixedAuthenticator(principal) });
}

function env(): GameFrameWorkerEnv {
  return {
    GAMEFRAME_ADMIN_DISCORD_USER_IDS: "1",
    MATCHES: new MemoryNamespace(),
  };
}

function rawEvent(id: string) {
  return {
    eventId: id,
    at: "2026-08-12T16:00:00.000Z",
    type: "level_start",
    sessionId: "session-parent",
    attemptId: "attempt-parent",
    payload: { mode: "normal", level: 7, score: 0, movesRemaining: 20 },
  };
}

test("authenticated players can upload only to their own Cascade telemetry custody and admins can export known players", async () => {
  const environment = env();
  const parent = workerFor({ playerId: "discord:2", source: "discord", displayName: "Mom" });
  const session = await parent.fetch(new Request("https://gameframe.test/api/session"), environment);
  assert.equal(session.status, 200);

  const upload = await parent.fetch(new Request("https://gameframe.test/api/me/cascade/telemetry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ events: [rawEvent("parent-e1")] }),
  }), environment);
  assert.equal(upload.status, 200);

  const admin = workerFor({ playerId: "discord:1", source: "discord", displayName: "Admin" });
  const exported = await admin.fetch(new Request("https://gameframe.test/api/admin/cascade/telemetry/export"), environment);
  assert.equal(exported.status, 200);
  const value = await exported.json() as any;
  assert.equal(value.totals.players, 1);
  const parentRow = value.players.find((player: any) => player.playerId === "discord:2");
  assert.equal(parentRow.displayName, "Mom");
  assert.equal(parentRow.events.length, 1);
  assert.equal(parentRow.events[0].eventId, "parent-e1");
  assert.equal(parentRow.summary.highestLevelStarted, 7);
});

test("Cascade telemetry export fails closed for non-admin Discord users", async () => {
  const environment = env();
  const player = workerFor({ playerId: "discord:2", source: "discord", displayName: "Mom" });
  const response = await player.fetch(new Request("https://gameframe.test/api/admin/cascade/telemetry/export"), environment);
  assert.equal(response.status, 403);
  const value = await response.json() as any;
  assert.equal(value.error, "forbidden");
});