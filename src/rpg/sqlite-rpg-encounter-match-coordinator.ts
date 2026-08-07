import { GAMEFRAME_BOT_PLAYER_ID } from "../agents/gameframe-bot.ts";
import type {
  MonsterMasterAction,
  MonsterMasterState,
} from "../games/monster-master/index.ts";
import { SqliteMatchSnapshotStore } from "../platform/sqlite-match-store.ts";
import { MonsterMasterMatchService } from "../server/monster-master-match-service.ts";
import {
  materializeMonsterMasterRpgEncounter,
  type MonsterMasterRpgEncounterObjective,
  type MonsterMasterRpgEncounterParticipant,
} from "./monster-master-rpg-encounter-materializer.ts";
import {
  type DurableRpgEncounterMatchBinding,
  SqliteRpgEncounterMatchBindingStore,
} from "./sqlite-rpg-encounter-match-binding-store.ts";
import { SqliteRpgEncounterStore } from "./sqlite-rpg-encounter-store.ts";

// The durable production adapter is for the campaign-family RPG ruleset. A raw
// monster-master-duel encounter remains a generic durable encounter unless it is
// explicitly launched as Monster Master RPG campaign play.
const DURABLE_BOUND_RPG_RULESETS = new Set(["monster-master-rpg"]);
const ENGINE_SERVICE_ID = "gameframe-encounter-engine";

type JsonRecord = Record<string, unknown>;

type BindingPlan = Omit<
  DurableRpgEncounterMatchBinding,
  "protocolVersion" | "mappingMode" | "teamUnitIds" | "participantUnitIds"
