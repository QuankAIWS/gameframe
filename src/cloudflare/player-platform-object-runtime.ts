import { errorResponse, json, readJson } from "./http-utils.ts";
import {
  applyCascadeProgression,
  applyCompletedMatch,
  applyScoredProgression,
  emptyPlayerProgression,
  publicPlayerProgression,
  type PlayerProgressionRecord,
  type PublicPlayerProgression,
} from "./player-progression.ts";
import type { DurableStorageLike } from "./runtime-contracts.ts";

const DIRECTORY_KEY = "gameframe:player-directory:v1";
const LEADERBOARD_KEY = "gameframe:leaderboard:v1";
const SCORED_LEADERBOARD_KEY = "gameframe:scored-leaderboard:v1";
const FEED_KEY = "gameframe:player-feed:v1";
const PROGRESSION_KEY = "gameframe:player-progression:v1";
const PROGRESSION_DIRECTORY_KEY = "gameframe:player-progression-directory:v1";
const PROGRESSION_MARKER_PREFIX = "gameframe:player-progression-marker:v1:";
const RECENT_ACCOMPLISHMENT_LIMIT = 256;
const MAX_DIRECTORY_PLAYERS = 250;
const MAX_MATCH_HISTORY = 200;
const MAX_INVITATION_HISTORY = 100;
const MAX_LEADERBOARD_MATCHES = 1_000;
const MAX_SCORED_RESULTS = 2_000;
const MAX_FAVORITES = 12;

export interface GameFramePlayerProfile {
  playerId: string;
  displayName: string | null;
  avatarUrl: string | null;
  source: string | null;
  firstSeenAt: number;
  lastSeenAt: number;
}

export interface PlayerMatchSummary {
  matchId: string;
  gameId: string;
  playerIds: string[];
  revision: number;
  activePlayerId: string | null;
  lifecycle: "waiting" | "active" | "completed";
  winnerPlayerId: string | null;
  draw: boolean;
  updatedAt: number;
  resumePath: string;
}

export interface PlayerInvitationSummary {
  invitationId: string;
  gameId: string;
  status: "pending" | "claimed" | "cancelled" | "expired";
  inviter: { playerId: string; displayName: string | null; avatarUrl: string | null };
  claimant: { playerId: string; displayName: string | null; avatarUrl: string | null } | null;
  targetRestricted: boolean;
  issuedAt: number;
  expiresAt: number;
  matchId: string | null;
  claimToken: string | null;
  updatedAt: number;
}

export interface PlayerScoredResult {
  gameId: string;
  modeId: string;
  eventId: string;
  playerId: string;
  score: number;
  metrics: Record<string, number>;
  updatedAt: number;
}

interface PlayerDirectoryRecord {
  version: 1;
  players: GameFramePlayerProfile[];
}

interface LeaderboardMatchSummary {
  matchId: string;
  gameId: string;
  playerIds: string[];
  winnerPlayerId: string | null;
  draw: boolean;
  updatedAt: number;
}

interface LeaderboardRecord {
  version: 1;
  matches: LeaderboardMatchSummary[];
}

interface ScoredLeaderboardRecord {
  version: 1;
  results: PlayerScoredResult[];
}

interface PlayerFeedRecord {
  version: 1;
  matches: PlayerMatchSummary[];
  invitations: PlayerInvitationSummary[];
  favoriteGameIds?: string[];
}

interface ProgressionDirectoryRecord {
  version: 1;
  players: PublicPlayerProgression[];
}

type StoredPlayerProgression = PlayerProgressionRecord & {
  recentAccomplishments?: string[];
};

function boundedText(value: unknown, name: string, maximum = 512): string {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > maximum) {
    throw Object.assign(new Error(`${name} must be non-empty and bounded.`), { code: "player_platform_invalid" });
  }
  return normalized;
}

function nullableText(value: unknown, maximum: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).trim();
  if (!normalized || normalized.length > maximum) {
    throw Object.assign(new Error("Player profile metadata is invalid."), { code: "player_platform_invalid" });
  }
  return normalized;
}

function timestamp(value: unknown, fallback = Date.now()): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : fallback;
}

function boundedScore(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1_000_000_000) {
    throw Object.assign(new Error("Score must be a finite non-negative number."), { code: "player_platform_invalid" });
  }
  return Math.floor(numeric);
}

