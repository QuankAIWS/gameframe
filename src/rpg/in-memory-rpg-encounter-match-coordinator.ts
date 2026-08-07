import { GAMEFRAME_BOT_PLAYER_ID } from "../agents/gameframe-bot.ts";
import type { RpgPrincipal } from "./in-memory-rpg-service.ts";

const RPG_RUNTIME_SERVICE_ID = "rpg-gm-runtime";
const ENCOUNTER_ENGINE_SERVICE_ID = "gameframe-encounter-engine";
const SUPPORTED_RPG_RULESETS = new Set([
  "monster-master-rpg",
  "monster-master-duel",
]);

type JsonRecord = Record<string, unknown>;

type RpgEncounterService = {
  launchEncounter(request: unknown, principal: RpgPrincipal): Promise<unknown>;
  completeEncounter(
    encounterId: unknown,
    request: unknown,
    principal: RpgPrincipal,
  ): Promise<unknown>;
  getEncounter(encounterId: unknown, principal: RpgPrincipal): Promise<unknown>;
};

type MatchView = {
  gameId: string;
  matchId: string;
  playerIds: readonly string[];
  revision: number;
  eventCount: number;
  observation: {
    status: {
      lifecycle: string;
      winnerPlayerId?: string | null;
      draw?: boolean;
    };
  };
};

type MatchService = {
  createMatch(
    gameId: string,
    playerIds: readonly string[],
    requestedMatchId?: string,
  ): Promise<unknown>;
  view(matchId: string, playerId: string): Promise<unknown>;
};

type EncounterParticipant = {
  participantId: string;
  controller: { kind: string; playerId?: string };
  teamId: string;
};

type EncounterObjective = {
  objectiveId: string;
};

type EncounterBinding = {
  encounterId: string;
  campaignId: string;
  rulesetId: string;
  gameId: "monster-master-duel";
  matchId: string;
  playerIds: readonly string[];
  authorizedPlayerIds: readonly string[];
  primaryPlayerId: string;
  participants: EncounterParticipant[];
  objectives: EncounterObjective[];
  completionRequest?: JsonRecord;
};

/**
 * Node-local campaign-to-battle adapter.
 *
 * RPG GM Runtime owns encounter intent, GameFrame owns battle legality, and the
 * built-in Monster Master BattleBot supplies the temporary deterministic enemy
 * seat. The BattleBot is a built-in GameFrame test participant, not an external
 * agent or the Dungeon Master. This adapter gives a supported single-player
 * encounter one stable match, exposes only participant-authorized play
 * metadata, and commits the terminal match result through encounter authority.
 */
export class InMemoryRpgEncounterMatchCoordinator {
  readonly #rpg: RpgEncounterService;
  readonly #matches: MatchService;
  readonly #clock: () => string;
  readonly #bindingsByEncounter = new Map<string, EncounterBinding>();
  readonly #bindingsByMatch = new Map<string, EncounterBinding>();

  constructor(input: {
    rpg: RpgEncounterService;
    matches: MatchService;
    clock?: () => string;
  }) {
    if (!input?.rpg) throw new TypeError("rpg service is required");
    if (!input.matches) throw new TypeError("match service is required");
    this.#rpg = input.rpg;
    this.#matches = input.matches;
    this.#clock = input.clock ?? (() => new Date().toISOString());
  }

  async launchEncounter(requestValue: unknown, principal: RpgPrincipal): Promise<unknown> {
    const request = normalizeLaunch(requestValue);
    const binding = SUPPORTED_RPG_RULESETS.has(request.rulesetId)
      ? this.#bindingsByEncounter.get(request.encounterId) ?? this.#binding(request)
      : undefined;
    const launched = await this.#rpg.launchEncounter(requestValue, principal);
    if (!binding) return launched;

    await this.#ensureMatch(binding);
    this.#bindingsByEncounter.set(binding.encounterId, binding);
    this.#bindingsByMatch.set(binding.matchId, binding);
    return withPlayMetadata(launched, binding);
  }

