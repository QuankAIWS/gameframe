import { createHash } from "node:crypto";
import { DatabaseSync, type StatementSync } from "node:sqlite";

import { SqliteRpgCommandAcceptanceRepository } from "./sqlite-rpg-command-acceptance.ts";
import type {
  GameFrameCoordinationState,
  RuntimeNarrativeCommitReceipt,
} from "./rpg-dual-revision-contract.ts";

const COORDINATION_TABLE = "rpg_campaign_coordination_v1";
const MEMBERSHIP_TABLE = "rpg_campaign_membership_intervals_v1";
const ENCOUNTER_TABLE = "rpg_encounters_v1";
const COMPLETION_TABLE = "rpg_encounter_completions_v1";
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const MAX_PARTICIPANTS = 32;
const MAX_OBJECTIVES = 32;
const MAX_CONDITIONS = 32;
const MAX_REWARDS = 32;
const MAX_REQUEST_BYTES = 131_072;
const RUNTIME_SERVICE_ID = "rpg-gm-runtime";
const ENGINE_SERVICE_ID = "gameframe-encounter-engine";

type JsonRecord = Record<string, unknown>;

export type DurableEncounterLaunchRequest = {
  protocolVersion: 2;
  coordinationMutationId: string;
  expectedGameframeCoordinationRevision: number;
  runtimeCommit: RuntimeNarrativeCommitReceipt;
  encounterId: string;
  campaignId: string;
  rulesetId: string;
  idempotencyKey: string;
  difficulty: JsonRecord;
  participants: JsonRecord[];
  objectives: JsonRecord[];
  battlefield: JsonRecord;
};

export type DurableTerminalOutcome = {
  kind: "encounter.terminal_outcome";
  result: "victory" | "defeat" | "draw" | "cancelled";
  winnerTeamId?: string;
  objectiveResults: Array<{
    objectiveId: string;
    status: "completed" | "failed" | "partial";
  }>;
  participantResults: Array<{
    participantId: string;
    status: "active" | "defeated" | "withdrawn";
    healthRemaining?: number;
    conditions: string[];
    resourceChanges: Record<string, number>;
  }>;
  rewards: Array<{
    rewardId: string;
    kind: "item" | "currency" | "experience" | "flag";
    quantity: number;
  }>;
  ruleset: {
    id: string;
    revision: number;
  };
  commit: {
    matchId: string;
    matchRevision: number;
    eventCount: number;
    completedAt: string;
  };
};

export type DurableEncounterHandle = GameFrameCoordinationState & {
  protocolVersion: 2;
  encounterId: string;
  campaignId: string;
  state: "preparing" | "completed";
  resumeToken: string;
  coordinationMutationId: string;
  runtimeCommitId: string;
  terminalOutcome?: DurableTerminalOutcome;
};

export class SqliteRpgEncounterError extends Error {
  readonly code:
    | "invalid-input"
    | "campaign-not-found"
    | "coordination-revision-conflict"
    | "runtime-source-revision-conflict"
    | "narrative-link-conflict"
    | "coordination-mutation-conflict"
    | "runtime-commit-conflict"
    | "encounter-conflict"
    | "encounter-not-found"
    | "encounter-access-denied"
    | "participant-not-authorized"
    | "completion-conflict"
    | "invalid-terminal-outcome"
    | "corrupt-store";

  constructor(
    code: SqliteRpgEncounterError["code"],
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "SqliteRpgEncounterError";
    this.code = code;
  }
}

type CoordinationRow = {
  campaign_id: string;
  gameframe_coordination_revision: number;
  presentation_sequence: number;
  linked_narrative_revision: number;
};

type EncounterRow = {
  encounter_id: string;
  campaign_id: string;
  service_id: string;
  idempotency_key: string;
  coordination_mutation_id: string;
  runtime_commit_id: string;
  fingerprint: string;
  request_json: string;
  handle_json: string;
  state: string;
  created_at: string;
  updated_at: string;
};

type CompletionRow = {
  encounter_id: string;
  completion_id: string;
  fingerprint: string;
  outcome_json: string;
  handle_json: string;
  completed_at: string;
};