> & {
  matchPlayerIds: [string, string];
  initialState: MonsterMasterState;
  teamUnitIds: Record<string, string[]>;
  participantUnitIds: Record<string, string[]>;
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
    const plan = DURABLE_BOUND_RPG_RULESETS.has(rulesetId) ? bindingPlan(request) : undefined;

    // Materialize and validate the exact tactical configuration before durable
    // encounter custody advances. Unsupported package mechanics therefore fail
    // without leaving a half-admitted encounter or a substituted default roster.
    const launched = this.#encounters.launch(requestValue, input);
    if (!plan) return structuredClone(launched) as JsonRecord;

    const binding = await this.#serialize(
      plan.matchId,
      () => this.#ensureBindingUnlocked(plan, input.createdAt),
    );
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
        if (DURABLE_BOUND_RPG_RULESETS.has(rulesetId)) {
          const plan = bindingPlan(launch);
          binding = await this.#serialize(
            plan.matchId,
            () => this.#ensureBindingUnlocked(plan, this.#clock()),
          );
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
      const binding = await this.#bindingForMatchUnlocked(matchId);
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
      const binding = await this.#bindingForMatchUnlocked(matchId);
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

  async #bindingForMatchUnlocked(matchId: string): Promise<DurableRpgEncounterMatchBinding> {
    const existing = this.#bindings.loadByMatch(matchId);
    if (existing) return existing;
    if (!matchId.startsWith("rpg:")) {
      throw failure("match_not_found", `Unknown RPG match: ${matchId}`, 404);
    }
    const encounterId = identifier(matchId.slice(4), "encounterId");
    const launch = this.#bindings.loadEncounterLaunch(encounterId);
    if (!launch) throw failure("match_not_found", `Unknown RPG match: ${matchId}`, 404);
    const rulesetId = identifier(launch.rulesetId, "rulesetId");
    if (!DURABLE_BOUND_RPG_RULESETS.has(rulesetId)) {
      throw failure("match_not_found", `Encounter ${encounterId} has no playable RPG match.`, 404);
    }
    return await this.#ensureBindingUnlocked(bindingPlan(launch), this.#clock());
  }

  async #ensureBindingUnlocked(
    plan: BindingPlan,
    timestamp: string,
  ): Promise<DurableRpgEncounterMatchBinding> {
    const existing = this.#bindings.loadByEncounter(plan.encounterId);
    if (existing) {
      assertBindingMatchesPlan(existing, plan);
      const view = await this.#ensureMatch(plan);
      assertUnitMappingMatches(existing, view);
      return existing;
    }

    // Match creation may succeed just before process death. On restart this path
    // recovers the exact revision-zero configured match and then materializes the
    // missing binding from durable encounter custody.
    const view = await this.#ensureMatch(plan);
    assertTeamUnitsMatchPlan(view, plan);
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
      teamUnitIds: structuredClone(plan.teamUnitIds),
      participantUnitIds: structuredClone(plan.participantUnitIds),
    }, timestamp);
  }

  async #ensureMatch(plan: BindingPlan): Promise<MatchView> {
    try {
      return asMatchView(
        await this.#matches.createMatch(plan.matchPlayerIds, plan.matchId, plan.initialState),
      );
    } catch (error) {
      if (errorCode(error) !== "match_exists") throw error;
    }
    const snapshot = await this.#matches.snapshot(plan.matchId);
    if (
      snapshot.playerIds.length !== plan.matchPlayerIds.length
      || snapshot.playerIds.some((playerId, index) => playerId !== plan.matchPlayerIds[index])
      || stableJson(snapshot.initialState) !== stableJson(plan.initialState)
    ) {
      throw failure(
        "encounter-match-conflict",
        `Encounter ${plan.encounterId} is bound to a different tactical match configuration.`,
        409,
      );
    }
    const recovered = asMatchView(await this.#matches.view(plan.matchId, plan.playerTeamSeatId));
    assertTeamUnitsMatchPlan(recovered, plan);
    return recovered;
  }

  async #synchronize(binding: DurableRpgEncounterMatchBinding, view: MatchView): Promise<void> {
    if (view.observation.status.lifecycle === "active") return;
    const snapshot = await this.#matches.snapshot(binding.matchId);
    const completedAt = snapshot.events.at(-1)?.occurredAt;
    if (!completedAt) {
      throw failure(
        "encounter-match-conflict",
        `Terminal match ${binding.matchId} has no durable terminal event timestamp.`,
        409,
      );
    }
    const completion = {
      protocolVersion: 2,
      completionId: `completion:${binding.encounterId}`,
      encounterId: binding.encounterId,
      outcome: terminalOutcome(binding, view, completedAt),
    };
    this.#encounters.complete(binding.encounterId, completion, {
      serviceId: ENGINE_SERVICE_ID,
      completedAt,
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
  const configuredParticipants: MonsterMasterRpgEncounterParticipant[] = array(
    request.participants,
    "participants",
  ).map((value, index) => {
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
      rulesState: record(participant.rulesState, `participants[${index}].rulesState`),
    };
  });
  const participants = configuredParticipants.map((participant) => ({
    participantId: participant.participantId,
    controller: structuredClone(participant.controller),
    teamId: participant.teamId,
  }));
  const configuredObjectives: MonsterMasterRpgEncounterObjective[] = array(
    request.objectives,
    "objectives",
  ).map((value, index) => {
    const objective = record(value, `objectives[${index}]`);
    return {
      objectiveId: identifier(objective.objectiveId, `objectives[${index}].objectiveId`),
      kind: requiredText(objective.kind, `objectives[${index}].kind`),
      ...(objective.rules === undefined
        ? {}
        : { rules: record(objective.rules, `objectives[${index}].rules`) }),
    };
  });
  const objectives = configuredObjectives.map((objective) => ({ objectiveId: objective.objectiveId }));
  const playerParticipants = configuredParticipants.filter(
    (participant) => participant.controller.kind === "player",
  );
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
    configuredParticipants
      .map((participant) => participant.teamId)
      .filter((teamId) => teamId !== playerTeamId),
  );
  if (oppositionTeamIds.length !== 1) {
    throw failure(
      "unsupported-encounter-roster",
      "The current Monster Master RPG adapter requires exactly one opposition team.",
      400,
    );
  }
  const oppositionTeamId = oppositionTeamIds[0]!;
  const playerTeamSeatId = rpgEncounterTeamSeatId(encounterId);
  const matchPlayerIds: [string, string] = [playerTeamSeatId, GAMEFRAME_BOT_PLAYER_ID];
  const materialized = materializeMonsterMasterRpgEncounter({
    matchPlayerIds,
    playerTeamId,
    oppositionTeamId,
    participants: configuredParticipants,
    objectives: configuredObjectives,
    difficulty: record(request.difficulty, "difficulty"),
    battlefield: record(request.battlefield, "battlefield"),
  });
  return {
    encounterId,
    campaignId,
    rulesetId,
    gameId: "monster-master-duel",
    matchId: rpgEncounterMatchId(encounterId),
    authorizedPlayerIds,
    playerTeamId,
    oppositionTeamId,
    playerTeamSeatId,
    participants,
    objectives,
    matchPlayerIds,
    initialState: materialized.initialState,
    teamUnitIds: materialized.teamUnitIds,
    participantUnitIds: materialized.participantUnitIds,
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
        participantUnitIds: structuredClone(binding.participantUnitIds),
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
  const assignedUnitIds = unique(controlledParticipantIds.flatMap(
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
      controlledUnitIds: [...(binding.teamUnitIds[binding.playerTeamId] ?? [])],
      assignedUnitIds,
    },
  };
}

