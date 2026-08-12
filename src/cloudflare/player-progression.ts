export const GAMER_XP_RULES = Object.freeze({
  completedMatch: 75,
  wonMatch: 25,
  drawnMatch: 10,
  cascadeLevelClear: 100,
  cascadeBestStar: 20,
  weeklyBlitzParticipation: 50,
});

export const MAX_CASCADE_LEVEL = 300;

export interface LifetimeGameRecord {
  played: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface CascadeProgression {
  highestCompletedLevel: number;
  starsByLevel: Record<string, number>;
  totalBestStars: number;
  weeklyBlitzEntries: number;
  weeklyBlitzBestScore: number;
}

export interface PlayerProgressionRecord {
  version: 1;
  playerId: string;
  gamerXp: number;
  xpUpdatedAt: number;
  games: Record<string, LifetimeGameRecord>;
  cascade: CascadeProgression;
  updatedAt: number;
}

export interface GamerLevelSummary {
  gamerXp: number;
  gamerLevel: number;
  levelStartXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  progress: number;
}

export interface PublicPlayerProgression extends GamerLevelSummary {
  playerId: string;
  xpUpdatedAt: number;
  games: Record<string, LifetimeGameRecord>;
  cascade: CascadeProgression;
  updatedAt: number;
}

export interface CompletedMatchProgressionInput {
  playerId: string;
  gameId: string;
  winnerPlayerId: string | null;
  draw: boolean;
  updatedAt?: number;
}

export interface CascadeProgressionInput {
  highestCompletedLevel?: unknown;
  starsByLevel?: unknown;
  updatedAt?: number;
}

export interface ScoredProgressionInput {
  gameId: string;
  modeId: string;
  score: number;
  firstParticipation: boolean;
  updatedAt?: number;
}

function whole(value: unknown, minimum = 0): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return minimum;
  return Math.max(minimum, Math.floor(numeric));
}

function positiveTimestamp(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : fallback;
}

function cloneGameRecord(record: LifetimeGameRecord | undefined): LifetimeGameRecord {
  return {
    played: whole(record?.played),
    wins: whole(record?.wins),
    losses: whole(record?.losses),
    draws: whole(record?.draws),
  };
}

function cloneCascade(value: CascadeProgression | undefined): CascadeProgression {
  const starsByLevel: Record<string, number> = {};
  for (const [level, stars] of Object.entries(value?.starsByLevel ?? {})) {
    const numericLevel = Number(level);
    const numericStars = Number(stars);
    if (!Number.isInteger(numericLevel) || numericLevel < 1 || numericLevel > MAX_CASCADE_LEVEL) continue;
    if (!Number.isFinite(numericStars)) continue;
    starsByLevel[String(numericLevel)] = Math.max(0, Math.min(3, Math.floor(numericStars)));
  }
  return {
    highestCompletedLevel: Math.min(MAX_CASCADE_LEVEL, whole(value?.highestCompletedLevel)),
    starsByLevel,
    totalBestStars: Object.values(starsByLevel).reduce((total, stars) => total + stars, 0),
    weeklyBlitzEntries: whole(value?.weeklyBlitzEntries),
    weeklyBlitzBestScore: whole(value?.weeklyBlitzBestScore),
  };
}

export function emptyPlayerProgression(playerId: string, now = Date.now()): PlayerProgressionRecord {
  return {
    version: 1,
    playerId,
    gamerXp: 0,
    xpUpdatedAt: 0,
    games: {},
    cascade: cloneCascade(undefined),
    updatedAt: now,
  };
}

export function xpRequiredForLevel(level: number): number {
  const normalized = Math.max(1, Math.floor(level));
  if (normalized <= 1) return 0;
  return Math.round(100 * Math.pow(normalized - 1, 1.65));
}

export function gamerLevelSummary(gamerXp: number): GamerLevelSummary {
  const xp = whole(gamerXp);
  let level = Math.max(1, Math.floor(Math.pow(xp / 100, 1 / 1.65)) + 1);
  while (level > 1 && xp < xpRequiredForLevel(level)) level -= 1;
  while (xp >= xpRequiredForLevel(level + 1)) level += 1;
  const levelStartXp = xpRequiredForLevel(level);
  const nextLevelXp = xpRequiredForLevel(level + 1);
  const span = Math.max(1, nextLevelXp - levelStartXp);
  const xpIntoLevel = Math.max(0, xp - levelStartXp);
  return {
    gamerXp: xp,
    gamerLevel: level,
    levelStartXp,
    nextLevelXp,
    xpIntoLevel,
    xpToNextLevel: Math.max(0, nextLevelXp - xp),
    progress: Math.max(0, Math.min(1, xpIntoLevel / span)),
  };
}

