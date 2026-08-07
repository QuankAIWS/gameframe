import { GAMEFRAME_BOT_PLAYER_ID } from "../agents/gameframe-bot.ts";
import type {
  MonsterMasterAction,
  MonsterMasterState,
} from "../games/monster-master/index.ts";
import { SqliteMatchSnapshotStore } from "../platform/sqlite-match-store.ts";
import { MonsterMasterMatchService } from "../server/monster-master-match-service.ts";
import {
  type DurableRpgEncounterMatchBinding,
  SqliteRpgEncounterMatchBindingStore,
} from "./sqlite-rpg-encounter-match-binding-store.ts";
import { SqliteRpgEncounterStore } from "./sqlite-rpg-encounter-store.ts";

const SUPPORTED_RPG_RULESETS = new Set(["monster-master-rpg", "monster-master-duel"]);
const ENGINE_SERVICE_ID = "gameframe-encounter-engine";

type JsonRecord = Record<string, unknown>;

type BindingPlan = Omit<
  DurableRpgEncounterMatchBinding,
  "protocolVersion" | "mappingMode" | "teamUnitIds" | "participantUnitIds"
> & {
  matchPlayerIds: [string, string];
};

type MatchView = {
  matchId: string;
  playerIds: readonly string[];
  revision: number;
  eventCount: number;
  observation: JsonRecord & {
    status: {
      lifecycle: string;
      winnerPlayerId?: string | null;
      draw?: boolean;
    };
  };
};

/**
 * Durable VM coordinator for RPG-bound Monster Master battles.
 *
 * Campaign/encounter custody, the encounter-to-match binding, and match snapshots
 * share one SQLite database file. Authenticated humans remain independent at the
 * HTTP boundary while a persisted synthetic team seat is used only at tactical
 * authority. Per-match serialization preserves stale-revision arbitration for
 * the single-owner VM service process.
 */
export class SqliteRpgEncounterMatchCoordinator {
  readonly #encounters: SqliteRpgEncounterStore;
  readonly #bindings: SqliteRpgEncounterMatchBindingStore;
  readonly #matchStore: SqliteMatchSnapshotStore<MonsterMasterState, MonsterMasterAction>;
  readonly #matches: MonsterMasterMatchService;
  readonly #clock: () => string;
  readonly #tails = new Map<string, Promise<void>>();

