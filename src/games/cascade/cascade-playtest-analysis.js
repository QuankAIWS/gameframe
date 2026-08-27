import { CASCADE_LEVELS } from "../../../public/cascade-engine.js";

function ratio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : null;
}

function attemptTime(attempt) {
  const parsed = Date.parse(attempt?.startedAt || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolvedNormalAttempts(player) {
  return (player?.attempts || [])
    .filter((attempt) => attempt?.mode === "normal" && (attempt.outcome === "win" || attempt.outcome === "failed"))
    .slice()
    .sort((a, b) => attemptTime(a) - attemptTime(b));
}

function groupByLevel(attempts) {
  const groups = new Map();
  for (const attempt of attempts) {
    const level = Number(attempt.level);
    if (!Number.isInteger(level) || level < 1) continue;
    if (!groups.has(level)) groups.set(level, []);
    groups.get(level).push(attempt);
  }
  return groups;
}

function firstPassSummary(attempts) {
  const levels = groupByLevel(attempts);
  let eligible = 0;
  let wins = 0;
  let contaminatedByHammer = 0;
  for (const levelAttempts of levels.values()) {
    const first = levelAttempts[0];
    if (Number(first?.hammersUsed || 0) > 0) {
      contaminatedByHammer += 1;
      continue;
    }
    eligible += 1;
    if (first.outcome === "win") wins += 1;
  }
  return {
    eligibleLevels: eligible,
    wins,
    rate: ratio(wins, eligible),
    hammerContaminatedLevels: contaminatedByHammer,
  };
}

function attemptsPerSuccessSummary(attempts) {
  const levels = groupByLevel(attempts);
  let cleanLevels = 0;
  let attemptsThroughFirstWin = 0;
  let hammerContaminatedLevels = 0;

  for (const levelAttempts of levels.values()) {
    const firstWinIndex = levelAttempts.findIndex((attempt) => attempt.outcome === "win");
    if (firstWinIndex < 0) continue;
    const throughWin = levelAttempts.slice(0, firstWinIndex + 1);
    if (throughWin.some((attempt) => Number(attempt.hammersUsed || 0) > 0)) {
      hammerContaminatedLevels += 1;
      continue;
    }
    cleanLevels += 1;
    attemptsThroughFirstWin += throughWin.length;
  }

  return {
    cleanLevels,
    attemptsThroughFirstWin,
    attemptsPerSuccess: ratio(attemptsThroughFirstWin, cleanLevels),
    hammerContaminatedLevels,
  };
}

function aggregateCleanFirstPass(players) {
  const byLevel = new Map();

  for (const player of players) {
    const levels = groupByLevel(resolvedNormalAttempts(player));
    for (const [levelNumber, levelAttempts] of levels) {
      const first = levelAttempts[0];
      if (!first || Number(first.hammersUsed || 0) > 0) continue;
      const definition = CASCADE_LEVELS[levelNumber - 1];
      if (!definition) continue;
      if (!byLevel.has(levelNumber)) {
        byLevel.set(levelNumber, {
          level: levelNumber,
          chapter: definition.chapter || "unknown",
          difficulty: definition.difficulty || "normal",
          eligible: 0,
          wins: 0,
        });
      }
      const row = byLevel.get(levelNumber);
      row.eligible += 1;
      if (first.outcome === "win") row.wins += 1;
    }
  }

  const levels = [...byLevel.values()]
    .sort((a, b) => a.level - b.level)
    .map((row) => ({ ...row, rate: ratio(row.wins, row.eligible) }));

  const aggregate = (key) => {
    const buckets = new Map();
    for (const row of levels) {
      const bucketKey = row[key];
      if (!buckets.has(bucketKey)) buckets.set(bucketKey, { [key]: bucketKey, eligible: 0, wins: 0 });
      const bucket = buckets.get(bucketKey);
      bucket.eligible += row.eligible;
      bucket.wins += row.wins;
    }
    return [...buckets.values()].map((bucket) => ({
      ...bucket,
      rate: ratio(bucket.wins, bucket.eligible),
    }));
  };

  return {
    levels,
    byDifficulty: aggregate("difficulty"),
    byChapter: aggregate("chapter"),
  };
}

function aggregateDifficultyBuckets(players) {
  const buckets = new Map();
  for (const player of players) {
    for (const attempt of resolvedNormalAttempts(player)) {
      if (Number(attempt.hammersUsed || 0) > 0) continue;
      const definition = CASCADE_LEVELS[Number(attempt.level) - 1];
      if (!definition) continue;
      const key = definition.difficulty || "normal";
      if (!buckets.has(key)) buckets.set(key, { difficulty: key, attempts: 0, wins: 0, failures: 0 });
      const bucket = buckets.get(key);
      bucket.attempts += 1;
      if (attempt.outcome === "win") bucket.wins += 1;
      else bucket.failures += 1;
    }
  }
  return [...buckets.values()].map((bucket) => ({
    ...bucket,
    winRate: ratio(bucket.wins, bucket.attempts),
    failureRate: ratio(bucket.failures, bucket.attempts),
  }));
}

function aggregateChapterBuckets(players) {
  const buckets = new Map();
  for (const player of players) {
    for (const attempt of resolvedNormalAttempts(player)) {
      if (Number(attempt.hammersUsed || 0) > 0) continue;
      const definition = CASCADE_LEVELS[Number(attempt.level) - 1];
      if (!definition) continue;
      const key = definition.chapter || "unknown";
      if (!buckets.has(key)) {
        buckets.set(key, {
          chapter: key,
          startLevel: definition.level,
          endLevel: definition.level,
          attempts: 0,
          wins: 0,
          failures: 0,
        });
      }
      const bucket = buckets.get(key);
      bucket.startLevel = Math.min(bucket.startLevel, definition.level);
      bucket.endLevel = Math.max(bucket.endLevel, definition.level);
      bucket.attempts += 1;
      if (attempt.outcome === "win") bucket.wins += 1;
      else bucket.failures += 1;
    }
  }
  return [...buckets.values()]
    .sort((a, b) => a.startLevel - b.startLevel)
    .map((bucket) => ({
      ...bucket,
      winRate: ratio(bucket.wins, bucket.attempts),
      failureRate: ratio(bucket.failures, bucket.attempts),
    }));
}

export function analyzePlaytestExport(data, { boosterMetricExclusions = {} } = {}) {
  const players = Array.isArray(data?.players) ? data.players : [];
  const playerReports = players.map((player) => {
    const resolved = resolvedNormalAttempts(player);
    const wins = resolved.filter((attempt) => attempt.outcome === "win").length;
    const failures = resolved.filter((attempt) => attempt.outcome === "failed").length;
    const unassisted = resolved.filter((attempt) => Number(attempt.hammersUsed || 0) === 0);
    const unassistedWins = unassisted.filter((attempt) => attempt.outcome === "win").length;
    const firstPass = firstPassSummary(resolved);
    const aps = attemptsPerSuccessSummary(resolved);
    const exclusionReason = boosterMetricExclusions[player.displayName] || null;
    const hammerUses = resolved.reduce((sum, attempt) => sum + Math.max(0, Number(attempt.hammersUsed || 0)), 0);
    const hammerAttempts = resolved.filter((attempt) => Number(attempt.hammersUsed || 0) > 0).length;

    return {
      displayName: player.displayName,
      playerId: player.playerId,
      highestLevelStarted: player.summary?.highestLevelStarted ?? null,
      highestLevelCompleted: player.summary?.highestLevelCompleted ?? null,
      resolvedAttempts: resolved.length,
      wins,
      failures,
      observedWinRate: ratio(wins, resolved.length),
      unassistedResolvedAttempts: unassisted.length,
      unassistedWins,
      unassistedWinRate: ratio(unassistedWins, unassisted.length),
      firstPass,
      unassistedAttemptsPerSuccess: aps,
      boosterMetrics: exclusionReason
        ? { excluded: true, reason: exclusionReason }
        : {
            excluded: false,
            hammerUses,
            attemptsWithHammer: hammerAttempts,
            hammerAttemptRate: ratio(hammerAttempts, resolved.length),
          },
    };
  });

  const allResolved = players.flatMap((player) => resolvedNormalAttempts(player));
  const allUnassisted = allResolved.filter((attempt) => Number(attempt.hammersUsed || 0) === 0);
  const unassistedWins = allUnassisted.filter((attempt) => attempt.outcome === "win").length;
  const cleanFirstPass = aggregateCleanFirstPass(players);

  return {
    schemaVersion: data?.schemaVersion ?? null,
    generatedAt: data?.generatedAt ?? null,
    playerCount: players.length,
    resolvedNormalAttempts: allResolved.length,
    unassistedResolvedAttempts: allUnassisted.length,
    unassistedWins,
    unassistedWinRate: ratio(unassistedWins, allUnassisted.length),
    players: playerReports,
    cleanFirstPass,
    byDifficulty: aggregateDifficultyBuckets(players),
    byChapter: aggregateChapterBuckets(players),
    policy: {
      hammerAssistedAttemptsExcludedFromIntrinsicDifficulty: true,
      invalidSwapsUsedAsSkillSignal: false,
      deviceClassChangesLevelDifficulty: false,
    },
  };
}
