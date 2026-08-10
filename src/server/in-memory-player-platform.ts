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
    };
  }
}