  constructor(input: {
    filePath: string;
    encounters: SqliteRpgEncounterStore;
    clock?: () => string;
  }) {
    if (!input?.encounters) throw new TypeError("encounters is required");
    if (typeof input.filePath !== "string" || !input.filePath.trim()) {
      throw new TypeError("filePath is required");
    }
    this.#encounters = input.encounters;
    this.#clock = input.clock ?? (() => new Date().toISOString());
    this.#bindings = new SqliteRpgEncounterMatchBindingStore({ filePath: input.filePath });
    this.#matchStore = new SqliteMatchSnapshotStore({
      filePath: input.filePath,
      clock: this.#clock,
    });
    this.#matches = new MonsterMasterMatchService({ store: this.#matchStore });
  }

  close(): void {
    this.#matchStore.close();
    this.#bindings.close();
  }

  async launchEncounter(
    requestValue: unknown,
    input: { serviceId: string; createdAt: string },
  ): Promise<JsonRecord> {
    const request = record(requestValue, "encounter launch");
    const rulesetId = identifier(request.rulesetId, "rulesetId");
    const plan = SUPPORTED_RPG_RULESETS.has(rulesetId) ? bindingPlan(request) : undefined;
    const launched = this.#encounters.launch(requestValue, input);
    if (!plan) return structuredClone(launched) as JsonRecord;
    const binding = await this.#ensureBinding(plan, input.createdAt);
    return withPlayMetadata(launched as unknown as JsonRecord, binding);
  }

  async getEncounter(
    encounterIdValue: unknown,
    input: { serviceId: string },
  ): Promise<JsonRecord> {
    const encounterId = identifier(encounterIdValue, "encounterId");
    const handle = this.#encounters.get(encounterId, input);
    let binding = this.#bindings.loadByEncounter(encounterId);
    if (!binding) {
      const launch = this.#bindings.loadEncounterLaunch(encounterId);
      if (launch) {
        const rulesetId = identifier(launch.rulesetId, "rulesetId");
        if (SUPPORTED_RPG_RULESETS.has(rulesetId)) {
          binding = await this.#ensureBinding(bindingPlan(launch), this.#clock());
        }
      }
    }
    return binding
      ? withPlayMetadata(handle as unknown as JsonRecord, binding)
      : structuredClone(handle) as JsonRecord;
  }

  async viewMatchForPlayer(matchIdValue: unknown, playerIdValue: unknown): Promise<JsonRecord> {
    const matchId = identifier(matchIdValue, "matchId");
    const playerId = identifier(playerIdValue, "playerId");
    return await this.#serialize(matchId, async () => {
      const binding = await this.#bindingForMatch(matchId);
      requireAuthorizedPlayer(binding, playerId);
      const view = asMatchView(await this.#matches.view(matchId, binding.playerTeamSeatId));
      await this.#synchronize(binding, view);
      return withTeamControlProjection(view, binding, playerId);
    });
  }

  async submitMatchActionForPlayer(input: {
    matchId: string;
    playerId: string;
    actionId: string;
    expectedRevision: number;
    action: unknown;
  }): Promise<JsonRecord> {
    const matchId = identifier(input.matchId, "matchId");
    const playerId = identifier(input.playerId, "playerId");
    return await this.#serialize(matchId, async () => {
      const binding = await this.#bindingForMatch(matchId);
      requireAuthorizedPlayer(binding, playerId);
      const view = asMatchView(await this.#matches.submitAction({
        matchId,
        playerId: binding.playerTeamSeatId,
        actionId: identifier(input.actionId, "actionId"),
        expectedRevision: integer(input.expectedRevision, "expectedRevision", 0),
        action: input.action as MonsterMasterAction,
      }));
      await this.#synchronize(binding, view);
      return withTeamControlProjection(view, binding, playerId);
    });
  }

  async #bindingForMatch(matchId: string): Promise<DurableRpgEncounterMatchBinding> {
    const existing = this.#bindings.loadByMatch(matchId);
    if (existing) return existing;
    if (!matchId.startsWith("rpg:")) {
      throw failure("match_not_found", `Unknown RPG match: ${matchId}`, 404);
    }
    const encounterId = identifier(matchId.slice(4), "encounterId");
    const launch = this.#bindings.loadEncounterLaunch(encounterId);
    if (!launch) throw failure("match_not_found", `Unknown RPG match: ${matchId}`, 404);
    const rulesetId = identifier(launch.rulesetId, "rulesetId");
    if (!SUPPORTED_RPG_RULESETS.has(rulesetId)) {
      throw failure("match_not_found", `Encounter ${encounterId} has no playable RPG match.`, 404);
    }
    return await this.#ensureBinding(bindingPlan(launch), this.#clock());
  }

  async #ensureBinding(plan: BindingPlan, timestamp: string): Promise<DurableRpgEncounterMatchBinding> {
    return await this.#serialize(plan.matchId, async () => {
      const existing = this.#bindings.loadByEncounter(plan.encounterId);
      if (existing) {
        assertBindingMatchesPlan(existing, plan);
        const view = await this.#ensureMatch(plan);
        assertUnitMappingMatches(existing, view);
        return existing;
      }

      const view = await this.#ensureMatch(plan);
      const teamUnitIds = teamUnits(view, plan);
      const participantUnitIds = Object.fromEntries(
        plan.participants.map((participant) => [
          participant.participantId,
          [...(teamUnitIds[participant.teamId] ?? [])],
        ]),
      );
      return this.#bindings.saveExact({
        protocolVersion: 1,
        encounterId: plan.encounterId,
        campaignId: plan.campaignId,
        rulesetId: plan.rulesetId,
        gameId: plan.gameId,
        matchId: plan.matchId,
        authorizedPlayerIds: [...plan.authorizedPlayerIds],
        playerTeamId: plan.playerTeamId,
        oppositionTeamId: plan.oppositionTeamId,
        playerTeamSeatId: plan.playerTeamSeatId,
        participants: structuredClone(plan.participants),
        objectives: structuredClone(plan.objectives),
        mappingMode: "shared-team-roster",
        teamUnitIds,
        participantUnitIds,
      }, timestamp);
    });
  }

  async #ensureMatch(plan: BindingPlan): Promise<MatchView> {
    try {
      return asMatchView(await this.#matches.createMatch(plan.matchPlayerIds, plan.matchId));
    } catch (error) {
      if (errorCode(error) !== "match_exists") throw error;
    }
    const recovered = asMatchView(await this.#matches.view(plan.matchId, plan.playerTeamSeatId));
    if (
      recovered.playerIds.length !== plan.matchPlayerIds.length
      || recovered.playerIds.some((playerId, index) => playerId !== plan.matchPlayerIds[index])
    ) {
      throw failure(
        "encounter-match-conflict",
        `Encounter ${plan.encounterId} is bound to a different tactical match.`,
        409,
      );
    }
    return recovered;
  }

  async #synchronize(binding: DurableRpgEncounterMatchBinding, view: MatchView): Promise<void> {
    if (view.observation.status.lifecycle === "active") return;
    const completion = {
      protocolVersion: 2,
      completionId: `completion:${binding.encounterId}`,
      encounterId: binding.encounterId,
      outcome: terminalOutcome(binding, view, this.#clock()),
    };
    this.#encounters.complete(binding.encounterId, completion, {
      serviceId: ENGINE_SERVICE_ID,
      completedAt: this.#clock(),
    });
  }

  async #serialize<T>(matchId: string, work: () => Promise<T>): Promise<T> {
    const previous = this.#tails.get(matchId) ?? Promise.resolve();
    const result = previous.then(work, work);
    const tail = result.then(() => undefined, () => undefined);
    this.#tails.set(matchId, tail);
    try {
      return await result;
    } finally {
      if (this.#tails.get(matchId) === tail) this.#tails.delete(matchId);
    }
  }
}

