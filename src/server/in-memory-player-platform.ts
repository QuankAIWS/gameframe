import type { AuthenticatedPrincipal } from "../auth/request-authenticator.ts";
import { resumePathForGame, type InvitationGameId } from "../auth/match-invitation.ts";
import type { PublicGameMatchView } from "./in-memory-match-service.ts";

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
    };
  }
}
