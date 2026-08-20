import {
  compactPlayerProgression,
  type PublicPlayerProgression,
} from "./player-progression.ts";
import {
  readPlayerFeed,
  readPlayerProgression,
  readPublicPlayerProfile,
  type IndexedMatchView,
} from "./player-platform-coordinator.ts";
import type { GameFrameWorkerEnv } from "./runtime-contracts.ts";

interface InternalErrorBody {
  error?: string;
  message?: string;
}

async function internalJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as InternalErrorBody;
  if (!response.ok) {
    throw Object.assign(new Error(body.message ?? `Internal admin request failed with ${response.status}.`), {
      code: body.error ?? "player_platform_internal_error",
      status: response.status,
    });
  }
  return body as T;
}

function matchStub(env: GameFrameWorkerEnv, matchId: string) {
  return env.MATCHES.get(env.MATCHES.idFromName(matchId));
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

export async function readAdminPlayer(env: GameFrameWorkerEnv, playerId: string) {
  const [profile, progression, feed] = await Promise.all([
    readPublicPlayerProfile(env, playerId),
    readPlayerProgression(env, playerId),
    readPlayerFeed(env, playerId),
  ]);
  return {
    profile: profile.profile,
    progression,
    feed,
  };
}

export async function adminVoidMatch(env: GameFrameWorkerEnv, matchId: string) {
  const voided = await internalJson<IndexedMatchView>(await matchStub(env, matchId).fetch(new Request(
    "https://match.internal/admin/void",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ matchId }),
    },
  )));

  const players = await Promise.all(voided.playerIds.map(async (playerId) => {
    const result = await internalJson<{
      matchId: string;
      removed: boolean;
      reversed: boolean;
      progression: PublicPlayerProgression;
    }>(await playerStub(env, playerId).fetch(new Request("https://player.internal/player/admin/match/void", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId, matchId }),
    })));
    await publishPlayerProgression(env, result.progression);
    return { playerId, removed: result.removed, reversed: result.reversed };
  }));

  await internalJson(await directoryStub(env).fetch(new Request("https://player.internal/directory/admin/match/void", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ matchId }),
  })));

  return {
    matchId,
    gameId: voided.gameId,
    playerIds: [...voided.playerIds],
    players,
    voided: true,
  };
}