function bindingPlan(request: JsonRecord): BindingPlan {
  const encounterId = identifier(request.encounterId, "encounterId");
  const campaignId = identifier(request.campaignId, "campaignId");
  const rulesetId = identifier(request.rulesetId, "rulesetId");
  const participants = array(request.participants, "participants").map((value, index) => {
    const participant = record(value, `participants[${index}]`);
    const controller = record(participant.controller, `participants[${index}].controller`);
    const kind = requiredText(controller.kind, `participants[${index}].controller.kind`);
    if (kind !== "player" && kind !== "runtime") {
      throw failure("unsupported-encounter-roster", `Unsupported participant controller ${kind}.`, 400);
    }
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
  });
  const objectives = array(request.objectives, "objectives").map((value, index) => {
    const objective = record(value, `objectives[${index}]`);
    return { objectiveId: identifier(objective.objectiveId, `objectives[${index}].objectiveId`) };
  });
  const playerParticipants = participants.filter((participant) => participant.controller.kind === "player");
  const authorizedPlayerIds = unique(playerParticipants.flatMap((participant) => (
    participant.controller.playerId ? [participant.controller.playerId] : []
  )));
  if (authorizedPlayerIds.length === 0) {
    throw failure(
      "unsupported-encounter-roster",
      "Monster Master RPG encounters require at least one player-controlled participant.",
      400,
    );
  }
  const playerTeamIds = unique(playerParticipants.map((participant) => participant.teamId));
  if (playerTeamIds.length !== 1) {
    throw failure(
      "unsupported-encounter-roster",
      "Player-controlled Monster Master participants must cooperate on one tactical team.",
      400,
    );
  }
  const playerTeamId = playerTeamIds[0]!;
  const oppositionTeamIds = unique(
    participants.map((participant) => participant.teamId).filter((teamId) => teamId !== playerTeamId),
  );
  if (oppositionTeamIds.length !== 1) {
    throw failure(
      "unsupported-encounter-roster",
      "The current Monster Master RPG adapter requires exactly one opposition team.",
      400,
    );
  }
  const playerTeamSeatId = rpgEncounterTeamSeatId(encounterId);
  return {
    encounterId,
    campaignId,
    rulesetId,
    gameId: "monster-master-duel",
    matchId: rpgEncounterMatchId(encounterId),
    authorizedPlayerIds,
    playerTeamId,
    oppositionTeamId: oppositionTeamIds[0]!,
    playerTeamSeatId,
    participants,
    objectives,
    matchPlayerIds: [playerTeamSeatId, GAMEFRAME_BOT_PLAYER_ID],
  };
}

export function rpgEncounterMatchId(encounterIdValue: unknown): string {
  return `rpg:${identifier(encounterIdValue, "encounterId")}`;
}

export function rpgEncounterTeamSeatId(encounterIdValue: unknown): string {
  return `rpg-team:${identifier(encounterIdValue, "encounterId")}`;
}

