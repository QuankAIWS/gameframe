import assert from "node:assert/strict";
import test from "node:test";
import { PlayerPlatformThemeRuntime } from "./player-platform-theme-runtime.ts";
import type { DurableStorageLike } from "./runtime-contracts.ts";

class MemoryStorage implements DurableStorageLike {
  readonly values = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> { return this.values.get(key) as T | undefined; }
  async put<T>(key: string, value: T): Promise<void> { this.values.set(key, structuredClone(value)); }
}

function request(path: string, method = "GET", value?: unknown) {
  return new Request(`https://player.internal${path}`, {
    method,
    ...(value === undefined ? {} : {
      headers: { "content-type": "application/json" },
      body: JSON.stringify(value),
    }),
  });
}

async function body(response: Response) {
  return response.json() as Promise<any>;
}

test("player theme defaults to classic and persists without destroying favorites", async () => {
  const runtime = new PlayerPlatformThemeRuntime(new MemoryStorage());
  let feed = await body(await runtime.fetch(request("/player/feed")));
  assert.equal(feed.themeId, "classic");
  assert.deepEqual(feed.favoriteGameIds, []);

  let saved = await body(await runtime.fetch(request("/player/preferences", "POST", {
    favoriteGameIds: ["cascade", "othello"],
  })));
  assert.deepEqual(saved.favoriteGameIds, ["cascade", "othello"]);
  assert.equal(saved.themeId, "classic");

  saved = await body(await runtime.fetch(request("/player/preferences", "POST", {
    themeId: "cascade",
  })));
  assert.deepEqual(saved.favoriteGameIds, ["cascade", "othello"]);
  assert.equal(saved.themeId, "cascade");

  feed = await body(await runtime.fetch(request("/player/feed")));
  assert.deepEqual(feed.favoriteGameIds, ["cascade", "othello"]);
  assert.equal(feed.themeId, "cascade");
});

test("unsupported player themes are rejected and do not replace the saved theme", async () => {
  const runtime = new PlayerPlatformThemeRuntime(new MemoryStorage());
  await runtime.fetch(request("/player/preferences", "POST", { themeId: "cyberpunk" }));
  const rejected = await runtime.fetch(request("/player/preferences", "POST", { themeId: "made-up" }));
  assert.equal(rejected.status, 400);
  const feed = await body(await runtime.fetch(request("/player/feed")));
  assert.equal(feed.themeId, "cyberpunk");
});
