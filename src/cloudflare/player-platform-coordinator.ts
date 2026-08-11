import type { AuthenticatedPrincipal } from "../auth/request-authenticator.ts";
import type { InvitationGameId } from "../auth/match-invitation.ts";
import { resumePathForGame } from "../auth/match-invitation.ts";
import type { PublicMatchInvitation } from "./invitation-object-runtime.ts";
import type { GameFrameWorkerEnv } from "./runtime-contracts.ts";

interface InternalErrorBody {
  error?: string;
  message?: string;
}

export interface IndexedMatchView {
  gameId: string;
  matchId: string;
  playerIds: string[];
  revision: number;
  observation: {
    nextPlayerId?: string | null;
    activePlayerId?: string | null;
    status?: {
      lifecycle?: string;
      winnerPlayerId?: string | null;
      draw?: boolean;
    };
  };
}

export interface InvitationIndexOptions {
  claimToken?: string | null;
  claimTokenPlayerId?: string | null;
}

async function internalJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as InternalErrorBody;
  if (!response.ok) {
    throw Object.assign(new Error(body.message ?? `Internal player-platform request failed with ${response.status}.`), {
      code: body.error ?? "player_platform_internal_error",
    });
  }
  return body as T;
}

function playerStub(env: GameFrameWorkerEnv, playerId: string) {
  return env.MATCHES.get(env.MATCHES.idFromName(`player:${playerId}`));
}

function directoryStub(env: GameFrameWorkerEnv) {
  return env.MATCHES.get(env.MATCHES.idFromName("directory:players"));
}

export async function upsertPlayerDirectory(
  env: GameFrameWorkerEnv,
  principal: AuthenticatedPrincipal,
): Promise<void> {
  try {
    await internalJson(await directoryStub(env).fetch(new Request("https://player.internal/directory/upsert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        playerId: principal.playerId,
        displayName: principal.displayName ?? null,
        avatarUrl: principal.avatarUrl ?? null,
        source: principal.source,
        lastSeenAt: Date.now(),
      }),
    })));
  } catch {
    // Directory presence is a reconstructable convenience index. Authentication
    // must not fail because this read model is temporarily unavailable.
  }
}

export async function listKnownPlayers(env: GameFrameWorkerEnv, viewerPlayerId: string) {
  const url = new URL("https://player.internal/directory/list");
  url.searchParams.set("playerId", viewerPlayerId);
  return internalJson<{ players: unknown[] }>(await directoryStub(env).fetch(new Request(url)));
}

export async function readPlayerFeed(env: GameFrameWorkerEnv, playerId: string) {
  return internalJson<{ matches: unknown[]; invitations: unknown[]; favoriteGameIds: string[] }>(
    await playerStub(env, playerId).fetch(new Request("https://player.internal/player/feed")),
  );
}

export async function updatePlayerPreferences(
  env: GameFrameWorkerEnv,
  playerId: string,
  favoriteGameIds: unknown,
) {
  return internalJson<{ favoriteGameIds: string[] }>(
    await playerStub(env, playerId).fetch(new Request("https://player.internal/player/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ favoriteGameIds }),
    })),
  );
}

export async function readLeaderboard(env: GameFrameWorkerEnv) {
  return internalJson<{ games: unknown[]; scoredGames: unknown[] }>(
    await directoryStub(env).fetch(new Request("https://player.internal/directory/leaderboard")),
  );
}

export async function submitScoredResult(
  env: GameFrameWorkerEnv,
  playerId: string,
  value: Record<string, unknown>,
) {
  return internalJson<{
    entry: Record<string, unknown>;
    improved: boolean;
    previousBest: number | null;
  }>(await directoryStub(env).fetch(new Request("https://player.internal/directory/score", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      gameId: value.gameId,
      modeId: value.modeId,
      eventId: value.eventId,
      score: value.score,
      metrics: value.metrics,
      playerId,
      updatedAt: Date.now(),
    }),
  })));
}

export async function indexMatchView(env: GameFrameWorkerEnv, view: IndexedMatchView): Promise<void> {
  const status = view.observation.status ?? {};
  const activePlayerId = view.observation.nextPlayerId ?? view.observation.activePlayerId ?? null;
  const gameId = view.gameId as InvitationGameId;
  const summary = {
    matchId: view.matchId,
    gameId: view.gameId,
    playerIds: view.playerIds,
    revision: view.revision,
    activePlayerId,
    status: {
      lifecycle: status.lifecycle === "completed" ? "completed" : status.lifecycle === "waiting" ? "waiting" : "active",
      winnerPlayerId: status.winnerPlayerId ?? null,
      draw: Boolean(status.draw),
    },
    updatedAt: Date.now(),
    resumePath: resumePathForGame(gameId, view.matchId),
  };

  const writes: Promise<unknown>[] = view.playerIds.map((playerId) => internalJson(
    playerStub(env, playerId).fetch(new Request("https://player.internal/player/match", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(summary),
    })),
  ));
  if (summary.status.lifecycle === "completed") {
    writes.push(internalJson(
      directoryStub(env).fetch(new Request("https://player.internal/directory/match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(summary),
      })),
    ));
  }
  await Promise.allSettled(writes);
}

export async function indexInvitation(
  env: GameFrameWorkerEnv,
  invitation: PublicMatchInvitation,
  playerIds: readonly string[],
  options: InvitationIndexOptions = {},
): Promise<void> {
  const uniquePlayers = [...new Set(playerIds.filter(Boolean))];
  await Promise.allSettled(uniquePlayers.map((playerId) => {
    const summary = {
      ...invitation,
      claimToken: options.claimTokenPlayerId === playerId ? options.claimToken ?? null : null,
      updatedAt: Date.now(),
    };
    return internalJson(
      playerStub(env, playerId).fetch(new Request("https://player.internal/player/invitation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(summary),
      })),
    );
  }));
}