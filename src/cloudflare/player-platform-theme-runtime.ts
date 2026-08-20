import { errorResponse, json, readJson } from "./http-utils.ts";
import type { PlayerEventTopic } from "./player-event-socket-hub.ts";
import { PlayerPlatformObjectRuntime } from "./player-platform-object-runtime.ts";
import type { DurableStorageLike } from "./runtime-contracts.ts";

const THEME_KEY = "gameframe:player-theme:v1";
const MATCH_PROJECTION_PREFIX = "gameframe:player-match-projection:v1:";
const VOIDED_MATCH_PREFIX = "gameframe:voided-match:v1:";
const DEFAULT_THEME_ID = "standard";
const THEME_IDS = new Set(["standard", "cascade-pop", "cyberpunk", "clockwork", "deep-space"]);

type ProjectedLifecycle = "waiting" | "active" | "completed";

interface MatchProjectionMarker {
  version: 1;
  revision: number;
  lifecycle: ProjectedLifecycle;
}

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
  if (pathname === "/player/admin/match/void") return ["matches", "progression"];
  if (pathname === "/player/invitation") return ["invitations"];
  if (pathname.startsWith("/player/progression/")) return ["progression"];
  return [];
}

function matchIdFrom(body: Record<string, unknown>): string | null {
  const matchId = String(body.matchId ?? "").trim();
  return matchId && matchId.length <= 160 ? matchId : null;
}

function voidedMatchKey(matchId: string): string {
  return `${VOIDED_MATCH_PREFIX}${matchId}`;
}

function projectionKey(matchId: string): string {
  return `${MATCH_PROJECTION_PREFIX}${matchId}`;
}

function projectedLifecycle(body: Record<string, unknown>): ProjectedLifecycle {
  const status = body.status && typeof body.status === "object" && !Array.isArray(body.status)
    ? body.status as Record<string, unknown>
    : {};
  if (status.lifecycle === "completed") return "completed";
  if (status.lifecycle === "waiting") return "waiting";
  return "active";
}

function lifecycleRank(lifecycle: ProjectedLifecycle): number {
  if (lifecycle === "completed") return 2;
  if (lifecycle === "active") return 1;
  return 0;
}

function projectionFrom(body: Record<string, unknown>): MatchProjectionMarker {
  return {
    version: 1,
    revision: Math.max(0, Math.floor(Number(body.revision) || 0)),
    lifecycle: projectedLifecycle(body),
  };
}

function projectionIsStale(previous: MatchProjectionMarker, next: MatchProjectionMarker): boolean {
  return next.revision < previous.revision
    || (next.revision === previous.revision && lifecycleRank(next.lifecycle) < lifecycleRank(previous.lifecycle));
}

export class PlayerPlatformThemeRuntime {
  readonly #storage: DurableStorageLike;
  readonly #base: PlayerPlatformObjectRuntime;
  readonly #onUpdated: PlayerPlatformThemeRuntimeOptions["onUpdated"];
  #tail: Promise<void> = Promise.resolve();

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

  async #currentProgression(playerId: string): Promise<Record<string, unknown>> {
    const url = new URL("https://player.internal/player/progression");
    url.searchParams.set("playerId", playerId);
    const response = await this.#base.fetch(new Request(url));
    const body = await responseBody(response);
    if (!response.ok) throw Object.assign(new Error("Player progression could not be read."), { status: response.status });
    return body;
  }

  fetch(request: Request): Promise<Response> {
    const execute = async () => this.#handle(request);
    const result = this.#tail.then(execute, execute);
    this.#tail = result.then(() => undefined, () => undefined);
    return result;
  }

  async #handle(request: Request): Promise<Response> {
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

      if (request.method === "POST" && url.pathname === "/player/match") {
        const body = await readJson(request.clone());
        const matchId = matchIdFrom(body);
        if (matchId && await this.#storage.get<boolean>(voidedMatchKey(matchId))) {
          return json(200, { matchId, ignored: true, voided: true });
        }
        const next = projectionFrom(body);
        const previous = matchId
          ? await this.#storage.get<MatchProjectionMarker>(projectionKey(matchId))
          : undefined;
        if (previous?.version === 1 && projectionIsStale(previous, next)) {
          return json(200, { matchId, ignored: true, stale: true });
        }
        const response = await this.#base.fetch(request);
        if (response.ok && matchId) await this.#storage.put(projectionKey(matchId), next);
        if (response.ok) await this.#notify(["matches"]);
        return response;
      }

      if (request.method === "POST" && url.pathname === "/player/progression/match") {
        const body = await readJson(request.clone());
        const matchId = matchIdFrom(body);
        if (matchId && await this.#storage.get<boolean>(voidedMatchKey(matchId))) {
          const playerId = String(body.playerId ?? "").trim();
          return json(200, {
            progression: await this.#currentProgression(playerId),
            awarded: false,
            voided: true,
          });
        }
      }

      if (
        request.method === "POST"
        && (url.pathname === "/player/admin/match/void" || url.pathname === "/directory/admin/match/void")
      ) {
        const body = await readJson(request.clone());
        const matchId = matchIdFrom(body);
        const response = await this.#base.fetch(request);
        if (response.ok && matchId) await this.#storage.put(voidedMatchKey(matchId), true);
        if (response.ok && url.pathname.startsWith("/player/")) {
          await this.#notify(["matches", "progression"]);
        }
        return response;
      }

      if (request.method === "POST" && url.pathname === "/directory/match") {
        const body = await readJson(request.clone());
        const matchId = matchIdFrom(body);
        if (matchId && await this.#storage.get<boolean>(voidedMatchKey(matchId))) {
          return json(200, { matchId, ignored: true, voided: true });
        }
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