export class SqliteRpgEncounterStore {
  readonly #database: DatabaseSync;
  readonly #faultInjector?: (stage: string) => void;
  readonly #selectState: StatementSync;
  readonly #updateState: StatementSync;
  readonly #selectByEncounter: StatementSync;
  readonly #selectByMutation: StatementSync;
  readonly #selectByRuntimeCommit: StatementSync;
  readonly #selectByIdempotency: StatementSync;
  readonly #insertEncounter: StatementSync;
  readonly #updateEncounterComplete: StatementSync;
  readonly #selectCompletion: StatementSync;
  readonly #insertCompletion: StatementSync;
  readonly #selectActiveMembership: StatementSync;

  constructor(input: {
    filePath: string;
    faultInjector?: (stage: string) => void;
  }) {
    if (!input || typeof input.filePath !== "string" || !input.filePath.trim()) {
      throw new TypeError("filePath is required");
    }
    const filePath = input.filePath.trim();
    const commands = new SqliteRpgCommandAcceptanceRepository({ filePath });
    commands.close();

    this.#database = new DatabaseSync(filePath);
    this.#database.exec("PRAGMA busy_timeout = 5000");
    this.#database.exec("PRAGMA foreign_keys = ON");
    this.#database.exec("PRAGMA synchronous = FULL");
    if (filePath !== ":memory:") this.#database.exec("PRAGMA journal_mode = WAL");
    this.#faultInjector = input.faultInjector;
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS ${ENCOUNTER_TABLE} (
        encounter_id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        coordination_mutation_id TEXT NOT NULL,
        runtime_commit_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        request_json TEXT NOT NULL,
        handle_json TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('preparing', 'completed')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (campaign_id, service_id, idempotency_key),
        UNIQUE (campaign_id, coordination_mutation_id),
        UNIQUE (campaign_id, runtime_commit_id),
        FOREIGN KEY (campaign_id) REFERENCES ${COORDINATION_TABLE}(campaign_id)
      );
      CREATE TABLE IF NOT EXISTS ${COMPLETION_TABLE} (
        encounter_id TEXT PRIMARY KEY,
        completion_id TEXT NOT NULL UNIQUE,
        fingerprint TEXT NOT NULL,
        outcome_json TEXT NOT NULL,
        handle_json TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        FOREIGN KEY (encounter_id) REFERENCES ${ENCOUNTER_TABLE}(encounter_id)
      );
    `);

    this.#selectState = this.#database.prepare(`
      SELECT campaign_id, gameframe_coordination_revision,
             presentation_sequence, linked_narrative_revision
      FROM ${COORDINATION_TABLE} WHERE campaign_id = ?
    `);
    this.#updateState = this.#database.prepare(`
      UPDATE ${COORDINATION_TABLE}
      SET gameframe_coordination_revision = ?, linked_narrative_revision = ?, updated_at = ?
      WHERE campaign_id = ? AND gameframe_coordination_revision = ?
    `);
    this.#selectByEncounter = this.#database.prepare(`
      SELECT * FROM ${ENCOUNTER_TABLE} WHERE encounter_id = ?
    `);
    this.#selectByMutation = this.#database.prepare(`
      SELECT * FROM ${ENCOUNTER_TABLE}
      WHERE campaign_id = ? AND coordination_mutation_id = ?
    `);
    this.#selectByRuntimeCommit = this.#database.prepare(`
      SELECT * FROM ${ENCOUNTER_TABLE}
      WHERE campaign_id = ? AND runtime_commit_id = ?
    `);
    this.#selectByIdempotency = this.#database.prepare(`
      SELECT * FROM ${ENCOUNTER_TABLE}
      WHERE campaign_id = ? AND service_id = ? AND idempotency_key = ?
    `);
    this.#insertEncounter = this.#database.prepare(`
      INSERT INTO ${ENCOUNTER_TABLE} (
        encounter_id, campaign_id, service_id, idempotency_key,
        coordination_mutation_id, runtime_commit_id, fingerprint,
        request_json, handle_json, state, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'preparing', ?, ?)
    `);
    this.#updateEncounterComplete = this.#database.prepare(`
      UPDATE ${ENCOUNTER_TABLE}
      SET handle_json = ?, state = 'completed', updated_at = ?
      WHERE encounter_id = ? AND state = 'preparing'
    `);
    this.#selectCompletion = this.#database.prepare(`
      SELECT * FROM ${COMPLETION_TABLE} WHERE encounter_id = ?
    `);
    this.#insertCompletion = this.#database.prepare(`
      INSERT INTO ${COMPLETION_TABLE} (
        encounter_id, completion_id, fingerprint, outcome_json,
        handle_json, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    this.#selectActiveMembership = this.#database.prepare(`
      SELECT role FROM ${MEMBERSHIP_TABLE}
      WHERE campaign_id = ? AND player_id = ?
        AND joined_presentation_sequence <= ?
        AND (
          left_presentation_sequence IS NULL
          OR left_presentation_sequence > ?
        )
      ORDER BY joined_presentation_sequence DESC
      LIMIT 1
    `);
  }

  close(): void {
    this.#database.close();
  }

  launch(
    requestValue: unknown,
    input: { serviceId: string; createdAt: string },
  ): DurableEncounterHandle {
    const serviceId = identifier(input?.serviceId, "serviceId");
    if (serviceId !== RUNTIME_SERVICE_ID) {
      throw new SqliteRpgEncounterError(
        "encounter-access-denied",
        "Encounter launch requires the RPG GM runtime service.",
      );
    }
    const createdAt = timestamp(input.createdAt, "createdAt");
    const request = normalizeLaunch(requestValue);
    const requestJson = stableJson(request);
    const requestFingerprint = fingerprint(requestJson);

    return this.#transaction(() => {
      const existingMutation = this.#selectByMutation.get(
        request.campaignId,
        request.coordinationMutationId,
      ) as EncounterRow | undefined;
      if (existingMutation) {
        return exactLaunchRetry(existingMutation, request, requestFingerprint);
      }
      const existingIdempotency = this.#selectByIdempotency.get(
        request.campaignId,
        serviceId,
        request.idempotencyKey,
      ) as EncounterRow | undefined;
      if (existingIdempotency) {
        return exactLaunchRetry(existingIdempotency, request, requestFingerprint);
      }
      const existingEncounter = this.#selectByEncounter.get(
        request.encounterId,
      ) as EncounterRow | undefined;
      if (existingEncounter) {
        throw new SqliteRpgEncounterError(
          "encounter-conflict",
          `Encounter ${request.encounterId} already exists with different launch custody.`,
        );
      }
      const existingCommit = this.#selectByRuntimeCommit.get(
        request.campaignId,
        request.runtimeCommit.runtimeCommitId,
      ) as EncounterRow | undefined;
      if (existingCommit) {
        throw new SqliteRpgEncounterError(
          "runtime-commit-conflict",
          `Runtime commit ${request.runtimeCommit.runtimeCommitId} is already linked to another encounter.`,
        );
      }

      const stateRow = this.#selectState.get(request.campaignId) as CoordinationRow | undefined;
      if (!stateRow) {
        throw new SqliteRpgEncounterError(
          "campaign-not-found",
          `Campaign ${request.campaignId} does not exist.`,
        );
      }
      const current = stateFromRow(stateRow);
      if (
        request.expectedGameframeCoordinationRevision
        !== current.gameframeCoordinationRevision
      ) {
        throw new SqliteRpgEncounterError(
          "coordination-revision-conflict",
          `Expected GameFrame coordination revision ${request.expectedGameframeCoordinationRevision}, actual ${current.gameframeCoordinationRevision}.`,
        );
      }
      if (
        request.runtimeCommit.sourceGameframeCoordinationRevision
        !== current.gameframeCoordinationRevision
      ) {
        throw new SqliteRpgEncounterError(
          "runtime-source-revision-conflict",
          "Encounter runtime commit was derived from a different GameFrame coordination revision.",
        );
      }
      if (
        request.runtimeCommit.previousNarrativeRevision
        !== current.linkedNarrativeRevision
        || request.runtimeCommit.narrativeRevision
        !== current.linkedNarrativeRevision + 1
      ) {
        throw new SqliteRpgEncounterError(
          "narrative-link-conflict",
          `Encounter narrative link must advance from ${current.linkedNarrativeRevision} to ${current.linkedNarrativeRevision + 1}.`,
        );
      }
      this.#validateParticipants(
        request.campaignId,
        request.participants,
        current.presentationSequence,
      );

      const next: GameFrameCoordinationState = {
        gameframeCoordinationRevision: current.gameframeCoordinationRevision + 1,
        presentationSequence: current.presentationSequence,
        linkedNarrativeRevision: request.runtimeCommit.narrativeRevision,
      };
      const updated = this.#updateState.run(
        next.gameframeCoordinationRevision,
        next.linkedNarrativeRevision,
        createdAt,
        request.campaignId,
        current.gameframeCoordinationRevision,
      );
      if (Number(updated.changes) !== 1) {
        throw new SqliteRpgEncounterError(
          "coordination-revision-conflict",
          `Campaign ${request.campaignId} changed during encounter launch.`,
        );
      }
      this.#fault("after-coordination-update");

      const handle: DurableEncounterHandle = {
        protocolVersion: 2,
        encounterId: request.encounterId,
        campaignId: request.campaignId,
        state: "preparing",
        resumeToken: resumeToken(request.encounterId, serviceId),
        coordinationMutationId: request.coordinationMutationId,
        runtimeCommitId: request.runtimeCommit.runtimeCommitId,
        ...next,
      };
      this.#insertEncounter.run(
        request.encounterId,
        request.campaignId,
        serviceId,
        request.idempotencyKey,
        request.coordinationMutationId,
        request.runtimeCommit.runtimeCommitId,
        requestFingerprint,
        requestJson,
        stableJson(handle),
        createdAt,
        createdAt,
      );
      this.#fault("after-encounter-insert");
      return handle;
    });
  }

  get(encounterIdValue: unknown, input: { serviceId: string }): DurableEncounterHandle {
    const encounterId = identifier(encounterIdValue, "encounterId");
    const serviceId = identifier(input?.serviceId, "serviceId");
    const row = this.#selectByEncounter.get(encounterId) as EncounterRow | undefined;
    if (!row) {
      throw new SqliteRpgEncounterError(
        "encounter-not-found",
        `Encounter ${encounterId} does not exist.`,
      );
    }
    if (row.service_id !== serviceId) {
      throw new SqliteRpgEncounterError(
        "encounter-access-denied",
        "Only the creating runtime service may retrieve this encounter.",
      );
    }
    return parseHandle(row.handle_json, row);
  }

  complete(
    encounterIdValue: unknown,
    requestValue: unknown,
    input: { serviceId: string; completedAt: string },
  ): DurableEncounterHandle {
    const encounterId = identifier(encounterIdValue, "encounterId");
    const serviceId = identifier(input?.serviceId, "serviceId");
    if (serviceId !== ENGINE_SERVICE_ID) {
      throw new SqliteRpgEncounterError(
        "encounter-access-denied",
        "Encounter completion requires the GameFrame encounter engine service.",
      );
    }
    const completedAt = timestamp(input.completedAt, "completedAt");
    const completion = normalizeCompletion(encounterId, requestValue);
    const completionJson = stableJson(completion);
    const completionFingerprint = fingerprint(completionJson);

    return this.#transaction(() => {
      const row = this.#selectByEncounter.get(encounterId) as EncounterRow | undefined;
      if (!row) {
        throw new SqliteRpgEncounterError(
          "encounter-not-found",
          `Encounter ${encounterId} does not exist.`,
        );
      }
      const existing = this.#selectCompletion.get(encounterId) as CompletionRow | undefined;
      if (existing) {
        if (
          existing.completion_id !== completion.completionId
          || existing.fingerprint !== completionFingerprint
          || existing.outcome_json !== stableJson(completion.outcome)
        ) {
          throw new SqliteRpgEncounterError(
            "completion-conflict",
            `Encounter ${encounterId} completion was reused with different content.`,
          );
        }
        return parseHandle(existing.handle_json, row);
      }
      if (row.state !== "preparing") {
        throw new SqliteRpgEncounterError(
          "completion-conflict",
          `Encounter ${encounterId} is already terminal without a valid completion receipt.`,
        );
      }
      const launch = parseLaunchRequest(row.request_json, row);
      validateOutcomeCoverage(launch, completion.outcome);
      const currentHandle = parseHandle(row.handle_json, row);
      const handle: DurableEncounterHandle = {
        ...currentHandle,
        state: "completed",
        terminalOutcome: completion.outcome,
      };
      const handleJson = stableJson(handle);
      this.#insertCompletion.run(
        encounterId,
        completion.completionId,
        completionFingerprint,
        stableJson(completion.outcome),
        handleJson,
        completedAt,
      );
      this.#fault("after-completion-receipt-insert");
      const updated = this.#updateEncounterComplete.run(
        handleJson,
        completedAt,
        encounterId,
      );
      if (Number(updated.changes) !== 1) {
        throw new SqliteRpgEncounterError(
          "completion-conflict",
          `Encounter ${encounterId} changed during completion.`,
        );
      }
      this.#fault("after-encounter-completion-update");
      return handle;
    });
  }

  #validateParticipants(
    campaignId: string,
    participants: JsonRecord[],
    presentationSequence: number,
  ): void {
    for (const participant of participants) {
      const participantId = identifier(participant.participantId, "participantId");
      const controller = record(participant.controller, `participant ${participantId} controller`);
      if (controller.kind !== "player") continue;
      const playerId = identifier(controller.playerId, "participant.controller.playerId");
      const membership = this.#selectActiveMembership.get(
        campaignId,
        playerId,
        presentationSequence,
        presentationSequence,
      ) as { role: string } | undefined;
      if (membership?.role !== "player") {
        throw new SqliteRpgEncounterError(
          "participant-not-authorized",
          `Encounter participant ${playerId} is not an active campaign player.`,
        );
      }
    }
  }

  #fault(stage: string): void {
    this.#faultInjector?.(stage);
  }

  #transaction<T>(work: () => T): T {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      this.#database.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        this.#database.exec("ROLLBACK");
      } catch {
        // Preserve the authoritative failure.
      }
      throw error;
    }
  }
}

function normalizeLaunch(value: unknown): DurableEncounterLaunchRequest {
  const request = record(value, "encounter launch");
  if (request.protocolVersion !== 2) throw invalid("protocolVersion must be 2");
  const runtimeCommit = normalizeRuntimeCommit(request.runtimeCommit);
  if (runtimeCommit.runtimeCommitKind !== "runtime.encounter_launch") {
    throw invalid("runtimeCommitKind must be runtime.encounter_launch");
  }
  const participants = recordArray(
    request.participants,
    "participants",
    1,
    MAX_PARTICIPANTS,
  );
  const objectives = recordArray(
    request.objectives,
    "objectives",
    1,
    MAX_OBJECTIVES,
  );
  assertUniqueIdentifiers(participants, "participantId", "participants");
  assertUniqueIdentifiers(objectives, "objectiveId", "objectives");
  const normalized: DurableEncounterLaunchRequest = {
    protocolVersion: 2,
    coordinationMutationId: identifier(
      request.coordinationMutationId,
      "coordinationMutationId",
    ),
    expectedGameframeCoordinationRevision: integer(
      request.expectedGameframeCoordinationRevision,
      "expectedGameframeCoordinationRevision",
      0,
    ),
    runtimeCommit,
    encounterId: identifier(request.encounterId, "encounterId"),
    campaignId: identifier(request.campaignId, "campaignId"),
    rulesetId: identifier(request.rulesetId, "rulesetId"),
    idempotencyKey: identifier(request.idempotencyKey, "idempotencyKey"),
    difficulty: record(request.difficulty, "difficulty"),
    participants,
    objectives,
    battlefield: record(request.battlefield, "battlefield"),
  };
  assertJson(normalized, "encounter launch");
  if (Buffer.byteLength(stableJson(normalized), "utf8") > MAX_REQUEST_BYTES) {
    throw invalid(`encounter launch exceeds ${MAX_REQUEST_BYTES} bytes`);
  }
  return normalized;
}

function normalizeCompletion(encounterId: string, value: unknown) {
  const request = record(value, "encounter completion");
  if (request.protocolVersion !== 2) throw invalid("protocolVersion must be 2");
  if (identifier(request.encounterId, "encounterId") !== encounterId) {
    throw invalid("completion encounterId must match the route");
  }
  return {
    protocolVersion: 2 as const,
    completionId: identifier(request.completionId, "completionId"),
    encounterId,
    outcome: normalizeOutcome(request.outcome),
  };
}

function normalizeOutcome(value: unknown): DurableTerminalOutcome {
  const outcome = record(value, "terminal outcome");
  if (outcome.kind !== "encounter.terminal_outcome") {
    throw invalidOutcome("outcome.kind is invalid");
  }
  if (
    outcome.result !== "victory"
    && outcome.result !== "defeat"
    && outcome.result !== "draw"
    && outcome.result !== "cancelled"
  ) {
    throw invalidOutcome("outcome.result is invalid");
  }
  const objectiveResults = array(valueAt(outcome, "objectiveResults"), "objectiveResults", MAX_OBJECTIVES)
    .map((entry, index) => {
      const result = record(entry, `objectiveResults[${index}]`);
      if (
        result.status !== "completed"
        && result.status !== "failed"
        && result.status !== "partial"
      ) {
        throw invalidOutcome(`objectiveResults[${index}].status is invalid`);
      }
      return {
        objectiveId: identifier(result.objectiveId, `objectiveResults[${index}].objectiveId`),
        status: result.status,
      };
    });
  const participantResults = array(valueAt(outcome, "participantResults"), "participantResults", MAX_PARTICIPANTS)
    .map((entry, index) => {
      const result = record(entry, `participantResults[${index}]`);
      if (
        result.status !== "active"
        && result.status !== "defeated"
        && result.status !== "withdrawn"
      ) {
        throw invalidOutcome(`participantResults[${index}].status is invalid`);
      }
      const conditions = array(valueAt(result, "conditions"), `participantResults[${index}].conditions`, MAX_CONDITIONS)
        .map((condition, conditionIndex) =>
          identifier(condition, `participantResults[${index}].conditions[${conditionIndex}]`)
        );
      const resourceChangesValue = record(
        result.resourceChanges,
        `participantResults[${index}].resourceChanges`,
      );
      const resourceChanges: Record<string, number> = {};
      for (const [key, amount] of Object.entries(resourceChangesValue)) {
        if (typeof amount !== "number" || !Number.isFinite(amount)) {
          throw invalidOutcome(`participantResults[${index}].resourceChanges.${key} is invalid`);
        }
        resourceChanges[identifier(key, "resource key")] = amount;
      }
      return {
        participantId: identifier(
          result.participantId,
          `participantResults[${index}].participantId`,
        ),
        status: result.status,
        ...(result.healthRemaining === undefined
          ? {}
          : {
              healthRemaining: nonNegativeNumber(
                result.healthRemaining,
                `participantResults[${index}].healthRemaining`,
              ),
            }),
        conditions,
        resourceChanges,
      };
    });
  const rewards = array(valueAt(outcome, "rewards"), "rewards", MAX_REWARDS)
    .map((entry, index) => {
      const reward = record(entry, `rewards[${index}]`);
      if (
        reward.kind !== "item"
        && reward.kind !== "currency"
        && reward.kind !== "experience"
        && reward.kind !== "flag"
      ) {
        throw invalidOutcome(`rewards[${index}].kind is invalid`);
      }
      return {
        rewardId: identifier(reward.rewardId, `rewards[${index}].rewardId`),
        kind: reward.kind,
        quantity: integer(reward.quantity, `rewards[${index}].quantity`, 0),
      };
    });
  assertUniqueResultIds(objectiveResults.map((entry) => entry.objectiveId), "objective results");
  assertUniqueResultIds(participantResults.map((entry) => entry.participantId), "participant results");
  assertUniqueResultIds(rewards.map((entry) => entry.rewardId), "rewards");
  const ruleset = record(outcome.ruleset, "outcome.ruleset");
  const commit = record(outcome.commit, "outcome.commit");
  return {
    kind: "encounter.terminal_outcome",
    result: outcome.result,
    ...(outcome.winnerTeamId === undefined
      ? {}
      : { winnerTeamId: identifier(outcome.winnerTeamId, "winnerTeamId") }),
    objectiveResults,
    participantResults,
    rewards,
    ruleset: {
      id: identifier(ruleset.id, "ruleset.id"),
      revision: integer(ruleset.revision, "ruleset.revision", 0),
    },
    commit: {
      matchId: identifier(commit.matchId, "commit.matchId"),
      matchRevision: integer(commit.matchRevision, "commit.matchRevision", 0),
      eventCount: integer(commit.eventCount, "commit.eventCount", 0),
      completedAt: timestamp(commit.completedAt, "commit.completedAt"),
    },
  };
}

function validateOutcomeCoverage(
  launch: DurableEncounterLaunchRequest,
  outcome: DurableTerminalOutcome,
): void {
  const participantIds = launch.participants.map((entry) =>
    identifier(entry.participantId, "participantId")
  ).toSorted();
  const objectiveIds = launch.objectives.map((entry) =>
    identifier(entry.objectiveId, "objectiveId")
  ).toSorted();
  const outcomeParticipants = outcome.participantResults
    .map((entry) => entry.participantId)
    .toSorted();
  const outcomeObjectives = outcome.objectiveResults
    .map((entry) => entry.objectiveId)
    .toSorted();
  if (stableJson(participantIds) !== stableJson(outcomeParticipants)) {
    throw invalidOutcome("terminal outcome must cover every encounter participant exactly once");
  }
  if (stableJson(objectiveIds) !== stableJson(outcomeObjectives)) {
    throw invalidOutcome("terminal outcome must cover every encounter objective exactly once");
  }
  if (outcome.ruleset.id !== launch.rulesetId) {
    throw invalidOutcome("terminal outcome ruleset must match encounter launch");
  }
}

function exactLaunchRetry(
  row: EncounterRow,
  request: DurableEncounterLaunchRequest,
  requestFingerprint: string,
): DurableEncounterHandle {
  if (
    row.fingerprint !== requestFingerprint
    || row.request_json !== stableJson(request)
    || row.encounter_id !== request.encounterId
    || row.campaign_id !== request.campaignId
    || row.coordination_mutation_id !== request.coordinationMutationId
    || row.runtime_commit_id !== request.runtimeCommit.runtimeCommitId
  ) {
    throw new SqliteRpgEncounterError(
      "coordination-mutation-conflict",
      "Encounter launch identity was reused with different content.",
    );
  }
  return parseHandle(row.handle_json, row);
}

function parseHandle(value: string, row: EncounterRow): DurableEncounterHandle {
  try {
    const handle = JSON.parse(value) as DurableEncounterHandle;
    if (
      handle.protocolVersion !== 2
      || handle.encounterId !== row.encounter_id
      || handle.campaignId !== row.campaign_id
      || handle.coordinationMutationId !== row.coordination_mutation_id
      || handle.runtimeCommitId !== row.runtime_commit_id
      || handle.state !== row.state
    ) {
      throw new Error("encounter handle identity is invalid");
    }
    return structuredClone(handle);
  } catch (error) {
    throw new SqliteRpgEncounterError(
      "corrupt-store",
      `Encounter ${row.encounter_id} handle is corrupt.`,
      { cause: error },
    );
  }
}

function parseLaunchRequest(value: string, row: EncounterRow): DurableEncounterLaunchRequest {
  try {
    const request = normalizeLaunch(JSON.parse(value));
    if (
      request.encounterId !== row.encounter_id
      || request.campaignId !== row.campaign_id
      || stableJson(request) !== value
      || fingerprint(value) !== row.fingerprint
    ) {
      throw new Error("encounter launch custody is corrupt");
    }
    return request;
  } catch (error) {
    if (error instanceof SqliteRpgEncounterError && error.code === "corrupt-store") {
      throw error;
    }
    throw new SqliteRpgEncounterError(
      "corrupt-store",
      `Encounter ${row.encounter_id} launch custody is corrupt.`,
      { cause: error },
    );
  }
}

function normalizeRuntimeCommit(value: unknown): RuntimeNarrativeCommitReceipt {
  const receipt = record(value, "runtimeCommit");
  if (receipt.kind !== "runtime.narrative_committed") {
    throw invalid("runtimeCommit.kind is invalid");
  }
  if (
    receipt.runtimeCommitKind !== "runtime.events"
    && receipt.runtimeCommitKind !== "runtime.encounter_launch"
  ) {
    throw invalid("runtimeCommit.runtimeCommitKind is invalid");
  }
  return {
    kind: "runtime.narrative_committed",
    runtimeCommitKind: receipt.runtimeCommitKind,
    runtimeCommitId: identifier(receipt.runtimeCommitId, "runtimeCommitId"),
    ...(receipt.sourceCommandId === undefined
      ? {}
      : { sourceCommandId: identifier(receipt.sourceCommandId, "sourceCommandId") }),
    sourceGameframeCoordinationRevision: integer(
      receipt.sourceGameframeCoordinationRevision,
      "sourceGameframeCoordinationRevision",
      0,
    ),
    previousNarrativeRevision: integer(
      receipt.previousNarrativeRevision,
      "previousNarrativeRevision",
      0,
    ),
    narrativeRevision: integer(receipt.narrativeRevision, "narrativeRevision", 1),
  };
}

function stateFromRow(row: CoordinationRow): GameFrameCoordinationState {
  return {
    gameframeCoordinationRevision: integer(
      row.gameframe_coordination_revision,
      "gameframeCoordinationRevision",
      0,
    ),
    presentationSequence: integer(
      row.presentation_sequence,
      "presentationSequence",
      0,
    ),
    linkedNarrativeRevision: integer(
      row.linked_narrative_revision,
      "linkedNarrativeRevision",
      0,
    ),
  };
}

function resumeToken(encounterId: string, serviceId: string): string {
  return `resume:${createHash("sha256")
    .update(encounterId, "utf8")
    .update("\0")
    .update(serviceId, "utf8")
    .digest("base64url")}`;
}

function recordArray(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): JsonRecord[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw invalid(`${label} must contain from ${minimum} through ${maximum} entries`);
  }
  return value.map((entry, index) => structuredClone(record(entry, `${label}[${index}]`)));
}

function array(value: unknown, label: string, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) {
    throw invalidOutcome(`${label} must be an array with at most ${maximum} entries`);
  }
  return value;
}

function valueAt(recordValue: JsonRecord, key: string): unknown {
  return recordValue[key];
}

function assertUniqueIdentifiers(entries: JsonRecord[], key: string, label: string): void {
  const ids = entries.map((entry, index) => identifier(entry[key], `${label}[${index}].${key}`));
  assertUniqueResultIds(ids, label);
}

function assertUniqueResultIds(ids: string[], label: string): void {
  if (new Set(ids).size !== ids.length) {
    throw invalidOutcome(`${label} must contain unique identities`);
  }
}

function nonNegativeNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw invalidOutcome(`${label} must be a non-negative finite number`);
  }
  return value;
}

function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) {
    throw invalid(`${label} is not a valid identifier`);
  }
  return value;
}

function integer(value: unknown, label: string, minimum: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) {
    throw invalid(`${label} must be an integer of at least ${minimum}`);
  }
  return value;
}

function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw invalid(`${label} must be a timestamp`);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw invalid(`${label} must be a valid timestamp`);
  return new Date(milliseconds).toISOString();
}

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalid(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function invalid(message: string): SqliteRpgEncounterError {
  return new SqliteRpgEncounterError("invalid-input", message);
}

function invalidOutcome(message: string): SqliteRpgEncounterError {
  return new SqliteRpgEncounterError("invalid-terminal-outcome", message);
}

function fingerprint(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64url");
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortJson(entry)]),
    );
  }
  return value;
}

function assertJson(value: unknown, path: string, seen = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw invalid(`${path} is not finite`);
    return;
  }
  if (typeof value !== "object") throw invalid(`${path} is not JSON-compatible`);
  if (seen.has(value)) throw invalid(`${path} is circular`);
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => assertJson(entry, `${path}[${index}]`, seen));
      return;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw invalid(`${path} contains a non-plain object`);
    }
    for (const [key, entry] of Object.entries(value)) {
      assertJson(entry, `${path}.${key}`, seen);
    }
  } finally {
    seen.delete(value);
  }
}