function teamUnits(view: MatchView, plan: Pick<BindingPlan, "playerTeamId" | "oppositionTeamId" | "playerTeamSeatId">): Record<string, string[]> {
  const rosters = record(view.observation.rosters, "observation.rosters");
  return {
    [plan.playerTeamId]: unitIds(rosters[plan.playerTeamSeatId]),
    [plan.oppositionTeamId]: unitIds(rosters[GAMEFRAME_BOT_PLAYER_ID]),
  };
}

function assertTeamUnitsMatchPlan(view: MatchView, plan: BindingPlan): void {
  if (stableJson(teamUnits(view, plan)) !== stableJson(plan.teamUnitIds)) {
    throw failure(
      "encounter-match-conflict",
      `Encounter ${plan.encounterId} tactical roster does not match its configured participant creatures.`,
      409,
    );
  }
}

function assertUnitMappingMatches(
  binding: DurableRpgEncounterMatchBinding,
  view: MatchView,
): void {
  const current = teamUnits(view, binding);
  if (stableJson(current) !== stableJson(binding.teamUnitIds)) {
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
    teamUnitIds: binding.teamUnitIds,
    participantUnitIds: binding.participantUnitIds,
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
    teamUnitIds: plan.teamUnitIds,
    participantUnitIds: plan.participantUnitIds,
  };
  if (stableJson(comparable) !== stableJson(expected)) {
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
    participantResults: binding.participants.map((participant) =>
      participantTerminalResult(binding, view, participant.participantId)
    ),
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

function participantTerminalResult(
  binding: DurableRpgEncounterMatchBinding,
  view: MatchView,
  participantId: string,
): JsonRecord {
  const mappedUnitIds = binding.participantUnitIds[participantId] ?? [];
  if (mappedUnitIds.length === 0) {
    throw failure(
      "encounter-match-conflict",
      `Participant ${participantId} has no persisted tactical unit mapping.`,
      409,
    );
  }
  const board = safeRecord(view.observation.board);
  const living = Array.isArray(board.units) ? board.units : [];
  const defeated = new Set(
    Array.isArray(view.observation.defeatedUnitIds)
      ? view.observation.defeatedUnitIds.filter((value): value is string => typeof value === "string")
      : [],
  );
  let healthRemaining = 0;
  let livingCount = 0;
  for (const unitId of mappedUnitIds) {
    const unit = living.find((value) =>
      value && typeof value === "object" && !Array.isArray(value)
      && (value as JsonRecord).id === unitId
    ) as JsonRecord | undefined;
    if (unit) {
      const health = typeof unit.health === "number" && Number.isFinite(unit.health)
        ? Math.max(0, unit.health)
        : 0;
      healthRemaining += health;
      if (health > 0) livingCount += 1;
    } else if (!defeated.has(unitId)) {
      throw failure(
        "encounter-match-conflict",
        `Mapped tactical unit ${unitId} is neither living nor defeated in the terminal match.`,
        409,
      );
    }
  }
  const status = livingCount > 0 ? "active" : "defeated";
  return {
    participantId,
    status,
    healthRemaining,
    conditions: status === "defeated" ? ["defeated"] : [],
    resourceChanges: {},
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

function safeRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
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

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as JsonRecord)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, sortJson(nested)]),
  );
}

function failure(code: string, message: string, status: number): Error {
  return Object.assign(new Error(message), { code, status, retryable: false });
}
