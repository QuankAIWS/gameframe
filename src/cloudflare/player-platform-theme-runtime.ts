import { errorResponse, json, readJson } from "./http-utils.ts";
import { PlayerPlatformObjectRuntime } from "./player-platform-object-runtime.ts";
import type { DurableStorageLike } from "./runtime-contracts.ts";

const THEME_KEY = "gameframe:player-theme:v1";
const DEFAULT_THEME_ID = "standard";
const THEME_IDS = new Set(["standard", "cascade-pop", "cyberpunk", "clockwork", "deep-space"]);

function themeId(value: unknown): string {
  const normalized = String(value ?? DEFAULT_THEME_ID).trim().toLowerCase();
  if (!THEME_IDS.has(normalized)) {
    throw Object.assign(new Error("GameFrame theme is not supported."), {
      code: "player_platform_invalid",
      status: 400,
    });
  }
  return normalized;
}

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

export class PlayerPlatformThemeRuntime {
  readonly #storage: DurableStorageLike;
  readonly #base: PlayerPlatformObjectRuntime;

  constructor(storage: DurableStorageLike) {
    this.#storage = storage;
    this.#base = new PlayerPlatformObjectRuntime(storage);
  }

  async #storedTheme(): Promise<string> {
    const stored = await this.#storage.get<string>(THEME_KEY);
    return THEME_IDS.has(String(stored)) ? String(stored) : DEFAULT_THEME_ID;
  }

  async #baseFeed(): Promise<{ response: Response; body: Record<string, unknown> }> {
    const response = await this.#base.fetch(new Request("https://player.internal/player/feed"));
    return { response, body: await responseBody(response) };
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/player/feed") {
        const response = await this.#base.fetch(request);
        const body = await responseBody(response);
        if (!response.ok) return json(response.status, body);
        return json(200, { ...body, themeId: await this.#storedTheme() });
      }

      if (request.method === "POST" && url.pathname === "/player/preferences") {
        const preferences = await readJson(request);
        let favoriteGameIds: unknown[] | undefined;

        if (preferences.favoriteGameIds !== undefined) {
          const response = await this.#base.fetch(new Request("https://player.internal/player/preferences", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ favoriteGameIds: preferences.favoriteGameIds }),
          }));
          const body = await responseBody(response);
          if (!response.ok) return json(response.status, body);
          favoriteGameIds = Array.isArray(body.favoriteGameIds) ? body.favoriteGameIds : [];
        } else {
          const feed = await this.#baseFeed();
          if (!feed.response.ok) return json(feed.response.status, feed.body);
          favoriteGameIds = Array.isArray(feed.body.favoriteGameIds) ? feed.body.favoriteGameIds : [];
        }

        const nextThemeId = preferences.themeId === undefined
          ? await this.#storedTheme()
          : themeId(preferences.themeId);
        if (preferences.themeId !== undefined) await this.#storage.put(THEME_KEY, nextThemeId);

        return json(200, { favoriteGameIds, themeId: nextThemeId });
      }

      return this.#base.fetch(request);
    } catch (error) {
      return errorResponse(error);
    }
  }
}

export { DEFAULT_THEME_ID, THEME_IDS };