function withPlayMetadata(
  handle: JsonRecord,
  binding: DurableRpgEncounterMatchBinding,
): JsonRecord {
  return {
    ...structuredClone(handle),
    play: {
      gameId: binding.gameId,
      matchId: binding.matchId,
      href: `/monster-master.html?match=${encodeURIComponent(binding.matchId)}&campaign=${encodeURIComponent(binding.campaignId)}`,
      control: {
        mode: "shared-team",
        mappingMode: binding.mappingMode,
        teamId: binding.playerTeamId,
        playerIds: [...binding.authorizedPlayerIds],
        teamUnitIds: [...(binding.teamUnitIds[binding.playerTeamId] ?? [])],
      },
    },
  };
}

function withTeamControlProjection(
  view: MatchView,
  binding: DurableRpgEncounterMatchBinding,
  playerId: string,
): JsonRecord {
  const raw = { gameId: binding.gameId, ...structuredClone(view) } as JsonRecord;
  const aliased = aliasExactIdentity(raw, binding.playerTeamSeatId, playerId) as JsonRecord;
  const controlledParticipantIds = binding.participants
    .filter((participant) => participant.controller.kind === "player"
      && participant.controller.playerId === playerId)
    .map((participant) => participant.participantId);
  const controlledUnitIds = unique(controlledParticipantIds.flatMap(
    (participantId) => binding.participantUnitIds[participantId] ?? [],
  ));
  return {
    ...aliased,
    rpgControl: {
      encounterId: binding.encounterId,
      campaignId: binding.campaignId,
      mode: "shared-team",
      mappingMode: binding.mappingMode,
      teamId: binding.playerTeamId,
      playerId,
      teamPlayerIds: [...binding.authorizedPlayerIds],
      controlledParticipantIds,
      controlledUnitIds,
    },
  };
}

function teamUnits(view: MatchView, plan: BindingPlan): Record<string, string[]> {
  const rosters = record(view.observation.rosters, "observation.rosters");
  return {
    [plan.playerTeamId]: unitIds(rosters[plan.playerTeamSeatId]),
    [plan.oppositionTeamId]: unitIds(rosters[GAMEFRAME_BOT_PLAYER_ID]),
  };
}

function assertUnitMappingMatches(
  binding: DurableRpgEncounterMatchBinding,
  view: MatchView,
): void {
  const plan: BindingPlan = {
    encounterId: binding.encounterId,
    campaignId: binding.campaignId,
    rulesetId: binding.rulesetId,
    gameId: binding.gameId,
    matchId: binding.matchId,
    authorizedPlayerIds: binding.authorizedPlayerIds,
    playerTeamId: binding.playerTeamId,
    oppositionTeamId: binding.oppositionTeamId,
    playerTeamSeatId: binding.playerTeamSeatId,
    participants: binding.participants,
    objectives: binding.objectives,
    matchPlayerIds: [binding.playerTeamSeatId, GAMEFRAME_BOT_PLAYER_ID],
  };
  const current = teamUnits(view, plan);
  if (JSON.stringify(current) !== JSON.stringify(binding.teamUnitIds)) {
    throw failure(
      "encounter-match-conflict",
      `Encounter ${binding.encounterId} authoritative unit mapping changed after persistence.`,
      409,
    );
  }
}

function assertBindingMatchesPlan(
  binding: DurableRpgEncounterMatchBinding,
  plan: BindingPlan,
): void {
  const comparable = {
    encounterId: binding.encounterId,
    campaignId: binding.campaignId,
    rulesetId: binding.rulesetId,
    gameId: binding.gameId,
    matchId: binding.matchId,
    authorizedPlayerIds: binding.authorizedPlayerIds,
    playerTeamId: binding.playerTeamId,
    oppositionTeamId: binding.oppositionTeamId,
    playerTeamSeatId: binding.playerTeamSeatId,
    participants: binding.participants,
    objectives: binding.objectives,
  };
  const expected = {
    encounterId: plan.encounterId,
    campaignId: plan.campaignId,
    rulesetId: plan.rulesetId,
    gameId: plan.gameId,
    matchId: plan.matchId,
    authorizedPlayerIds: plan.authorizedPlayerIds,
    playerTeamId: plan.playerTeamId,
    oppositionTeamId: plan.oppositionTeamId,
    playerTeamSeatId: plan.playerTeamSeatId,
    participants: plan.participants,
    objectives: plan.objectives,
  };
  if (JSON.stringify(comparable) !== JSON.stringify(expected)) {
    throw failure(
      "encounter-match-conflict",
      `Encounter ${plan.encounterId} durable binding conflicts with its launch request.`,
      409,
    );
  }
}

