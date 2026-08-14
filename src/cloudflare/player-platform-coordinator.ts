import type { AuthenticatedPrincipal } from "../auth/request-authenticator.ts";
import type { InvitationGameId } from "../auth/match-invitation.ts";
import { resumePathForGame } from "../auth/match-invitation.ts";
import type { PublicMatchInvitation } from "./invitation-object-runtime.ts";
import {
  compactPlayerProgression,
  type PublicPlayerProgression,
  type PublicPlayerProgressionSummary,
} from "./player-progression.ts";
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

async function publishPlayerProgression(env: GameFrameWorkerEnv, progression: PublicPlayerProgression): Promise<void> {
  await internalJson(await directoryStub(env).fetch(new Request("https://player.internal/directory/progression", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(compactPlayerProgression(progression)),
  })));
}

export async function readPlayerProgression(env: GameFrameWorkerEnv, playerId: string) {
  const url = new URL("https://player.internal/player/progression");
  url.searchParams.set("playerId", playerId);
  return internalJson<PublicPlayerProgression>(await playerStub(env, playerId).fetch(new Request(url)));
}

export async function readPublicPlayerProfile(env: GameFrameWorkerEnv, playerId: string) {
  const url = new URL("https://player.internal/directory/profile");
  url.searchParams.set("playerId", playerId);
  return internalJson<{
    profile: {
      playerId: string;
      displayName: string | null;
      avatarUrl: string | null;
      source: string | null;
      firstSeenAt: number;
      lastSeenAt: number;
    };
    progression: PublicPlayerProgressionSummary;
  }>(await directoryStub(env).fetch(new Request(url)));
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
    await publishPlayerProgression(env, await readPlayerProgression(env, principal.playerId));
  } catch {
    // Directory presence and public progression are reconstructable read models.
    // Authentication must not fail because either read model is unavailable.
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
  return internalJson<{ gamerLevels: unknown[]; games: unknown[]; scoredGames: unknown[] }>(
    await directoryStub(env).fetch(new Request("https://player.internal/directory/leaderboard")),
  );
}

export async function recordCascadeProgression(
  env: GameFrameWorkerEnv,
  playerId: string,
  value: Record<string, unknown>,
) {
  const progression = await internalJson<PublicPlayerProgression>(
    await playerStub(env, playerId).fetch(new Request("https://player.internal/player/progression/cascade", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        playerId,
        highestCompletedLevel: value.highestCompletedLevel,
        starsByLevel: value.starsByLevel,
        updatedAt: Date.now(),
      }),
    })),
  );
  await publishPlayerProgression(env, progression);
  return progression;
}

export async function submitScoredResult(
  env: GameFrameWorkerEnv,
  playerId: string,
  value: Record<string, unknown>,
) {
  const submittedAt = Date.now();
  const result = await internalJson<{
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
      updatedAt: submittedAt,
    }),
  })));
  try {
    const progressionResult = await internalJson<{ progression: PublicPlayerProgression }>(
      await playerStub(env, playerId).fetch(new Request("https://player.internal/player/progression/score", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          playerId,
          gameId: value.gameId,
          modeId: value.modeId,
          eventId: value.eventId,
          score: value.score,
          updatedAt: submittedAt,
        }),
      })),
    );
    await publishPlayerProgression(env, progressionResult.progression);
  } catch {
    // The scored-event leaderboard remains usable if the optional social
    // progression projection is temporarily unavailable.
  }
  return result;
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

  const writes: Promise<unknown>[] = view.playerIds.map(async (playerId) => {
    await internalJson(
      await playerStub(env, playerId).fetch(new Request("https://player.internal/player/match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(summary),
      })),
    );
    if (summary.status.lifecycle !== "completed") return;
    const progressionResult = await internalJson<{ progression: PublicPlayerProgression }>(
      await playerStub(env, playerId).fetch(new Request("https://player.internal/player/progression/match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...summary, playerId }),
      })),
    );
    await publishPlayerProgression(env, progressionResult.progression);
  });
  if (summary.status.lifecycle === "completed") {
    writes.push(internalJson(
      await directoryStub(env).fetch(new Request("https://player.internal/directory/match", {
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
  const uniquePlayers = [...new Set([...playerIds, invitation.targetPlayerId ?? ""].filter(Boolean))];
  await Promise.all(uniquePlayers.map(async (playerId) => {
    const summary = {
      ...invitation,
      claimToken: options.claimTokenPlayerId === playerId ? options.claimToken ?? null : null,
      updatedAt: Date.now(),
    };
    return internalJson(
      await playerStub(env, playerId).fetch(new Request("https://player.internal/player/invitation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(summary),
      })),
    );
  }));
}
