import { errorResponse, json, readJson } from "./http-utils.ts";
import type { PlayerEventTopic } from "./player-event-socket-hub.ts";
import { PlayerPlatformObjectRuntime } from "./player-platform-object-runtime.ts";
import type { DurableStorageLike } from "./runtime-contracts.ts";

const THEME_KEY = "gameframe:player-theme:v1";
const DEFAULT_THEME_ID = "standard";
const THEME_IDS = new Set(["standard", "cascade-pop", "cyberpunk", "clockwork", "deep-space"]);

export interface PlayerPlatformThemeRuntimeOptions {
  onUpdated?: (topics: readonly PlayerEventTopic[]) => void | Promise<void>;
}

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

function mutationTopics(pathname: string): PlayerEventTopic[] {
  if (pathname === "/player/match") return ["matches"];
  if (pathname === "/player/invitation") return ["invitations"];
  if (pathname.startsWith("/player/progression/")) return ["progression"];
  return [];
}

export class PlayerPlatformThemeRuntime {
  readonly #storage: DurableStorageLike;
  readonly #base: PlayerPlatformObjectRuntime;
  readonly #onUpdated: PlayerPlatformThemeRuntimeOptions["onUpdated"];

  constructor(storage: DurableStorageLike, options: PlayerPlatformThemeRuntimeOptions = {}) {
    this.#storage = storage;
    this.#base = new PlayerPlatformObjectRuntime(storage);
    this.#onUpdated = options.onUpdated;
  }

  async #notify(topics: readonly PlayerEventTopic[]): Promise<void> {
    if (!topics.length || !this.#onUpdated) return;
    try {
      await this.#onUpdated(topics);
    } catch {
      // Player event delivery is a reconstructable projection. A socket failure
      // must never roll back an already committed preference/feed/progression write.
    }
  }

  async #themePreference(): Promise<{ themeId: string; themeConfigured: boolean }> {
    const stored = await this.#storage.get<string>(THEME_KEY);
    const configured = THEME_IDS.has(String(stored));
    return {
      themeId: configured ? String(stored) : DEFAULT_THEME_ID,
      themeConfigured: configured,
    };
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
        return json(200, { ...body, ...await this.#themePreference() });
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

        let preference = await this.#themePreference();
        if (preferences.themeId !== undefined) {
          const nextThemeId = themeId(preferences.themeId);
          await this.#storage.put(THEME_KEY, nextThemeId);
          preference = { themeId: nextThemeId, themeConfigured: true };
        }

        const result = { favoriteGameIds, ...preference };
        await this.#notify(["preferences"]);
        return json(200, result);
      }

      const response = await this.#base.fetch(request);
      if (response.ok && request.method === "POST") {
        await this.#notify(mutationTopics(url.pathname));
      }
      return response;
    } catch (error) {
      return errorResponse(error);
    }
  }
}

export { DEFAULT_THEME_ID, THEME_IDS };