function terminalOutcome(
  binding: DurableRpgEncounterMatchBinding,
  view: MatchView,
  completedAt: string,
): JsonRecord {
  const winnerPlayerId = typeof view.observation.status.winnerPlayerId === "string"
    ? view.observation.status.winnerPlayerId
    : undefined;
  const draw = view.observation.status.draw === true || !winnerPlayerId;
  const result = draw
    ? "draw"
    : winnerPlayerId === binding.playerTeamSeatId
      ? "victory"
      : "defeat";
  const winnerTeamId = result === "victory"
    ? binding.playerTeamId
    : result === "defeat"
      ? binding.oppositionTeamId
      : undefined;
  return {
    kind: "encounter.terminal_outcome",
    result,
    ...(winnerTeamId ? { winnerTeamId } : {}),
    objectiveResults: binding.objectives.map((objective) => ({
      objectiveId: objective.objectiveId,
      status: result === "victory" ? "completed" : result === "defeat" ? "failed" : "partial",
    })),
    participantResults: binding.participants.map((participant) => ({
      participantId: participant.participantId,
      status: result === "draw"
        ? "active"
        : participant.teamId === winnerTeamId
          ? "active"
          : "defeated",
      conditions: result !== "draw" && participant.teamId !== winnerTeamId ? ["defeated"] : [],
      resourceChanges: {},
    })),
    rewards: [],
    ruleset: { id: binding.rulesetId, revision: 1 },
    commit: {
      matchId: binding.matchId,
      matchRevision: view.revision,
      eventCount: view.eventCount,
      completedAt,
    },
  };
}

function requireAuthorizedPlayer(binding: DurableRpgEncounterMatchBinding, playerId: string): void {
  if (binding.authorizedPlayerIds.includes(playerId)) return;
  throw failure(
    "forbidden",
    "The authenticated player is not authorized to control this encounter team.",
    403,
  );
}

function unitIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const id = String((entry as JsonRecord).id ?? "").trim();
    return id ? [id] : [];
  });
}

function asMatchView(value: unknown): MatchView {
  const view = record(value, "match view");
  const observation = record(view.observation, "match observation");
  const status = record(observation.status, "match status");
  return {
    matchId: identifier(view.matchId, "matchId"),
    playerIds: array(view.playerIds, "playerIds").map((playerId, index) =>
      identifier(playerId, `playerIds[${index}]`)
    ),
    revision: integer(view.revision, "revision", 0),
    eventCount: integer(view.eventCount, "eventCount", 0),
    observation: {
      ...structuredClone(observation),
      status: {
        lifecycle: requiredText(status.lifecycle, "status.lifecycle"),
        ...(typeof status.winnerPlayerId === "string" ? { winnerPlayerId: status.winnerPlayerId } : {}),
        ...(typeof status.draw === "boolean" ? { draw: status.draw } : {}),
      },
    },
  };
}

function aliasExactIdentity(value: unknown, from: string, to: string): unknown {
  if (value === from) return to;
  if (Array.isArray(value)) return value.map((entry) => aliasExactIdentity(entry, from, to));
  if (!value || typeof value !== "object") return value;
  const output: JsonRecord = {};
  for (const [key, nested] of Object.entries(value as JsonRecord)) {
    output[key === from ? to : key] = aliasExactIdentity(nested, from, to);
  }
  return output;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw failure("invalid-input", `${label} must be a non-empty array.`, 400);
  }
  return value;
}

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw failure("invalid-input", `${label} must be an object.`, 400);
  }
  return value as JsonRecord;
}

function identifier(value: unknown, label: string): string {
  const text = requiredText(value, label);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(text)) {
    throw failure("invalid-input", `${label} is invalid.`, 400);
  }
  return text;
}

function requiredText(value: unknown, label: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw failure("invalid-input", `${label} is required.`, 400);
  return text;
}

function integer(value: unknown, label: string, minimum: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) {
    throw failure("invalid-input", `${label} must be an integer >= ${minimum}.`, 400);
  }
  return value;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  return typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : undefined;
}

function failure(code: string, message: string, status: number): Error {
  return Object.assign(new Error(message), { code, status, retryable: false });
}