  async getEncounterForPrincipal(
    encounterIdValue: unknown,
    principal: RpgPrincipal,
  ): Promise<unknown> {
    const encounterId = identifier(encounterIdValue, "encounterId");
    if (principal.kind === "runtime") {
      return await this.#rpg.getEncounter(encounterId, principal);
    }
    const binding = this.#bindingsByEncounter.get(encounterId);
    if (!binding || !binding.authorizedPlayerIds.includes(principal.playerId)) {
      throw failure(
        "forbidden",
        "The authenticated player is not a participant in this encounter.",
        403,
      );
    }
    const handle = await this.#rpg.getEncounter(encounterId, {
      kind: "runtime",
      serviceId: RPG_RUNTIME_SERVICE_ID,
    });
    return withPlayMetadata(handle, binding);
  }

  async synchronizeMatch(viewValue: unknown): Promise<void> {
    const view = normalizeMatchView(viewValue);
    const binding = this.#bindingsByMatch.get(view.matchId);
    if (!binding || view.observation.status.lifecycle === "active") return;

    const completion = binding.completionRequest ?? {
      protocolVersion: 2,
      completionId: `completion:${binding.encounterId}`,
      encounterId: binding.encounterId,
      outcome: terminalOutcome(binding, view, this.#clock()),
    };
    binding.completionRequest = structuredClone(completion);
    await this.#rpg.completeEncounter(
      binding.encounterId,
      completion,
      { kind: "runtime", serviceId: ENCOUNTER_ENGINE_SERVICE_ID },
    );
  }

  #binding(request: ReturnType<typeof normalizeLaunch>): EncounterBinding {
    const playerIds = [...new Set(
      request.participants
        .filter((participant) => participant.controller.kind === "player")
        .map((participant) => participant.controller.playerId)
        .filter((value): value is string => Boolean(value)),
    )];
    if (playerIds.length !== 1) {
      throw failure(
        "unsupported-encounter-roster",
        "The initial Monster Master RPG battle adapter requires exactly one player-controlled trainer. Cooperative encounters require a team-aware battle engine.",
        400,
      );
    }
    const matchPlayers = [playerIds[0]!, GAMEFRAME_BOT_PLAYER_ID];
    return {
      encounterId: request.encounterId,
      campaignId: request.campaignId,
      rulesetId: request.rulesetId,
      gameId: "monster-master-duel",
      matchId: rpgEncounterMatchId(request.encounterId),
      playerIds: matchPlayers,
      authorizedPlayerIds: playerIds,
      primaryPlayerId: playerIds[0]!,
      participants: request.participants,
      objectives: request.objectives,
    };
  }

  async #ensureMatch(binding: EncounterBinding): Promise<void> {
    try {
      await this.#matches.createMatch(
        binding.gameId,
        binding.playerIds,
        binding.matchId,
      );
      return;
    } catch (error) {
      if (errorCode(error) !== "match_exists") throw error;
    }

    const recovered = normalizeMatchView(
      await this.#matches.view(binding.matchId, binding.primaryPlayerId),
    );
    if (
      recovered.gameId !== binding.gameId
      || recovered.playerIds.length !== binding.playerIds.length
      || recovered.playerIds.some((playerId, index) => playerId !== binding.playerIds[index])
    ) {
      throw failure(
        "encounter-match-conflict",
        `Encounter ${binding.encounterId} is bound to a different match.`,
        409,
      );
    }
  }
}

export function rpgEncounterMatchId(encounterIdValue: unknown): string {
  return `rpg:${identifier(encounterIdValue, "encounterId")}`;
}

function withPlayMetadata(value: unknown, binding: EncounterBinding): JsonRecord {
  const handle = record(value, "encounter handle");
  return {
    ...structuredClone(handle),
    play: {
      gameId: binding.gameId,
      matchId: binding.matchId,
      href: `/monster-master.html?match=${encodeURIComponent(binding.matchId)}&campaign=${encodeURIComponent(binding.campaignId)}`,
    },
  };
}

