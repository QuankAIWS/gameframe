import type { AuthenticatedPrincipal } from "../auth/request-authenticator.ts";
import { resumePathForGame, type InvitationGameId } from "../auth/match-invitation.ts";
import type { PublicGameMatchView } from "./in-memory-match-service.ts";

const MAX_FAVORITES = 12;

export interface LocalPlayerMatchSummary {
  matchId: string;
  gameId: string;
  playerIds: string[];
  revision: number;
  activePlayerId: string | null;
  lifecycle: "active" | "completed";
  winnerPlayerId: string | null;
  draw: boolean;
  updatedAt: number;
  resumePath: string;
}

export interface LocalScoredResult {
  gameId: string;
  modeId: string;
  eventId: string;
  playerId: string;
  score: number;
  metrics: Record<string, number>;
  updatedAt: number;
}

function boundedText(value: unknown, name: string, maximum: number): string {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > maximum) {
    throw Object.assign(new Error(`${name} must be non-empty and bounded.`), { code: "bad_request" });
  }
  return normalized;
}

function boundedScore(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1_000_000_000) {
    throw Object.assign(new Error("Score must be a finite non-negative number."), { code: "bad_request" });
  }
  return Math.floor(numeric);
}

function scoreMetrics(value: unknown): Record<string, number> {
  if (value === undefined || value === null) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw Object.assign(new Error("Score metrics must be an object."), { code: "bad_request" });
  }
  const metrics: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>).slice(0, 12)) {
    const name = boundedText(key, "Score metric name", 40);
    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || Math.abs(numeric) > 1_000_000_000) {
      throw Object.assign(new Error("Score metrics must contain bounded finite numbers."), { code: "bad_request" });
    }
    metrics[name] = numeric;
  }
  return metrics;
}

