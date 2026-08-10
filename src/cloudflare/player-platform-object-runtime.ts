import { errorResponse, json, readJson } from "./http-utils.ts";
import type { DurableStorageLike } from "./runtime-contracts.ts";

const DIRECTORY_KEY = "gameframe:player-directory:v1";
const FEED_KEY = "gameframe:player-feed:v1";
const MAX_DIRECTORY_PLAYERS = 250;
const MAX_MATCH_HISTORY = 200;
const MAX_INVITATION_HISTORY = 100;

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

interface PlayerDirectoryRecord {
  version: 1;
  players: GameFramePlayerProfile[];
}

interface PlayerFeedRecord {
  version: 1;
  matches: PlayerMatchSummary[];
  invitations: PlayerInvitationSummary[];
}

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
      if (request.method === "POST" && url.pathname === "/player/match") {
        return json(200, await this.#upsertMatch(await readJson(request)));
      }
      if (request.method === "POST" && url.pathname === "/player/invitation") {
        return json(200, await this.#upsertInvitation(await readJson(request)));
      }
      if (request.method === "GET" && url.pathname === "/player/feed") {
        return json(200, await this.#feed());
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

  async #upsertMatch(body: Record<string, unknown>) {
    const summary = matchSummary(body);
    const record = await this.#storage.get<PlayerFeedRecord>(FEED_KEY) ?? { version: 1, matches: [], invitations: [] };
    const matches = [summary, ...record.matches.filter((match) => match.matchId !== summary.matchId)]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_MATCH_HISTORY);
    await this.#storage.put(FEED_KEY, { ...record, matches });
    return summary;
  }

  async #upsertInvitation(body: Record<string, unknown>) {
    const incoming = invitationSummary(body);
    const record = await this.#storage.get<PlayerFeedRecord>(FEED_KEY) ?? { version: 1, matches: [], invitations: [] };
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

  async #feed() {
    const record = await this.#storage.get<PlayerFeedRecord>(FEED_KEY) ?? { version: 1, matches: [], invitations: [] };
    const now = Math.floor(Date.now() / 1000);
    return {
      matches: record.matches.map((match) => ({ ...match, playerIds: [...match.playerIds] })),
      invitations: record.invitations.map((invitation) => ({
        ...invitation,
        status: invitation.status === "pending" && invitation.expiresAt <= now ? "expired" : invitation.status,
      })),
    };
  }
}
