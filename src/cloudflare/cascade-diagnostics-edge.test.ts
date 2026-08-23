import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedPrincipal, RequestAuthenticator } from "../auth/request-authenticator.ts";
import { CascadeDiagnosticsObjectRuntime } from "./cascade-diagnostics-object-runtime.ts";
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
  readonly #diagnostics: CascadeDiagnosticsObjectRuntime;

  constructor(storage = new MemoryStorage()) {
    this.#platform = new PlayerPlatformObjectRuntime(storage);
    this.#diagnostics = new CascadeDiagnosticsObjectRuntime(storage);
  }

  fetch(request: Request): Promise<Response> {
    return new URL(request.url).pathname.startsWith("/diagnostics/")
      ? this.#diagnostics.fetch(request)
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
    CF_VERSION_METADATA: { id: "build-mobile-diagnostics", tag: null, timestamp: null },
    MATCHES: new MemoryNamespace(),
  };
}

function rawIncident() {
  return {
    incidentId: "incident-phone-1",
    at: "2026-08-23T22:00:00.000Z",
    type: "abrupt_renderer_recovery",
    payload: {
      previousLastVfx: { activeParticles: 360, visibleEffectGroups: 28 },
      device: { viewport: { width: 390, height: 844 }, dpr: 3 },
    },
  };
}

test("authenticated players upload bounded Cascade diagnostics and admins export them separately", async () => {
  const environment = env();
  const player = workerFor({ playerId: "discord:2", source: "discord", displayName: "Phone Tester" });
  assert.equal((await player.fetch(new Request("https://gameframe.test/api/session"), environment)).status, 200);

  const upload = await player.fetch(new Request("https://gameframe.test/api/me/cascade/diagnostics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ incidents: [rawIncident()] }),
  }), environment);
  assert.equal(upload.status, 200);
  const uploaded = await upload.json() as any;
  assert.equal(uploaded.accepted, 1);
  assert.equal(uploaded.storedIncidents, 1);

  const admin = workerFor({ playerId: "discord:1", source: "discord", displayName: "Admin" });
  const exported = await admin.fetch(new Request("https://gameframe.test/api/admin/cascade/diagnostics/export"), environment);
  assert.equal(exported.status, 200);
  const value = await exported.json() as any;
  assert.equal(value.totals.incidents, 1);
  assert.equal(value.totals.playersWithIncidents, 1);
  assert.equal(value.players[0].playerId, "discord:2");
  assert.equal(value.players[0].incidents[0].type, "abrupt_renderer_recovery");
  assert.equal(value.players[0].incidents[0].payload.receivedBuildId, "build-mobile-diagnostics");
});

test("Cascade diagnostic export remains admin-only", async () => {
  const environment = env();
  const player = workerFor({ playerId: "discord:2", source: "discord", displayName: "Phone Tester" });
  const response = await player.fetch(new Request("https://gameframe.test/api/admin/cascade/diagnostics/export"), environment);
  assert.equal(response.status, 403);
  const value = await response.json() as any;
  assert.equal(value.error, "forbidden");
});