export class InMemoryPlayerPlatform {
  readonly #players = new Map<string, {
    playerId: string;
    displayName: string | null;
    avatarUrl: string | null;
    source: string;
    firstSeenAt: number;
    lastSeenAt: number;
  }>();
  readonly #matches = new Map<string, LocalPlayerMatchSummary>();
  readonly #favorites = new Map<string, string[]>();
  readonly #scores = new Map<string, LocalScoredResult>();

  register(principal: AuthenticatedPrincipal): void {
    const now = Date.now();
    const existing = this.#players.get(principal.playerId);
    this.#players.set(principal.playerId, {
      playerId: principal.playerId,
      displayName: principal.displayName ?? null,
      avatarUrl: principal.avatarUrl ?? null,
      source: principal.source,
      firstSeenAt: existing?.firstSeenAt ?? now,
      lastSeenAt: now,
    });
  }

  playersFor(viewerPlayerId: string) {
    return [...this.#players.values()]
      .filter((profile) => profile.playerId !== viewerPlayerId)
      .sort((left, right) => right.lastSeenAt - left.lastSeenAt)
      .map((profile) => ({ ...profile }));
  }

  updateFavorites(playerId: string, favoriteGameIds: unknown) {
    if (!Array.isArray(favoriteGameIds)) throw Object.assign(new Error("favoriteGameIds must be an array."), { code: "bad_request" });
    const favorites = [...new Set(favoriteGameIds.map((value) => String(value).trim()).filter(Boolean))].slice(0, MAX_FAVORITES);
    this.#favorites.set(playerId, favorites);
    return { favoriteGameIds: [...favorites] };
  }

  submitScore(playerId: string, value: Record<string, unknown>) {
    const incoming: LocalScoredResult = {
      gameId: boundedText(value.gameId, "Scored game ID", 80),
      modeId: boundedText(value.modeId, "Scored mode ID", 80),
      eventId: boundedText(value.eventId, "Scored event ID", 160),
      playerId: boundedText(playerId, "Scored player ID", 160),
      score: boundedScore(value.score),
      metrics: scoreMetrics(value.metrics),
      updatedAt: Date.now(),
    };
    const key = `${incoming.gameId}\u0000${incoming.modeId}\u0000${incoming.eventId}\u0000${incoming.playerId}`;
    const existing = this.#scores.get(key);
    const improved = !existing || incoming.score > existing.score;
    if (improved) this.#scores.set(key, incoming);
    const entry = improved ? incoming : existing!;
    return {
      entry: { ...entry, metrics: { ...entry.metrics } },
      improved,
      previousBest: existing?.score ?? null,
    };
  }

  indexMatch(view: PublicGameMatchView): void {
    const observation = view.observation as {
      activePlayerId?: string | null;
      nextPlayerId?: string | null;
      status?: { lifecycle?: string; winnerPlayerId?: string | null; draw?: boolean };
    };
    const status = observation.status ?? {};
    this.#matches.set(view.matchId, {
      matchId: view.matchId,
      gameId: view.gameId,
      playerIds: [...view.playerIds],
      revision: view.revision,
      activePlayerId: observation.nextPlayerId ?? observation.activePlayerId ?? null,
      lifecycle: status.lifecycle === "completed" ? "completed" : "active",
      winnerPlayerId: status.winnerPlayerId ?? null,
      draw: Boolean(status.draw),
      updatedAt: Date.now(),
      resumePath: resumePathForGame(view.gameId as InvitationGameId, view.matchId),
    });
  }

  feedFor(playerId: string) {
    return {
      matches: [...this.#matches.values()]
        .filter((match) => match.playerIds.includes(playerId))
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .map((match) => ({ ...match, playerIds: [...match.playerIds] })),
      invitations: [],
      favoriteGameIds: [...(this.#favorites.get(playerId) ?? [])],
    };
  }

  leaderboard() {
    const games = new Map<string, Map<string, { played: number; wins: number; losses: number; draws: number }>>();
    for (const match of this.#matches.values()) {
      if (match.lifecycle !== "completed") continue;
      const game = games.get(match.gameId) ?? new Map();
      games.set(match.gameId, game);
      for (const playerId of match.playerIds) {
        const profile = this.#players.get(playerId);
        if (!profile) continue;
        const stats = game.get(playerId) ?? { played: 0, wins: 0, losses: 0, draws: 0 };
        stats.played += 1;
        if (match.draw) stats.draws += 1;
        else if (match.winnerPlayerId === playerId) stats.wins += 1;
        else stats.losses += 1;
        game.set(playerId, stats);
      }
    }

    const scored = new Map<string, { gameId: string; modeId: string; eventId: string; entries: LocalScoredResult[] }>();
    for (const entry of this.#scores.values()) {
      const key = `${entry.gameId}\u0000${entry.modeId}\u0000${entry.eventId}`;
      const group = scored.get(key) ?? { gameId: entry.gameId, modeId: entry.modeId, eventId: entry.eventId, entries: [] };
      group.entries.push(entry);
      scored.set(key, group);
    }

    return {
      games: [...games.entries()].map(([gameId, entries]) => ({
        gameId,
        entries: [...entries.entries()]
          .map(([playerId, stats]) => {
            const profile = this.#players.get(playerId)!;
            return {
              playerId,
              displayName: profile.displayName,
              avatarUrl: profile.avatarUrl,
              ...stats,
              points: stats.wins * 3 + stats.draws,
            };
          })
          .sort((left, right) => right.points - left.points || right.wins - left.wins || left.losses - right.losses || left.playerId.localeCompare(right.playerId)),
      })),
      scoredGames: [...scored.values()]
        .map((group) => ({
          gameId: group.gameId,
          modeId: group.modeId,
          eventId: group.eventId,
          entries: group.entries
            .map((entry) => {
              const profile = this.#players.get(entry.playerId);
              return {
                playerId: entry.playerId,
                displayName: profile?.displayName ?? null,
                avatarUrl: profile?.avatarUrl ?? null,
                score: entry.score,
                metrics: { ...entry.metrics },
                updatedAt: entry.updatedAt,
              };
            })
            .sort((left, right) => right.score - left.score || left.updatedAt - right.updatedAt || left.playerId.localeCompare(right.playerId)),
        }))
        .sort((left, right) => right.eventId.localeCompare(left.eventId) || left.gameId.localeCompare(right.gameId) || left.modeId.localeCompare(right.modeId)),
    };
  }
}