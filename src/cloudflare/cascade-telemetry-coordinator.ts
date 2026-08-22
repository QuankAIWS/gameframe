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

type AttemptOutcome = "win" | "failed" | "complete" | "skipped" | "abandoned" | "incomplete";

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
    rejected: Array<{ index: number; eventId: string | null; code: string; message: string }>;
    acceptedEventIds: string[];
    duplicateEventIds: string[];
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
  const level = finiteNumber(event.payload.level ?? event.payload.afterLevel);
  return level !== null && Number.isInteger(level) && level > 0 ? level : null;
}

function increment(map: Record<string, number>, key: unknown) {
  const normalized = typeof key === "string" && key.trim() ? key.trim() : "unknown";
  map[normalized] = (map[normalized] ?? 0) + 1;
}

function terminalOutcome(type: string): AttemptOutcome | null {
  if (type === "level_win") return "win";
  if (type === "level_failed") return "failed";
  if (type === "blitz_complete" || type === "quick_recall_complete") return "complete";
  if (type === "blitz_skip" || type === "quick_recall_skip") return "skipped";
  if (type === "blitz_abandon" || type === "quick_recall_abandon") return "abandoned";
  return null;
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
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
    outcome: AttemptOutcome;
    activeAttemptMs: number;
    wallDurationMs: number | null;
    moves: number;
    invalidSwaps: number;
    invalidSwapReasons: Record<string, number>;
    inputMethods: Record<string, number>;
    hammersUsed: number;
    clears: number;
    maxCascade: number;
    score: number | null;
    movesRemaining: number | null;
    stars: number | null;
    initialRngState: number | null;
    rulesVersion: string | null;
  }>();
  const startsByLevel = new Map<number, number>();
  const bonus = {
    blitzOffers: 0,
    blitzStarts: 0,
    blitzCompletes: 0,
    blitzSkips: 0,
    blitzAbandons: 0,
    quickRecallOffers: 0,
    quickRecallStarts: 0,
    quickRecallCompletes: 0,
    quickRecallSkips: 0,
    quickRecallAbandons: 0,
    quickRecallRounds: 0,
  };
  const resources = {
    hammerSources: 0,
    hammerSinks: 0,
    lifeSources: 0,
    lifeSinks: 0,
  };
  const telemetryHealth = {
    generated: 0,
    accepted: 0,
    duplicates: 0,
    rejected: 0,
    uploadAttempts: 0,
    uploadFailures: 0,
    outboxWriteFailures: 0,
    fallbackDrops: 0,
    payloadTruncated: 0,
  };
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

    for (const key of Object.keys(telemetryHealth) as Array<keyof typeof telemetryHealth>) {
      const value = finiteNumber(event.payload[key]);
      if (value !== null) telemetryHealth[key] = Math.max(telemetryHealth[key], Math.max(0, value));
    }

    const level = eventLevel(event);
    if (event.type === "level_start" && level) {
      highestLevelStarted = Math.max(highestLevelStarted, level);
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

    if (event.type === "blitz_offer") bonus.blitzOffers += 1;
    if (event.type === "blitz_start") bonus.blitzStarts += 1;
    if (event.type === "blitz_complete") bonus.blitzCompletes += 1;
    if (event.type === "blitz_skip") bonus.blitzSkips += 1;
    if (event.type === "blitz_abandon") bonus.blitzAbandons += 1;
    if (event.type === "quick_recall_offer") bonus.quickRecallOffers += 1;
    if (event.type === "quick_recall_start") bonus.quickRecallStarts += 1;
    if (event.type === "quick_recall_complete") bonus.quickRecallCompletes += 1;
    if (event.type === "quick_recall_skip") bonus.quickRecallSkips += 1;
    if (event.type === "quick_recall_abandon") bonus.quickRecallAbandons += 1;
    if (event.type === "quick_recall_round_complete") bonus.quickRecallRounds += 1;

    if (event.type === "resource_change") {
      const resource = String(event.payload.resource || "");
      const direction = String(event.payload.direction || "");
      const amount = Math.max(0, finiteNumber(event.payload.amount) ?? 0);
      if (resource === "hammer" && direction === "source") resources.hammerSources += amount;
      if (resource === "hammer" && direction === "sink") resources.hammerSinks += amount;
      if (resource === "life" && direction === "source") resources.lifeSources += amount;
      if (resource === "life" && direction === "sink") resources.lifeSinks += amount;
    }

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
        activeAttemptMs: Math.max(0, finiteNumber(event.payload.activeAttemptMs) ?? 0),
        wallDurationMs: null,
        moves: 0,
        invalidSwaps: 0,
        invalidSwapReasons: {},
        inputMethods: {},
        hammersUsed: 0,
        clears: 0,
        maxCascade: 0,
        score: finiteNumber(event.payload.score),
        movesRemaining: finiteNumber(event.payload.movesRemaining),
        stars: null,
        initialRngState: finiteNumber(event.payload.initialRngState),
        rulesVersion: typeof event.payload.rulesVersion === "string" ? event.payload.rulesVersion : null,
      };
      attemptMap.set(event.attemptId, attempt);
    }
    if (event.at < attempt.startedAt) attempt.startedAt = event.at;
    if (level) attempt.level = level;
    if (typeof event.payload.mode === "string") attempt.mode = event.payload.mode;
    attempt.activeAttemptMs = Math.max(attempt.activeAttemptMs, Math.max(0, finiteNumber(event.payload.activeAttemptMs) ?? 0));
    if (attempt.initialRngState === null) attempt.initialRngState = finiteNumber(event.payload.initialRngState);
    if (!attempt.rulesVersion && typeof event.payload.rulesVersion === "string") attempt.rulesVersion = event.payload.rulesVersion;
    if (event.type === "move") attempt.moves += 1;
    if (event.type === "invalid_swap") {
      attempt.invalidSwaps += 1;
      increment(attempt.invalidSwapReasons, event.payload.invalidReason);
    }
    if ((event.type === "move" || event.type === "invalid_swap") && event.payload.inputMethod) {
      increment(attempt.inputMethods, event.payload.inputMethod);
    }
    if (event.type === "booster_used" && event.payload.booster === "hammer") attempt.hammersUsed += 1;
    if (event.type === "clear") {
      attempt.clears += 1;
      attempt.maxCascade = Math.max(attempt.maxCascade, finiteNumber(event.payload.cascade) ?? 0);
    }
    const score = finiteNumber(event.payload.score);
    const movesRemaining = finiteNumber(event.payload.movesRemaining);
    if (score !== null) attempt.score = score;
    if (movesRemaining !== null) attempt.movesRemaining = movesRemaining;
    const outcome = terminalOutcome(event.type);
    if (outcome) {
      attempt.endedAt = event.at;
      attempt.outcome = outcome;
      attempt.stars = finiteNumber(event.payload.stars);
    }
  }

  const sessions = [...sessionMap.values()].sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  const attempts = [...attemptMap.values()].sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  for (const attempt of attempts) {
    if (!attempt.endedAt) continue;
    const wall = Date.parse(attempt.endedAt) - Date.parse(attempt.startedAt);
    attempt.wallDurationMs = Number.isFinite(wall) && wall >= 0 ? wall : null;
  }
  const retries = [...startsByLevel.values()].reduce((sum, starts) => sum + Math.max(0, starts - 1), 0);
  const activePlayMs = sessions.reduce((sum, session) => sum + session.activeMs, 0);
  const completed = attempts.filter((attempt) => attempt.endedAt);
  const wallDurations = completed.map((attempt) => attempt.wallDurationMs).filter((value): value is number => value !== null);
  const activeDurations = completed.map((attempt) => attempt.activeAttemptMs).filter((value) => value > 0);

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
    averageCompletedAttemptMs: average(wallDurations),
    averageWallClockAttemptMs: average(wallDurations),
    averageActiveAttemptMs: average(activeDurations),
    bonus,
    resources,
    telemetryHealth,
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
        averageWallClockAttemptMs: summary.averageWallClockAttemptMs,
        averageActiveAttemptMs: summary.averageActiveAttemptMs,
        bonus: summary.bonus,
        resources: summary.resources,
        telemetryHealth: summary.telemetryHealth,
      },
      sessions: summary.sessions,
      attempts: summary.attemptRows,
      events: player.telemetry.events,
    };
  });

  return {
    schemaVersion: 2,
    gameId: "cascade",
    generatedAt: new Date(generatedAt).toISOString(),
    definitions: {
      playBlock: "A browser play block grouped by a stable session ID; a new block begins after at least 30 minutes away.",
      activePlayMs: "Foreground, non-idle browser time accumulated while Cascade Crush is open; idle time after two minutes without player input is excluded.",
      activeAttemptMs: "Foreground, non-idle time accumulated while one authoritative level, Blitz, or Quick Recall attempt is active.",
      wallDurationMs: "Literal elapsed wall-clock time between the first and terminal event for an attempt; suspension and time away are included.",
      retry: "A normal level start beyond the first observed start for that level in the exported telemetry window.",
      averageCompletedAttemptMs: "Deprecated compatibility field equal to averageWallClockAttemptMs; use averageActiveAttemptMs for gameplay pacing and balancing.",
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