export function publicPlayerProgression(record: PlayerProgressionRecord): PublicPlayerProgression {
  const games = Object.fromEntries(
    Object.entries(record.games ?? {}).map(([gameId, stats]) => [gameId, cloneGameRecord(stats)]),
  );
  return {
    playerId: record.playerId,
    ...gamerLevelSummary(record.gamerXp),
    xpUpdatedAt: whole(record.xpUpdatedAt),
    games,
    cascade: cloneCascade(record.cascade),
    updatedAt: whole(record.updatedAt),
  };
}

function withXp(record: PlayerProgressionRecord, xpGain: number, now: number): PlayerProgressionRecord {
  const gain = whole(xpGain);
  return {
    ...record,
    gamerXp: whole(record.gamerXp) + gain,
    xpUpdatedAt: gain > 0 ? now : positiveTimestamp(record.xpUpdatedAt, 0),
    updatedAt: now,
  };
}

export function applyCompletedMatch(
  record: PlayerProgressionRecord,
  input: CompletedMatchProgressionInput,
): PlayerProgressionRecord {
  const now = whole(input.updatedAt, Date.now());
  const current = cloneGameRecord(record.games[input.gameId]);
  current.played += 1;
  let xpGain = GAMER_XP_RULES.completedMatch;
  if (input.draw) {
    current.draws += 1;
    xpGain += GAMER_XP_RULES.drawnMatch;
  } else if (input.winnerPlayerId === input.playerId) {
    current.wins += 1;
    xpGain += GAMER_XP_RULES.wonMatch;
  } else {
    current.losses += 1;
  }
  return withXp({
    ...record,
    games: { ...record.games, [input.gameId]: current },
  }, xpGain, now);
}

function normalizedCascadeInput(input: CascadeProgressionInput) {
  const highestCompletedLevel = Math.min(MAX_CASCADE_LEVEL, whole(input.highestCompletedLevel));
  const starsByLevel: Record<string, number> = {};
  if (input.starsByLevel && typeof input.starsByLevel === "object" && !Array.isArray(input.starsByLevel)) {
    for (const [rawLevel, rawStars] of Object.entries(input.starsByLevel as Record<string, unknown>)) {
      const level = Number(rawLevel);
      const stars = Number(rawStars);
      if (!Number.isInteger(level) || level < 1 || level > MAX_CASCADE_LEVEL) continue;
      if (!Number.isFinite(stars)) continue;
      starsByLevel[String(level)] = Math.max(0, Math.min(3, Math.floor(stars)));
    }
  }
  return { highestCompletedLevel, starsByLevel };
}

export function applyCascadeProgression(
  record: PlayerProgressionRecord,
  input: CascadeProgressionInput,
): PlayerProgressionRecord {
  const now = whole(input.updatedAt, Date.now());
  const incoming = normalizedCascadeInput(input);
  const cascade = cloneCascade(record.cascade);
  const nextHighest = Math.max(cascade.highestCompletedLevel, incoming.highestCompletedLevel);
  const newlyCleared = Math.max(0, nextHighest - cascade.highestCompletedLevel);
  cascade.highestCompletedLevel = nextHighest;
  let newBestStars = 0;
  for (const [level, stars] of Object.entries(incoming.starsByLevel)) {
    const previous = whole(cascade.starsByLevel[level]);
    if (stars <= previous) continue;
    newBestStars += stars - previous;
    cascade.starsByLevel[level] = stars;
  }
  cascade.totalBestStars = Object.values(cascade.starsByLevel).reduce((total, stars) => total + stars, 0);
  const xpGain = newlyCleared * GAMER_XP_RULES.cascadeLevelClear
    + newBestStars * GAMER_XP_RULES.cascadeBestStar;
  return withXp({ ...record, cascade }, xpGain, now);
}

export function applyScoredProgression(
  record: PlayerProgressionRecord,
  input: ScoredProgressionInput,
): PlayerProgressionRecord {
  const now = whole(input.updatedAt, Date.now());
  if (input.gameId !== "cascade" || input.modeId !== "weekly-blitz") {
    return { ...record, updatedAt: now };
  }
  const cascade = cloneCascade(record.cascade);
  cascade.weeklyBlitzBestScore = Math.max(cascade.weeklyBlitzBestScore, whole(input.score));
  if (input.firstParticipation) cascade.weeklyBlitzEntries += 1;
  return withXp(
    { ...record, cascade },
    input.firstParticipation ? GAMER_XP_RULES.weeklyBlitzParticipation : 0,
    now,
  );
}