function terminalOutcome(
  binding: EncounterBinding,
  view: MatchView,
  completedAt: string,
): JsonRecord {
  const winnerPlayerId = typeof view.observation.status.winnerPlayerId === "string"
    ? view.observation.status.winnerPlayerId
    : undefined;
  const draw = view.observation.status.draw === true || !winnerPlayerId;
  const playerParticipant = binding.participants.find(
    (participant) => participant.controller.kind === "player"
      && participant.controller.playerId === binding.primaryPlayerId,
  );
  if (!playerParticipant) {
    throw failure(
      "encounter-participant-missing",
      "The completed encounter has no primary player participant.",
      500,
    );
  }
  const opposition = binding.participants.find(
    (participant) => participant.teamId === "team:opposition",
  ) ?? binding.participants.find(
    (participant) => participant.teamId !== playerParticipant.teamId,
  );
  const result = draw
    ? "draw"
    : winnerPlayerId === binding.primaryPlayerId
      ? "victory"
      : "defeat";
  const winnerTeamId = result === "victory"
    ? playerParticipant.teamId
    : result === "defeat"
      ? opposition?.teamId
      : undefined;

  return {
    kind: "encounter.terminal_outcome",
    result,
    ...(winnerTeamId ? { winnerTeamId } : {}),
    objectiveResults: binding.objectives.map((objective) => ({
      objectiveId: objective.objectiveId,
      status: result === "victory"
        ? "completed"
        : result === "defeat"
          ? "failed"
          : "partial",
    })),
    participantResults: binding.participants.map((participant) => {
      const status = participantStatus(
        participant.teamId,
        playerParticipant.teamId,
        opposition?.teamId,
        result,
      );
      return {
        participantId: participant.participantId,
        status,
        ...(status === "withdrawn" ? {} : { healthRemaining: status === "defeated" ? 0 : 1 }),
        conditions: status === "defeated" ? ["defeated"] : [],
        resourceChanges: {},
      };
    }),
    rewards: [],
    ruleset: { id: binding.rulesetId, revision: 1 },
    commit: {
      matchId: view.matchId,
      matchRevision: view.revision,
      eventCount: view.eventCount,
      completedAt,
    },
  };
}

function participantStatus(
  teamId: string,
  playerTeamId: string,
  oppositionTeamId: string | undefined,
  result: "victory" | "defeat" | "draw",
): "active" | "defeated" | "withdrawn" {
  if (result === "draw") return "active";
  if (result === "victory") {
    return oppositionTeamId && teamId === oppositionTeamId ? "defeated" : "active";
  }
  if (teamId === playerTeamId) return "defeated";
  if (oppositionTeamId && teamId === oppositionTeamId) return "active";
  return "withdrawn";
}

function normalizeLaunch(value: unknown): {
  encounterId: string;
  campaignId: string;
  rulesetId: string;
  participants: EncounterParticipant[];
  objectives: EncounterObjective[];
} {
  const input = record(value, "encounter launch request");
  return {
    encounterId: identifier(input.encounterId, "encounterId"),
    campaignId: identifier(input.campaignId, "campaignId"),
    rulesetId: identifier(input.rulesetId, "rulesetId"),
    participants: array(input.participants, "participants").map((value, index) => {
      const participant = record(value, `participants[${index}]`);
      const controller = record(participant.controller, `participants[${index}].controller`);
      const kind = String(controller.kind ?? "");
      return {
        participantId: identifier(participant.participantId, `participants[${index}].participantId`),
        controller: {
          kind,
          ...(kind === "player"
            ? { playerId: identifier(controller.playerId, `participants[${index}].controller.playerId`) }
            : {}),
        },
        teamId: identifier(participant.teamId, `participants[${index}].teamId`),
      };
    }),
    objectives: array(input.objectives, "objectives").map((value, index) => {
      const objective = record(value, `objectives[${index}]`);
      return {
        objectiveId: identifier(objective.objectiveId, `objectives[${index}].objectiveId`),
      };
    }),
  };
}

function normalizeMatchView(value: unknown): MatchView {
  const input = record(value, "match view");
  const observation = record(input.observation, "match observation");
  const status = record(observation.status, "match status");
  return {
    gameId: String(input.gameId ?? ""),
    matchId: identifier(input.matchId, "matchId"),
    playerIds: array(input.playerIds, "playerIds").map((value, index) =>
      identifier(value, `playerIds[${index}]`)
    ),
    revision: nonNegativeInteger(input.revision, "revision"),
    eventCount: nonNegativeInteger(input.eventCount, "eventCount"),
    observation: {
      status: {
        lifecycle: String(status.lifecycle ?? ""),
        ...(typeof status.winnerPlayerId === "string"
          ? { winnerPlayerId: status.winnerPlayerId }
          : {}),
        ...(typeof status.draw === "boolean" ? { draw: status.draw } : {}),
      },
    },
  };
}

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw failure("invalid-command", `${label} must be an object.`, 400);
  }
  return value as JsonRecord;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw failure("invalid-command", `${label} must be an array.`, 400);
  }
  return value;
}

function identifier(value: unknown, label: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > 240) {
    throw failure("invalid-command", `${label} must be a bounded identifier.`, 400);
  }
  return normalized;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw failure("invalid-command", `${label} must be a non-negative integer.`, 400);
  }
  return Number(value);
}

function errorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function failure(code: string, message: string, status: number): Error {
  return Object.assign(new Error(message), { code, status });
}