function scoredMetrics(value: unknown): Record<string, number> {
  if (value === undefined || value === null) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw Object.assign(new Error("Score metrics must be an object."), { code: "player_platform_invalid" });
  }
  const result: Record<string, number> = {};
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>).slice(0, 12)) {
    const key = boundedText(rawKey, "Score metric name", 40);
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric) || Math.abs(numeric) > 1_000_000_000) {
      throw Object.assign(new Error("Score metrics must contain bounded finite numbers."), { code: "player_platform_invalid" });
    }
    result[key] = numeric;
  }
  return result;
}

function directoryProfile(value: Record<string, unknown>): GameFramePlayerProfile {
  const now = timestamp(value.lastSeenAt);
  return {
    playerId: boundedText(value.playerId, "Player ID", 160),
    displayName: nullableText(value.displayName, 100),
    avatarUrl: nullableText(value.avatarUrl, 512),
    source: nullableText(value.source, 40),
    firstSeenAt: timestamp(value.firstSeenAt, now),
    lastSeenAt: now,
  };
}

function matchSummary(value: Record<string, unknown>): PlayerMatchSummary {
  const status = value.status && typeof value.status === "object" && !Array.isArray(value.status)
    ? value.status as Record<string, unknown>
    : {};
  const lifecycle = status.lifecycle === "completed" ? "completed" : status.lifecycle === "waiting" ? "waiting" : "active";
  return {
    matchId: boundedText(value.matchId, "Match ID", 160),
    gameId: boundedText(value.gameId, "Game ID", 80),
    playerIds: Array.isArray(value.playerIds)
      ? value.playerIds.map((playerId) => boundedText(playerId, "Match player ID", 160))
      : [],
    revision: Math.max(0, Math.floor(Number(value.revision) || 0)),
    activePlayerId: nullableText(value.activePlayerId, 160),
    lifecycle,
    winnerPlayerId: nullableText(status.winnerPlayerId, 160),
    draw: Boolean(status.draw),
    updatedAt: timestamp(value.updatedAt),
    resumePath: boundedText(value.resumePath, "Resume path", 512),
  };
}

function leaderboardMatch(value: Record<string, unknown>): LeaderboardMatchSummary {
  const status = value.status && typeof value.status === "object" && !Array.isArray(value.status)
    ? value.status as Record<string, unknown>
    : {};
  if (status.lifecycle !== "completed") {
    throw Object.assign(new Error("Only completed matches belong in the leaderboard read model."), { code: "player_platform_invalid" });
  }
  return {
    matchId: boundedText(value.matchId, "Match ID", 160),
    gameId: boundedText(value.gameId, "Game ID", 80),
    playerIds: Array.isArray(value.playerIds)
      ? value.playerIds.map((playerId) => boundedText(playerId, "Match player ID", 160))
      : [],
    winnerPlayerId: nullableText(status.winnerPlayerId, 160),
    draw: Boolean(status.draw),
    updatedAt: timestamp(value.updatedAt),
  };
}

function scoredResult(value: Record<string, unknown>): PlayerScoredResult {
  return {
    gameId: boundedText(value.gameId, "Scored game ID", 80),
    modeId: boundedText(value.modeId, "Scored mode ID", 80),
    eventId: boundedText(value.eventId, "Scored event ID", 160),
    playerId: boundedText(value.playerId, "Scored player ID", 160),
    score: boundedScore(value.score),
    metrics: scoredMetrics(value.metrics),
    updatedAt: timestamp(value.updatedAt),
  };
}

function invitationSummary(value: Record<string, unknown>): PlayerInvitationSummary {
  const inviter = value.inviter && typeof value.inviter === "object" && !Array.isArray(value.inviter)
    ? value.inviter as Record<string, unknown>
    : {};
  const claimantInput = value.claimant && typeof value.claimant === "object" && !Array.isArray(value.claimant)
    ? value.claimant as Record<string, unknown>
    : null;
  const status = value.status === "claimed" || value.status === "cancelled" || value.status === "expired"
    ? value.status
    : "pending";
  const participant = (input: Record<string, unknown>) => ({
    playerId: boundedText(input.playerId, "Invitation participant ID", 160),
    displayName: nullableText(input.displayName, 100),
    avatarUrl: nullableText(input.avatarUrl, 512),
  });
  return {
    invitationId: boundedText(value.invitationId, "Invitation ID", 160),
    gameId: boundedText(value.gameId, "Game ID", 80),
    status,
    inviter: participant(inviter),
    claimant: claimantInput ? participant(claimantInput) : null,
    targetRestricted: Boolean(value.targetRestricted),
    issuedAt: timestamp(value.issuedAt),
    expiresAt: timestamp(value.expiresAt),
    matchId: nullableText(value.matchId, 160),
    claimToken: nullableText(value.claimToken, 4096),
    updatedAt: timestamp(value.updatedAt),
  };
}

function favoriteGameIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((gameId) => boundedText(gameId, "Favorite game ID", 80)))].slice(0, MAX_FAVORITES);
}

function emptyFeed(): PlayerFeedRecord {
  return { version: 1, matches: [], invitations: [], favoriteGameIds: [] };
}

function markerKey(accomplishmentId: string): string {
  return `${PROGRESSION_MARKER_PREFIX}${accomplishmentId}`;
}

function recentAccomplishments(record: StoredPlayerProgression): string[] {
  return Array.isArray(record.recentAccomplishments)
    ? record.recentAccomplishments.filter((value) => typeof value === "string").slice(-RECENT_ACCOMPLISHMENT_LIMIT)
    : [];
}

export class PlayerPlatformObjectRuntime {
  readonly #storage: DurableStorageLike;
  #tail: Promise<void> = Promise.resolve();

  constructor(storage: DurableStorageLike) {
    this.#storage = storage;
  }

  fetch(request: Request): Promise<Response> {
    const execute = async () => this.#handle(request);
    const result = this.#tail.then(execute, execute);
    this.#tail = result.then(() => undefined, () => undefined);
    return result;
  }

  async #handle(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (request.method === "POST" && url.pathname === "/directory/upsert") {
        return json(200, await this.#upsertDirectory(await readJson(request)));
      }
      if (request.method === "GET" && url.pathname === "/directory/list") {
        return json(200, await this.#listDirectory(String(url.searchParams.get("playerId") ?? "")));
      }
      if (request.method === "POST" && url.pathname === "/directory/match") {
        return json(200, await this.#upsertLeaderboardMatch(await readJson(request)));
      }
      if (request.method === "POST" && url.pathname === "/directory/score") {
        return json(200, await this.#upsertScoredResult(await readJson(request)));
      }
      if (request.method === "POST" && url.pathname === "/directory/progression") {
        return json(200, await this.#upsertDirectoryProgression(await readJson(request)));
      }
      if (request.method === "GET" && url.pathname === "/directory/profile") {
        return json(200, await this.#publicProfile(String(url.searchParams.get("playerId") ?? "")));
      }
      if (request.method === "GET" && url.pathname === "/directory/leaderboard") {
        return json(200, await this.#leaderboard());
      }
      if (request.method === "POST" && url.pathname === "/player/match") {
        return json(200, await this.#upsertMatch(await readJson(request)));
      }
      if (request.method === "POST" && url.pathname === "/player/invitation") {
        return json(200, await this.#upsertInvitation(await readJson(request)));
      }
      if (request.method === "POST" && url.pathname === "/player/preferences") {
        return json(200, await this.#updatePreferences(await readJson(request)));
      }
      if (request.method === "GET" && url.pathname === "/player/feed") {
        return json(200, await this.#feed());
      }
      if (request.method === "GET" && url.pathname === "/player/progression") {
        return json(200, await this.#progression(String(url.searchParams.get("playerId") ?? "")));
      }
      if (request.method === "POST" && url.pathname === "/player/progression/match") {
        return json(200, await this.#recordMatchProgression(await readJson(request)));
      }
      if (request.method === "POST" && url.pathname === "/player/progression/score") {
        return json(200, await this.#recordScoredProgression(await readJson(request)));
      }
      if (request.method === "POST" && url.pathname === "/player/progression/cascade") {
        return json(200, await this.#recordCascadeProgression(await readJson(request)));
      }
      return json(404, { error: "not_found" });
    } catch (error) {
      return errorResponse(error);
    }
  }

  async #upsertDirectory(body: Record<string, unknown>) {
    const incoming = directoryProfile(body);
    const record = await this.#storage.get<PlayerDirectoryRecord>(DIRECTORY_KEY) ?? { version: 1, players: [] };
    const existing = record.players.find((profile) => profile.playerId === incoming.playerId);
    const merged: GameFramePlayerProfile = existing
      ? { ...existing, ...incoming, firstSeenAt: existing.firstSeenAt }
      : incoming;
    const players = [merged, ...record.players.filter((profile) => profile.playerId !== merged.playerId)]
      .sort((left, right) => right.lastSeenAt - left.lastSeenAt)
      .slice(0, MAX_DIRECTORY_PLAYERS);
    await this.#storage.put(DIRECTORY_KEY, { version: 1, players });
    return merged;
  }

  async #listDirectory(viewerPlayerId: string) {
    const viewer = boundedText(viewerPlayerId, "Directory viewer ID", 160);
    const record = await this.#storage.get<PlayerDirectoryRecord>(DIRECTORY_KEY) ?? { version: 1, players: [] };
    return {
      players: record.players
        .filter((profile) => profile.playerId !== viewer && profile.source === "discord")
        .map((profile) => ({ ...profile })),
    };
  }

  async #upsertDirectoryProgression(body: Record<string, unknown>) {
    const playerId = boundedText(body.playerId, "Progression player ID", 160);
    const directory = await this.#storage.get<PlayerDirectoryRecord>(DIRECTORY_KEY) ?? { version: 1, players: [] };
    if (!directory.players.some((profile) => profile.playerId === playerId)) {
      return { stored: false, playerId };
    }
    const incoming = body as unknown as PublicPlayerProgression;
    const record = await this.#storage.get<ProgressionDirectoryRecord>(PROGRESSION_DIRECTORY_KEY) ?? { version: 1, players: [] };
    const players = [
      { ...incoming, playerId },
      ...record.players.filter((entry) => entry.playerId !== playerId),
    ].slice(0, MAX_DIRECTORY_PLAYERS);
    await this.#storage.put(PROGRESSION_DIRECTORY_KEY, { version: 1, players });
    return { stored: true, playerId };
  }

  async #publicProfile(rawPlayerId: string) {
    const playerId = boundedText(rawPlayerId, "Public profile player ID", 160);
    const directory = await this.#storage.get<PlayerDirectoryRecord>(DIRECTORY_KEY) ?? { version: 1, players: [] };
    const profile = directory.players.find((entry) => entry.playerId === playerId);
    if (!profile) {
      throw Object.assign(new Error("Player profile was not found."), { code: "not_found", status: 404 });
    }
    const progressionDirectory = await this.#storage.get<ProgressionDirectoryRecord>(PROGRESSION_DIRECTORY_KEY) ?? { version: 1, players: [] };
    const progression = progressionDirectory.players.find((entry) => entry.playerId === playerId)
      ?? publicPlayerProgression(emptyPlayerProgression(playerId, profile.firstSeenAt));
    return { profile: { ...profile }, progression };
  }

  async #upsertLeaderboardMatch(body: Record<string, unknown>) {
    const summary = leaderboardMatch(body);
    const record = await this.#storage.get<LeaderboardRecord>(LEADERBOARD_KEY) ?? { version: 1, matches: [] };
    const matches = [summary, ...record.matches.filter((match) => match.matchId !== summary.matchId)]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_LEADERBOARD_MATCHES);
    await this.#storage.put(LEADERBOARD_KEY, { version: 1, matches });
    return summary;
  }

  async #upsertScoredResult(body: Record<string, unknown>) {
    const incoming = scoredResult(body);
    const record = await this.#storage.get<ScoredLeaderboardRecord>(SCORED_LEADERBOARD_KEY) ?? { version: 1, results: [] };
    const existing = record.results.find((entry) => (
      entry.gameId === incoming.gameId
      && entry.modeId === incoming.modeId
      && entry.eventId === incoming.eventId
      && entry.playerId === incoming.playerId
    ));
    const improved = !existing || incoming.score > existing.score;
    const entry = improved ? incoming : existing;
    if (improved) {
      const results = [entry, ...record.results.filter((candidate) => !(
        candidate.gameId === incoming.gameId
        && candidate.modeId === incoming.modeId
        && candidate.eventId === incoming.eventId
        && candidate.playerId === incoming.playerId
      ))]
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, MAX_SCORED_RESULTS);
      await this.#storage.put(SCORED_LEADERBOARD_KEY, { version: 1, results });
    }
    return {
      entry: { ...entry, metrics: { ...entry.metrics } },
      improved,
      previousBest: existing?.score ?? null,
    };
  }

  async #leaderboard() {
    const directory = await this.#storage.get<PlayerDirectoryRecord>(DIRECTORY_KEY) ?? { version: 1, players: [] };
    const record = await this.#storage.get<LeaderboardRecord>(LEADERBOARD_KEY) ?? { version: 1, matches: [] };
    const scored = await this.#storage.get<ScoredLeaderboardRecord>(SCORED_LEADERBOARD_KEY) ?? { version: 1, results: [] };
    const progressionDirectory = await this.#storage.get<ProgressionDirectoryRecord>(PROGRESSION_DIRECTORY_KEY) ?? { version: 1, players: [] };
    const profiles = new Map(directory.players.map((profile) => [profile.playerId, profile]));
    const progressions = new Map(progressionDirectory.players.map((progression) => [progression.playerId, progression]));
    const byGame = new Map<string, Map<string, { played: number; wins: number; losses: number; draws: number }>>();

    for (const match of record.matches) {
      const game = byGame.get(match.gameId) ?? new Map();
      byGame.set(match.gameId, game);
      for (const playerId of match.playerIds) {
        if (!profiles.has(playerId)) continue;
        const stats = game.get(playerId) ?? { played: 0, wins: 0, losses: 0, draws: 0 };
        stats.played += 1;
        if (match.draw) stats.draws += 1;
        else if (match.winnerPlayerId === playerId) stats.wins += 1;
        else stats.losses += 1;
        game.set(playerId, stats);
      }
    }

    const scoredGroups = new Map<string, {
      gameId: string;
      modeId: string;
      eventId: string;
      entries: PlayerScoredResult[];
    }>();
    for (const entry of scored.results) {
      const key = `${entry.gameId}\u0000${entry.modeId}\u0000${entry.eventId}`;
      const group = scoredGroups.get(key) ?? {
        gameId: entry.gameId,
        modeId: entry.modeId,
        eventId: entry.eventId,
        entries: [],
      };
      group.entries.push(entry);
      scoredGroups.set(key, group);
    }

    const gamerLevels = directory.players
      .map((profile) => {
        const progression = progressions.get(profile.playerId)
          ?? publicPlayerProgression(emptyPlayerProgression(profile.playerId, profile.firstSeenAt));
        return {
          playerId: profile.playerId,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          ...progression,
        };
      })
      .sort((left, right) => (
        right.gamerXp - left.gamerXp
        || left.xpUpdatedAt - right.xpUpdatedAt
        || left.playerId.localeCompare(right.playerId)
      ));

    return {
      gamerLevels,
      games: [...byGame.entries()].map(([gameId, players]) => ({
        gameId,
        entries: [...players.entries()]
          .map(([playerId, stats]) => {
            const profile = profiles.get(playerId)!;
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
      scoredGames: [...scoredGroups.values()]
        .map((group) => ({
          gameId: group.gameId,
          modeId: group.modeId,
          eventId: group.eventId,
          entries: group.entries
            .map((entry) => {
              const profile = profiles.get(entry.playerId);
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

  async #readStoredProgression(playerId: string): Promise<StoredPlayerProgression> {
    const existing = await this.#storage.get<StoredPlayerProgression>(PROGRESSION_KEY);
    if (!existing || existing.playerId !== playerId) return emptyPlayerProgression(playerId);
    return existing;
  }

  async #progression(rawPlayerId: string) {
    const playerId = boundedText(rawPlayerId, "Progression player ID", 160);
    return publicPlayerProgression(await this.#readStoredProgression(playerId));
  }

  async #applyAccomplishment(
    playerId: string,
    accomplishmentId: string,
    apply: (record: PlayerProgressionRecord) => PlayerProgressionRecord,
  ) {
    const key = markerKey(accomplishmentId);
    const existingMarker = await this.#storage.get<boolean>(key);
    let record = await this.#readStoredProgression(playerId);
    const recent = recentAccomplishments(record);
    if (existingMarker || recent.includes(accomplishmentId)) {
      if (!existingMarker) await this.#storage.put(key, true);
      return { progression: publicPlayerProgression(record), awarded: false };
    }
    const next = apply(record) as StoredPlayerProgression;
    next.recentAccomplishments = [...recent.filter((id) => id !== accomplishmentId), accomplishmentId]
      .slice(-RECENT_ACCOMPLISHMENT_LIMIT);
    await this.#storage.put(PROGRESSION_KEY, next);
    await this.#storage.put(key, true);
    record = next;
    return { progression: publicPlayerProgression(record), awarded: true };
  }

  async #recordMatchProgression(body: Record<string, unknown>) {
    const playerId = boundedText(body.playerId, "Progression player ID", 160);
    const summary = matchSummary(body);
    if (summary.lifecycle !== "completed" || !summary.playerIds.includes(playerId)) {
      return { progression: await this.#progression(playerId), awarded: false };
    }
    return this.#applyAccomplishment(playerId, `match:${summary.matchId}`, (record) => applyCompletedMatch(record, {
      playerId,
      gameId: summary.gameId,
      winnerPlayerId: summary.winnerPlayerId,
      draw: summary.draw,
      updatedAt: summary.updatedAt,
    }));
  }

  async #recordScoredProgression(body: Record<string, unknown>) {
    const playerId = boundedText(body.playerId, "Progression player ID", 160);
    const gameId = boundedText(body.gameId, "Scored game ID", 80);
    const modeId = boundedText(body.modeId, "Scored mode ID", 80);
    const eventId = boundedText(body.eventId, "Scored event ID", 160);
    const score = boundedScore(body.score);
    const now = timestamp(body.updatedAt);
    const accomplishmentId = `score:${gameId}:${modeId}:${eventId}`;
    const marker = await this.#storage.get<boolean>(markerKey(accomplishmentId));
    let record = await this.#readStoredProgression(playerId);
    const recent = recentAccomplishments(record);
    const firstParticipation = !marker && !recent.includes(accomplishmentId);
    const next = applyScoredProgression(record, { gameId, modeId, score, firstParticipation, updatedAt: now }) as StoredPlayerProgression;
    if (firstParticipation) {
      next.recentAccomplishments = [...recent, accomplishmentId].slice(-RECENT_ACCOMPLISHMENT_LIMIT);
    }
    await this.#storage.put(PROGRESSION_KEY, next);
    if (firstParticipation) await this.#storage.put(markerKey(accomplishmentId), true);
    record = next;
    return { progression: publicPlayerProgression(record), awarded: firstParticipation };
  }

  async #recordCascadeProgression(body: Record<string, unknown>) {
    const playerId = boundedText(body.playerId, "Progression player ID", 160);
    const record = await this.#readStoredProgression(playerId);
    const next = applyCascadeProgression(record, {
      highestCompletedLevel: body.highestCompletedLevel,
      starsByLevel: body.starsByLevel,
      updatedAt: timestamp(body.updatedAt),
    }) as StoredPlayerProgression;
    next.recentAccomplishments = recentAccomplishments(record);
    await this.#storage.put(PROGRESSION_KEY, next);
    return publicPlayerProgression(next);
  }

  async #upsertMatch(body: Record<string, unknown>) {
    const summary = matchSummary(body);
    const record = await this.#storage.get<PlayerFeedRecord>(FEED_KEY) ?? emptyFeed();
    const matches = [summary, ...record.matches.filter((match) => match.matchId !== summary.matchId)]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_MATCH_HISTORY);
    await this.#storage.put(FEED_KEY, { ...record, matches });
    return summary;
  }

  async #upsertInvitation(body: Record<string, unknown>) {
    const incoming = invitationSummary(body);
    const record = await this.#storage.get<PlayerFeedRecord>(FEED_KEY) ?? emptyFeed();
    const existing = record.invitations.find((invitation) => invitation.invitationId === incoming.invitationId);
    const summary = existing && !incoming.claimToken
      ? { ...incoming, claimToken: existing.claimToken }
      : incoming;
    const invitations = [summary, ...record.invitations.filter((invitation) => invitation.invitationId !== summary.invitationId)]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_INVITATION_HISTORY);
    await this.#storage.put(FEED_KEY, { ...record, invitations });
    return summary;
  }

  async #updatePreferences(body: Record<string, unknown>) {
    const record = await this.#storage.get<PlayerFeedRecord>(FEED_KEY) ?? emptyFeed();
    const favorites = favoriteGameIds(body.favoriteGameIds);
    const next = { ...record, favoriteGameIds: favorites };
    await this.#storage.put(FEED_KEY, next);
    return { favoriteGameIds: [...favorites] };
  }

  async #feed() {
    const record = await this.#storage.get<PlayerFeedRecord>(FEED_KEY) ?? emptyFeed();
    const now = Math.floor(Date.now() / 1000);
    return {
      matches: record.matches.map((match) => ({ ...match, playerIds: [...match.playerIds] })),
      invitations: record.invitations.map((invitation) => ({
        ...invitation,
        status: invitation.status === "pending" && invitation.expiresAt <= now ? "expired" : invitation.status,
      })),
      favoriteGameIds: [...(record.favoriteGameIds ?? [])],
    };
  }
}
