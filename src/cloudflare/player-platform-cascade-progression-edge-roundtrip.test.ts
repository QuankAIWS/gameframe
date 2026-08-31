import assert from "node:assert/strict";
import test from "node:test";

import type { RequestAuthenticator } from "../auth/request-authenticator.ts";
import { PlayerPlatformThemeRuntime } from "./player-platform-theme-runtime.ts";
import { createRpgEdgeGameFrameWorker } from "./rpg-edge-worker.ts";
import type { DurableStorageLike, GameFrameWorkerEnv } from "./runtime-contracts.ts";

class MemoryStorage implements DurableStorageLike {
  readonly values = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.values.set(key, structuredClone(value));
  }
}

class PlayerPlatformNamespace {
  readonly #runtimes = new Map<string, PlayerPlatformThemeRuntime>();

  idFromName(name: string) {
    return name as never;
  }

  get(id: unknown) {
    const key = String(id);
    let runtime = this.#runtimes.get(key);
    if (!runtime) {
      runtime = new PlayerPlatformThemeRuntime(new MemoryStorage());
      this.#runtimes.set(key, runtime);
    }
    return {
      fetch: (request: Request) => runtime!.fetch(request),
    } as never;
  }
}

function authenticator(playerId: string): RequestAuthenticator {
  return {
    async authenticate() {
      return {
        playerId,
        source: "discord",
        displayName: "Progression Tester",
      };
    },
  };
}

function environment(matches: PlayerPlatformNamespace): GameFrameWorkerEnv {
  return {
    SESSION_SECRET: "s".repeat(48),
    GAMEFRAME_ADMIN_DISCORD_USER_IDS: "",
    GAMEFRAME_RPG_ORIGIN_URL: "https://rpg-origin-staging.gameframe.cc",
    GAMEFRAME_RPG_PROXY_HMAC_SECRET: "h".repeat(48),
    MATCHES: matches as unknown as GameFrameWorkerEnv["MATCHES"],
  };
}

async function json(response: Response) {
  return response.json() as Promise<any>;
}

test("Cascade progression round-trips through authenticated edge GET and POST routes", async () => {
  const playerId = "discord:edge-progression-player";
  const matches = new PlayerPlatformNamespace();
  const env = environment(matches);
  const worker = createRpgEdgeGameFrameWorker({ authenticator: authenticator(playerId) });

  const initialResponse = await worker.fetch(
    new Request("https://gameframe.cc/api/me/progression"),
    env,
  );
  assert.equal(initialResponse.status, 200);
  const initial = await json(initialResponse);
  assert.equal(initial.playerId, playerId);
  assert.equal(initial.cascade.highestCompletedLevel, 0);

  const writeResponse = await worker.fetch(
    new Request("https://gameframe.cc/api/me/cascade/progression", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        highestCompletedLevel: 12,
        starsByLevel: { "5": 3, "12": 2 },
      }),
    }),
    env,
  );
  assert.equal(writeResponse.status, 200);
  const written = await json(writeResponse);
  assert.equal(written.playerId, playerId);
  assert.equal(written.cascade.highestCompletedLevel, 12);
  assert.equal(written.cascade.starsByLevel["5"], 3);
  assert.equal(written.cascade.starsByLevel["12"], 2);

  const veteranWriteResponse = await worker.fetch(
    new Request("https://gameframe.cc/api/me/cascade/progression", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        highestCompletedLevel: 750,
        starsByLevel: { "750": 3 },
      }),
    }),
    env,
  );
  assert.equal(veteranWriteResponse.status, 200);
  const veteranWritten = await json(veteranWriteResponse);
  assert.equal(veteranWritten.cascade.highestCompletedLevel, 750);
  assert.equal(veteranWritten.cascade.starsByLevel["750"], 3);

  const readBackResponse = await worker.fetch(
    new Request("https://gameframe.cc/api/me/progression"),
    env,
  );
  assert.equal(readBackResponse.status, 200);
  const readBack = await json(readBackResponse);
  assert.equal(readBack.playerId, playerId);
  assert.equal(readBack.cascade.highestCompletedLevel, 750);
  assert.equal(readBack.cascade.starsByLevel["5"], 3);
  assert.equal(readBack.cascade.starsByLevel["12"], 2);
  assert.equal(readBack.cascade.starsByLevel["750"], 3);

  const monotonicResponse = await worker.fetch(
    new Request("https://gameframe.cc/api/me/cascade/progression", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        highestCompletedLevel: 7,
        starsByLevel: { "5": 1, "7": 3 },
      }),
    }),
    env,
  );
  assert.equal(monotonicResponse.status, 200);
  const monotonic = await json(monotonicResponse);
  assert.equal(monotonic.cascade.highestCompletedLevel, 750);
  assert.equal(monotonic.cascade.starsByLevel["5"], 3);
  assert.equal(monotonic.cascade.starsByLevel["7"], 3);
  assert.equal(monotonic.cascade.starsByLevel["12"], 2);
});
