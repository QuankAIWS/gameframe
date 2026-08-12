import type { AuthenticatedPrincipal } from "../auth/request-authenticator.ts";
import type { CascadeTelemetryStoredEvent } from "./cascade-telemetry-object-runtime.ts";
import type { GameFrameWorkerEnv } from "./runtime-contracts.ts";

interface InternalErrorBody {
  error?: string;
  message?: string;
}

interface TelemetryReadModel {
  schemaVersion: 1;
  updatedAt: number;
  events: CascadeTelemetryStoredEvent[];
}

interface DirectoryPlayer {
  playerId: string;
  displayName: string | null;
  source: string | null;
}

async function internalJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as InternalErrorBody;
  if (!response.ok) {
    throw Object.assign(new Error(body.message ?? `Internal Cascade telemetry request failed with ${response.status}.`), {
      code: body.error ?? "cascade_telemetry_internal_error",
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

export async function recordCascadeTelemetry(
  env: GameFrameWorkerEnv,
  playerId: string,
  value: Record<string, unknown>,
) {
  return internalJson<{
    accepted: number;
    duplicates: number;
    storedChunks: number;
    updatedAt: number;
  }>(await playerStub(env, playerId).fetch(new Request("https://player.internal/telemetry/cascade/ingest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ events: value.events }),
  })));
}

async function readPlayerTelemetry(env: GameFrameWorkerEnv, playerId: string): Promise<TelemetryReadModel> {
  return internalJson<TelemetryReadModel>(
    await playerStub(env, playerId).fetch(new Request("https://player.internal/telemetry/cascade/export")),
  );
}

function finiteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function eventLevel(event: CascadeTelemetryStoredEvent): number | null {
  const level = finiteNumber(event.payload.level);
  return level !== null && Number.isInteger(level) && level > 0 ? level : null;
}

function summarizePlayer(events: CascadeTelemetryStoredEvent[]) {
  const sessionMap = new Map<string, {
    sessionId: string;
    startedAt: string;
    endedAt: string;
    activeMs: number;
    eventCount: number;
  }>();
  const attemptMap = new Map<string, {
    attemptId: string;
    sessionId: string | null;
    level: number | null;
    mode: string | null;
    startedAt: string;
    endedAt: string | null;
    outcome: "win" | "failed" | "incomplete";
    moves: number;
    invalidSwaps: number;
    hammersUsed: number;
    clears: number;
    maxCascade: number;
    score: number | null;
    movesRemaining: number | null;
    stars: number | null;
  }>();
  const startsByLevel = new Map<number, number>();
  let hammersUsed = 0;
  let moves = 0;
  let invalidSwaps = 0;
  let levelWins = 0;
  let levelFailures = 0;
  let highestLevelStarted = 0;
  let highestLevelCompleted = 0;

  for (const event of events) {
    if (event.sessionId) {
      const existing = sessionMap.get(event.sessionId);
      const activeMs = finiteNumber(event.payload.activeMs) ?? 0;
      if (!existing) {
        sessionMap.set(event.sessionId, {
          sessionId: event.sessionId,
          startedAt: event.at,
          endedAt: event.at,
          activeMs: Math.max(0, activeMs),
          eventCount: 1,
        });
      } else {
        if (event.at < existing.startedAt) existing.startedAt = event.at;
        if (event.at > existing.endedAt) existing.endedAt = event.at;
        existing.activeMs = Math.max(existing.activeMs, Math.max(0, activeMs));
        existing.eventCount += 1;
      }
    }

    const level = eventLevel(event);
    if (level) highestLevelStarted = Math.max(highestLevelStarted, level);
    if (event.type === "level_start" && level) {
      startsByLevel.set(level, (startsByLevel.get(level) ?? 0) + 1);
    }
    if (event.type === "move") moves += 1;
    if (event.type === "invalid_swap") invalidSwaps += 1;
    if (event.type === "booster_used" && event.payload.booster === "hammer") hammersUsed += 1;
    if (event.type === "level_win") {
      levelWins += 1;
      if (level) highestLevelCompleted = Math.max(highestLevelCompleted, level);
    }
    if (event.type === "level_failed") levelFailures += 1;

    if (!event.attemptId) continue;
    let attempt = attemptMap.get(event.attemptId);
    if (!attempt) {
      attempt = {
        attemptId: event.attemptId,
        sessionId: event.sessionId,
        level,
        mode: typeof event.payload.mode === "string" ? event.payload.mode : null,
        startedAt: event.at,
        endedAt: null,
        outcome: "incomplete",
        moves: 0,
        invalidSwaps: 0,
        hammersUsed: 0,
        clears: 0,
        maxCascade: 0,
        score: finiteNumber(event.payload.score),
        movesRemaining: finiteNumber(event.payload.movesRemaining),
        stars: null,
      };
      attemptMap.set(event.attemptId, attempt);
    }
    if (event.at < attempt.startedAt) attempt.startedAt = event.at;
    if (level) attempt.level = level;
    if (typeof event.payload.mode === "string") attempt.mode = event.payload.mode;
    if (event.type === "move") attempt.moves += 1;
    if (event.type === "invalid_swap") attempt.invalidSwaps += 1;
    if (event.type === "booster_used" && event.payload.booster === "hammer") attempt.hammersUsed += 1;
    if (event.type === "clear") {
      attempt.clears += 1;
      attempt.maxCascade = Math.max(attempt.maxCascade, finiteNumber(event.payload.cascade) ?? 0);
    }
    const score = finiteNumber(event.payload.score);
    const movesRemaining = finiteNumber(event.payload.movesRemaining);
    if (score !== null) attempt.score = score;
    if (movesRemaining !== null) attempt.movesRemaining = movesRemaining;
    if (event.type === "level_win" || event.type === "level_failed") {
      attempt.endedAt = event.at;
      attempt.outcome = event.type === "level_win" ? "win" : "failed";
      attempt.stars = finiteNumber(event.payload.stars);
    }
  }

  const sessions = [...sessionMap.values()].sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  const attempts = [...attemptMap.values()].sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  const retries = [...startsByLevel.values()].reduce((sum, starts) => sum + Math.max(0, starts - 1), 0);
  const activePlayMs = sessions.reduce((sum, session) => sum + session.activeMs, 0);
  const completedDurations = attempts
    .filter((attempt) => attempt.endedAt)
    .map((attempt) => Date.parse(attempt.endedAt!) - Date.parse(attempt.startedAt))
    .filter((duration) => Number.isFinite(duration) && duration >= 0);

  return {
    eventCount: events.length,
    playBlocks: sessions.length,
    activePlayMs,
    activePlayMinutes: Math.round((activePlayMs / 60_000) * 10) / 10,
    attempts: attempts.length,
    retries,
    levelWins,
    levelFailures,
    hammersUsed,
    moves,
    invalidSwaps,
    highestLevelStarted,
    highestLevelCompleted,
    averageCompletedAttemptMs: completedDurations.length
      ? Math.round(completedDurations.reduce((sum, duration) => sum + duration, 0) / completedDurations.length)
      : null,
    sessions,
    attemptRows: attempts,
  };
}

export function buildCascadeTelemetryExport(
  generatedAt: number,
  players: Array<DirectoryPlayer & { telemetry: TelemetryReadModel }>,
) {
  const playerRows = players.map((player) => {
    const summary = summarizePlayer(player.telemetry.events);
    return {
      playerId: player.playerId,
      displayName: player.displayName,
      source: player.source,
      telemetryUpdatedAt: player.telemetry.updatedAt || null,
      summary: {
        eventCount: summary.eventCount,
        playBlocks: summary.playBlocks,
        activePlayMs: summary.activePlayMs,
        activePlayMinutes: summary.activePlayMinutes,
        attempts: summary.attempts,
        retries: summary.retries,
        levelWins: summary.levelWins,
        levelFailures: summary.levelFailures,
        hammersUsed: summary.hammersUsed,
        moves: summary.moves,
        invalidSwaps: summary.invalidSwaps,
        highestLevelStarted: summary.highestLevelStarted,
        highestLevelCompleted: summary.highestLevelCompleted,
        averageCompletedAttemptMs: summary.averageCompletedAttemptMs,
      },
      sessions: summary.sessions,
      attempts: summary.attemptRows,
      events: player.telemetry.events,
    };
  });

  return {
    schemaVersion: 1,
    gameId: "cascade",
    generatedAt: new Date(generatedAt).toISOString(),
    definitions: {
      playBlock: "A browser play block grouped by a stable session ID; a new block begins after at least 30 minutes away.",
      activePlayMs: "Foreground, non-idle browser time accumulated while Cascade Crush is open; idle time after two minutes without player input is excluded.",
      retry: "A level start beyond the first observed start for that level in the exported telemetry window.",
      attemptDuration: "Wall-clock time from the observed level start/resume event to its win/failure event when both are available.",
    },
    totals: {
      players: playerRows.length,
      events: playerRows.reduce((sum, player) => sum + player.summary.eventCount, 0),
      playBlocks: playerRows.reduce((sum, player) => sum + player.summary.playBlocks, 0),
      activePlayMs: playerRows.reduce((sum, player) => sum + player.summary.activePlayMs, 0),
      attempts: playerRows.reduce((sum, player) => sum + player.summary.attempts, 0),
      retries: playerRows.reduce((sum, player) => sum + player.summary.retries, 0),
      hammersUsed: playerRows.reduce((sum, player) => sum + player.summary.hammersUsed, 0),
    },
    players: playerRows,
  };
}

export async function exportCascadeTelemetry(
  env: GameFrameWorkerEnv,
  admin: AuthenticatedPrincipal,
) {
  const url = new URL("https://player.internal/directory/list");
  url.searchParams.set("playerId", admin.playerId);
  const directory = await internalJson<{ players: DirectoryPlayer[] }>(await directoryStub(env).fetch(new Request(url)));
  const profiles: DirectoryPlayer[] = [
    {
      playerId: admin.playerId,
      displayName: admin.displayName ?? null,
      source: admin.source,
    },
    ...directory.players,
  ];
  const unique = [...new Map(profiles.map((profile) => [profile.playerId, profile])).values()];
  const players = await Promise.all(unique.map(async (profile) => {
    try {
      return { ...profile, telemetry: await readPlayerTelemetry(env, profile.playerId) };
    } catch {
      return { ...profile, telemetry: { schemaVersion: 1 as const, updatedAt: 0, events: [] } };
    }
  }));
  return buildCascadeTelemetryExport(Date.now(), players);
}
