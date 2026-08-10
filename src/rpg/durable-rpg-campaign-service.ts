import { createHash } from "node:crypto";

import {
  SqliteRpgCampaignStore,
  SqliteRpgCampaignStoreError,
  type DurableCampaignBootstrap,
  type DurableCampaignBootstrapReceipt,
  type PlayerCampaignProjection,
  type PlayerCampaignProjectionEvent,
} from "./sqlite-rpg-campaign-store.ts";
import {
  SqliteRpgCommandAcceptanceError,
  SqliteRpgCommandAcceptanceRepository,
  type DurableGameFrameCommandReceipt,
} from "./sqlite-rpg-command-acceptance.ts";
import {
  SqliteRpgRuntimeLinkError,
  SqliteRpgRuntimeLinkRepository,
  type DurableRuntimeLinkReceipt,
} from "./sqlite-rpg-runtime-linkage.ts";

export const DURABLE_RPG_CAMPAIGN_PROTOCOL_VERSION = 2 as const;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const MAX_ACTION_TEXT_LENGTH = 2_000;
const MAX_CHOICE_OPTIONS = 16;
const MAX_CHOICE_ALLOWED_PLAYERS = 32;
const MAX_CHOICE_LABEL_LENGTH = 240;

type JsonRecord = Record<string, unknown>;

type ChoiceOption = {
  optionId: string;
  label: string;
};

export type DurableRpgPrincipal =
  | { kind: "player"; playerId: string }
  | { kind: "runtime"; serviceId: string };

export type ExplorationTalkRetryCommand = {
  campaignId: string;
  commandId: string;
  expectedGameframeCoordinationRevision: number;
  issuedAt: string;
  interactionTargetId: string;
  text: string;
};

export type AuthorizedExplorationTalkCommand = ExplorationTalkRetryCommand & {
  targetEntityId: string;
  targetDisplayLabel: string;
};

export type ExplorationMonsterControlRetryCommand = {
  campaignId: string;
  commandId: string;
  expectedGameframeCoordinationRevision: number;
  issuedAt: string;
  operation: "deploy" | "recall";
  controlTargetId: string;
};

export type AuthorizedExplorationMonsterControlCommand = ExplorationMonsterControlRetryCommand & {
  targetEntityId: string;
  targetDisplayLabel: string;
};

export class DurableRpgCampaignServiceError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;
  readonly gameframeCoordinationRevision?: number;
  readonly presentationSequence?: number;
  readonly linkedNarrativeRevision?: number;

  constructor(input: {
    code: string;
    message: string;
    status: number;
    retryable?: boolean;
    state?: {
      gameframeCoordinationRevision: number;
      presentationSequence: number;
      linkedNarrativeRevision: number;
    };
    cause?: unknown;
  }) {
    super(input.message, input.cause === undefined ? undefined : { cause: input.cause });
    this.name = "DurableRpgCampaignServiceError";
    this.code = input.code;
    this.status = input.status;
    this.retryable = input.retryable ?? false;
    if (input.state) {
      this.gameframeCoordinationRevision = input.state.gameframeCoordinationRevision;
      this.presentationSequence = input.state.presentationSequence;
      this.linkedNarrativeRevision = input.state.linkedNarrativeRevision;
    }
  }
}

export class DurableRpgCampaignService {
  readonly #campaigns: SqliteRpgCampaignStore;
  readonly #commands: SqliteRpgCommandAcceptanceRepository;
  readonly #runtimeLinks: SqliteRpgRuntimeLinkRepository;
  readonly #expectedRuntimeServiceId: string;
  readonly #clock: () => string;

  constructor(input: {
    filePath: string;
    expectedRuntimeServiceId?: string;
    clock?: () => string;
  }) {
    if (!input || typeof input.filePath !== "string" || !input.filePath.trim()) {
      throw new TypeError("filePath is required");
    }
    this.#campaigns = new SqliteRpgCampaignStore({ filePath: input.filePath });
    this.#commands = new SqliteRpgCommandAcceptanceRepository({ filePath: input.filePath });
    this.#runtimeLinks = new SqliteRpgRuntimeLinkRepository({ filePath: input.filePath });
    this.#expectedRuntimeServiceId = identifier(
      input.expectedRuntimeServiceId ?? "rpg-gm-runtime",
      "expectedRuntimeServiceId",
    );
    this.#clock = input.clock ?? (() => new Date().toISOString());
  }

  close(): void {
    this.#runtimeLinks.close();
    this.#commands.close();
    this.#campaigns.close();
  }

  bootstrapCampaign(
    input: DurableCampaignBootstrap,
  ): { kind: "initialized" | "existing"; receipt: DurableCampaignBootstrapReceipt } {
    try {
      return this.#campaigns.bootstrap(input);
    } catch (error) {
      throw mapCampaignError(error);
    }
  }

  async attachCampaign(
    requestValue: unknown,
    principalValue: DurableRpgPrincipal,
  ): Promise<PlayerCampaignProjection> {
    const principal = playerPrincipal(principalValue);
    const request = requestRecord(requestValue, "campaign attach request");
    requireProtocol(request);
    try {
      return this.#campaigns.attach({
        campaignId: identifier(request.campaignId, "campaignId"),
        authenticatedPlayerId: principal.playerId,
      });
    } catch (error) {
      throw mapCampaignError(error);
    }
  }

  async handleCommand(
    requestValue: unknown,
    principalValue: DurableRpgPrincipal,
  ): Promise<DurableGameFrameCommandReceipt> {
    const principal = playerPrincipal(principalValue);
    const request = requestRecord(requestValue, "campaign command request");
    requireProtocol(request);
    const campaignId = identifier(request.campaignId, "campaignId");
    const commandId = identifier(request.commandId, "commandId");
    const issuedAt = timestamp(request.issuedAt, "issuedAt");
    const command = requestRecord(request.command, "command");
    const expected = nonNegativeInteger(
      command.expectedGameframeCoordinationRevision,
      "expectedGameframeCoordinationRevision",
    );

    if (command.kind === "campaign.submit_action") {
      return this.#acceptAction({
        campaignId,
        commandId,
        issuedAt,
        expected,
        principal,
        command,
      });
    }
    if (command.kind === "campaign.submit_choice") {
      return this.#acceptChoice({
        campaignId,
        commandId,
        issuedAt,
        expected,
        principal,
        command,
      });
    }
    throw new DurableRpgCampaignServiceError({
      code: "unsupported-command",
      message: "The durable campaign service accepts campaign.submit_action and campaign.submit_choice.",
      status: 400,
    });
  }

  /**
   * Resolves an exact already-committed Talk retry before current-world physical
   * authorization is repeated. The command ID remains bound to the original
   * authenticated player, text, viewer-safe target handle, coordination source,
   * and issuedAt timestamp. A changed retry fails closed as a command conflict.
   */
  findCommittedExplorationTalk(
    inputValue: ExplorationTalkRetryCommand,
    principalValue: DurableRpgPrincipal,
  ): DurableGameFrameCommandReceipt | undefined {
    const principal = playerPrincipal(principalValue);
    const input = requestRecord(inputValue, "exploration Talk retry");
    const campaignId = identifier(input.campaignId, "campaignId");
    const commandId = identifier(input.commandId, "commandId");
    const expected = nonNegativeInteger(
      input.expectedGameframeCoordinationRevision,
      "expectedGameframeCoordinationRevision",
    );
    const issuedAt = timestamp(input.issuedAt, "issuedAt");
    const interactionTargetId = identifier(input.interactionTargetId, "interactionTargetId");
    const text = boundedText(input.text, "text", MAX_ACTION_TEXT_LENGTH);

    let committed;
    try {
      committed = this.#commands.committedCommand(campaignId, commandId);
    } catch (error) {
      throw mapCommandError(error, this.#commands.state(campaignId));
    }
    if (!committed) return undefined;

    const command = committed.delivery.command;
    const presentation = committed.presentationEvents.find((event) =>
      event.kind === "campaign.action_submitted"
    );
    const payload = presentation?.payload;
    const exact = committed.delivery.authenticatedPlayerId === principal.playerId
      && committed.delivery.sourceGameframeCoordinationRevision === expected
      && committed.delivery.issuedAt === issuedAt
      && command.kind === "campaign.submit_action"
      && command.visibility === "private-to-runtime"
      && command.text === text
      && command.interaction?.kind === "talk"
      && presentation?.audience.kind === "player"
      && presentation.audience.playerId === principal.playerId
      && payload?.actorId === principal.playerId
      && payload?.text === text
      && payload?.interaction === "talk"
      && payload?.interactionTargetId === interactionTargetId;
    if (!exact) {
      throw new DurableRpgCampaignServiceError({
        code: "command-conflict",
        message: `Command ${campaignId}/${commandId} was reused with different Talk content.`,
        status: 409,
      });
    }
    return committed.receipt;
  }

  /**
   * Accepts Talk only after the HTTP exploration boundary has converted a
   * viewer-safe interactionTargetId into a current adjacent canonical entity.
   * The generic browser `/commands` path has no way to attach this semantic
   * target metadata.
   */
  handleAuthorizedExplorationTalk(
    inputValue: AuthorizedExplorationTalkCommand,
    principalValue: DurableRpgPrincipal,
  ): DurableGameFrameCommandReceipt {
    const principal = playerPrincipal(principalValue);
    const input = requestRecord(inputValue, "authorized exploration Talk");
    const campaignId = identifier(input.campaignId, "campaignId");
    const commandId = identifier(input.commandId, "commandId");
    const expected = nonNegativeInteger(
      input.expectedGameframeCoordinationRevision,
      "expectedGameframeCoordinationRevision",
    );
    const issuedAt = timestamp(input.issuedAt, "issuedAt");
    const interactionTargetId = identifier(input.interactionTargetId, "interactionTargetId");
    const targetEntityId = identifier(input.targetEntityId, "targetEntityId");
    const targetDisplayLabel = boundedText(
      input.targetDisplayLabel,
      "targetDisplayLabel",
      MAX_CHOICE_LABEL_LENGTH,
    );
    const text = boundedText(input.text, "text", MAX_ACTION_TEXT_LENGTH);

    try {
      return this.#commands.acceptCommand({
        campaignId,
        commandId,
        authenticatedPlayerId: principal.playerId,
        expectedGameframeCoordinationRevision: expected,
        issuedAt,
        command: {
          kind: "campaign.submit_action",
          visibility: "private-to-runtime",
          text,
          interaction: {
            kind: "talk",
            targetEntityId,
          },
        },
        presentationEvents: [
          {
            eventId: actionEventId(campaignId, commandId),
            kind: "campaign.action_submitted",
            audience: { kind: "player", playerId: principal.playerId },
            payload: {
              commandId,
              actorId: principal.playerId,
              text,
              interaction: "talk",
              interactionTargetId,
              targetDisplayLabel,
            },
          },
        ],
      });
    } catch (error) {
      throw mapCommandError(error, this.#commands.state(campaignId));
    }
  }

  findCommittedExplorationMonsterControl(
    inputValue: ExplorationMonsterControlRetryCommand,
    principalValue: DurableRpgPrincipal,
  ): DurableGameFrameCommandReceipt | undefined {
    const principal = playerPrincipal(principalValue);
    const input = requestRecord(inputValue, "exploration monster-control retry");
    const campaignId = identifier(input.campaignId, "campaignId");
    const commandId = identifier(input.commandId, "commandId");
    const expected = nonNegativeInteger(
      input.expectedGameframeCoordinationRevision,
      "expectedGameframeCoordinationRevision",
    );
    const issuedAt = timestamp(input.issuedAt, "issuedAt");
    const operation = input.operation === "deploy" || input.operation === "recall"
      ? input.operation
      : undefined;
    if (!operation) throw invalid("operation must be deploy or recall");
    const controlTargetId = identifier(input.controlTargetId, "controlTargetId");

    let committed;
    try {
      committed = this.#commands.committedCommand(campaignId, commandId);
    } catch (error) {
      throw mapCommandError(error, this.#commands.state(campaignId));
    }
    if (!committed) return undefined;

    const command = committed.delivery.command;
    const presentation = committed.presentationEvents.find((event) =>
      event.kind === "campaign.action_submitted"
    );
    const payload = presentation?.payload;
    const exact = committed.delivery.authenticatedPlayerId === principal.playerId
      && committed.delivery.sourceGameframeCoordinationRevision === expected
      && committed.delivery.issuedAt === issuedAt
      && command.kind === "campaign.submit_action"
      && command.visibility === "private-to-runtime"
      && command.interaction?.kind === "monster-control"
      && command.interaction.operation === operation
      && presentation?.audience.kind === "player"
      && presentation.audience.playerId === principal.playerId
      && payload?.actorId === principal.playerId
      && payload?.interaction === "monster-control"
      && payload?.operation === operation
      && payload?.controlTargetId === controlTargetId;
    if (!exact) {
      throw new DurableRpgCampaignServiceError({
        code: "command-conflict",
        message: `Command ${campaignId}/${commandId} was reused with different monster-control content.`,
        status: 409,
      });
    }
    return committed.receipt;
  }

  handleAuthorizedExplorationMonsterControl(
    inputValue: AuthorizedExplorationMonsterControlCommand,
    principalValue: DurableRpgPrincipal,
  ): DurableGameFrameCommandReceipt {
    const principal = playerPrincipal(principalValue);
    const input = requestRecord(inputValue, "authorized exploration monster control");
    const campaignId = identifier(input.campaignId, "campaignId");
    const commandId = identifier(input.commandId, "commandId");
    const expected = nonNegativeInteger(
      input.expectedGameframeCoordinationRevision,
      "expectedGameframeCoordinationRevision",
    );
    const issuedAt = timestamp(input.issuedAt, "issuedAt");
    const operation = input.operation === "deploy" || input.operation === "recall"
      ? input.operation
      : undefined;
    if (!operation) throw invalid("operation must be deploy or recall");
    const controlTargetId = identifier(input.controlTargetId, "controlTargetId");
    const targetEntityId = identifier(input.targetEntityId, "targetEntityId");
    const targetDisplayLabel = boundedText(
      input.targetDisplayLabel,
      "targetDisplayLabel",
      MAX_CHOICE_LABEL_LENGTH,
    );
    const text = operation === "deploy"
      ? "Deploy selected roster monster."
      : "Recall selected roster monster.";

    try {
      return this.#commands.acceptCommand({
        campaignId,
        commandId,
        authenticatedPlayerId: principal.playerId,
        expectedGameframeCoordinationRevision: expected,
        issuedAt,
        command: {
          kind: "campaign.submit_action",
          visibility: "private-to-runtime",
          text,
          interaction: {
            kind: "monster-control",
            operation,
            targetEntityId,
          },
        },
        presentationEvents: [
          {
            eventId: actionEventId(campaignId, commandId),
            kind: "campaign.action_submitted",
            audience: { kind: "player", playerId: principal.playerId },
            payload: {
              commandId,
              actorId: principal.playerId,
              text,
              interaction: "monster-control",
              operation,
              controlTargetId,
              targetDisplayLabel,
            },
          },
        ],
      });
    } catch (error) {
      throw mapCommandError(error, this.#commands.state(campaignId));
    }
  }

  #acceptAction(input: {
    campaignId: string;
    commandId: string;
    issuedAt: string;
    expected: number;
    principal: { kind: "player"; playerId: string };
    command: JsonRecord;
  }): DurableGameFrameCommandReceipt {
    const visibility = input.command.visibility === "public"
      ? "public" as const
      : input.command.visibility === "private-to-runtime"
        ? "private-to-runtime" as const
        : undefined;
    if (!visibility) {
      throw invalid("command.visibility is not supported");
    }
    const text = boundedText(input.command.text, "command.text", MAX_ACTION_TEXT_LENGTH);
    const presentationEvents = visibility === "public"
      ? [
          {
            eventId: actionEventId(input.campaignId, input.commandId),
            kind: "campaign.action_submitted",
            audience: { kind: "public" as const },
            payload: {
              commandId: input.commandId,
              actorId: input.principal.playerId,
              text,
            },
          },
        ]
      : [];
    try {
      return this.#commands.acceptCommand({
        campaignId: input.campaignId,
        commandId: input.commandId,
        authenticatedPlayerId: input.principal.playerId,
        expectedGameframeCoordinationRevision: input.expected,
        issuedAt: input.issuedAt,
        command: {
          kind: "campaign.submit_action",
          visibility,
          text,
        },
        presentationEvents,
      });
    } catch (error) {
      throw mapCommandError(error, this.#commands.state(input.campaignId));
    }
  }

  #acceptChoice(input: {
    campaignId: string;
    commandId: string;
    issuedAt: string;
    expected: number;
    principal: { kind: "player"; playerId: string };
    command: JsonRecord;
  }): DurableGameFrameCommandReceipt {
    const choiceId = identifier(input.command.choiceId, "command.choiceId");
    const optionId = identifier(input.command.optionId, "command.optionId");
    let projection: PlayerCampaignProjection;
    try {
      projection = this.#campaigns.attach({
        campaignId: input.campaignId,
        authenticatedPlayerId: input.principal.playerId,
      });
    } catch (error) {
      throw mapCampaignError(error);
    }

    const existingSubmission = latestChoiceSubmission(projection.events, choiceId);
    if (
      existingSubmission
      && existingSubmission.payload.commandId !== input.commandId
    ) {
      throw choiceError(
        "choice-already-submitted",
        `Choice ${choiceId} has already been submitted.`,
        409,
      );
    }

    const presented = latestPresentedChoice(projection.events, choiceId);
    if (!presented) {
      throw choiceError(
        "choice-not-found",
        `Choice ${choiceId} is not available in this player projection.`,
        409,
      );
    }
    authorizeChoicePlayer(presented.payload, input.principal.playerId, choiceId);
    const option = choiceOption(presented.payload, optionId, choiceId);

    try {
      return this.#commands.acceptCommand({
        campaignId: input.campaignId,
        commandId: input.commandId,
        authenticatedPlayerId: input.principal.playerId,
        expectedGameframeCoordinationRevision: input.expected,
        issuedAt: input.issuedAt,
        command: {
          kind: "campaign.submit_choice",
          choiceId,
          optionId,
        },
        presentationEvents: [
          {
            eventId: choiceEventId(input.campaignId, input.commandId),
            kind: "campaign.choice_submitted",
            audience: { kind: "public" },
            payload: {
              commandId: input.commandId,
              actorId: input.principal.playerId,
              choiceId,
              optionId,
              label: option.label,
            },
          },
        ],
      });
    } catch (error) {
      throw mapCommandError(error, this.#commands.state(input.campaignId));
    }
  }

  async appendRuntimeEvents(
    requestValue: unknown,
    principalValue: DurableRpgPrincipal,
  ): Promise<DurableRuntimeLinkReceipt> {
    const principal = runtimePrincipal(principalValue);
    if (principal.serviceId !== this.#expectedRuntimeServiceId) {
      throw new DurableRpgCampaignServiceError({
        code: "forbidden",
        message: "Runtime event publication requires the configured RPG GM service.",
        status: 403,
      });
    }
    const request = requestRecord(requestValue, "runtime event request");
    requireProtocol(request);
    try {
      return this.#runtimeLinks.acceptEvents(request, { linkedAt: this.#clock() });
    } catch (error) {
      const campaignId = typeof request.campaignId === "string"
        ? request.campaignId
        : undefined;
      throw mapRuntimeLinkError(
        error,
        campaignId ? this.#commands.state(campaignId) : undefined,
      );
    }
  }
}

function latestChoiceSubmission(
  events: PlayerCampaignProjectionEvent[],
  choiceId: string,
): PlayerCampaignProjectionEvent | undefined {
  return events.toReversed().find((event) =>
    event.kind === "campaign.choice_submitted"
    && event.payload.choiceId === choiceId
  );
}

function latestPresentedChoice(
  events: PlayerCampaignProjectionEvent[],
  choiceId: string,
): PlayerCampaignProjectionEvent | undefined {
  return events.toReversed().find((event) =>
    event.kind === "choice.presented"
    && event.payload.choiceId === choiceId
  );
}

function authorizeChoicePlayer(payload: JsonRecord, playerId: string, choiceId: string): void {
  if (payload.allowedPlayerIds === undefined) return;
  if (!Array.isArray(payload.allowedPlayerIds)) {
    throw choiceError(
      "choice-not-found",
      `Choice ${choiceId} has invalid player authorization data.`,
      409,
    );
  }
  if (payload.allowedPlayerIds.length > MAX_CHOICE_ALLOWED_PLAYERS) {
    throw choiceError(
      "choice-not-found",
      `Choice ${choiceId} exceeds the allowed player bound.`,
      409,
    );
  }
  const allowed = payload.allowedPlayerIds.map((value) =>
    typeof value === "string" && IDENTIFIER_PATTERN.test(value) ? value : undefined
  );
  if (allowed.some((value) => value === undefined)) {
    throw choiceError(
      "choice-not-found",
      `Choice ${choiceId} has invalid player authorization data.`,
      409,
    );
  }
  if (!allowed.includes(playerId)) {
    throw choiceError(
      "choice-not-authorized",
      `Player ${playerId} is not authorized to answer choice ${choiceId}.`,
      403,
    );
  }
}

function choiceOption(payload: JsonRecord, optionId: string, choiceId: string): ChoiceOption {
  if (
    !Array.isArray(payload.options)
    || payload.options.length < 1
    || payload.options.length > MAX_CHOICE_OPTIONS
  ) {
    throw choiceError(
      "choice-not-found",
      `Choice ${choiceId} has no valid bounded options.`,
      409,
    );
  }
  for (const value of payload.options) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const option = value as JsonRecord;
    if (option.optionId !== optionId) continue;
    return {
      optionId,
      label: boundedChoiceLabel(option.label, choiceId, optionId),
    };
  }
  throw choiceError(
    "choice-option-not-found",
    `Option ${optionId} is not available for choice ${choiceId}.`,
    400,
  );
}

function boundedChoiceLabel(value: unknown, choiceId: string, optionId: string): string {
  if (typeof value !== "string") {
    throw choiceError(
      "choice-not-found",
      `Option ${optionId} for choice ${choiceId} has no valid label.`,
      409,
    );
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_CHOICE_LABEL_LENGTH) {
    throw choiceError(
      "choice-not-found",
      `Option ${optionId} for choice ${choiceId} has an invalid label.`,
      409,
    );
  }
  return normalized;
}

function playerPrincipal(value: DurableRpgPrincipal): { kind: "player"; playerId: string } {
  if (!value || value.kind !== "player") {
    throw new DurableRpgCampaignServiceError({
      code: "forbidden",
      message: "Campaign player operations require an authenticated player principal.",
      status: 403,
    });
  }
  return { kind: "player", playerId: identifier(value.playerId, "playerId") };
}

function runtimePrincipal(value: DurableRpgPrincipal): { kind: "runtime"; serviceId: string } {
  if (!value || value.kind !== "runtime") {
    throw new DurableRpgCampaignServiceError({
      code: "forbidden",
      message: "Runtime event publication requires a runtime service principal.",
      status: 403,
    });
  }
  return { kind: "runtime", serviceId: identifier(value.serviceId, "serviceId") };
}

function mapCampaignError(error: unknown): DurableRpgCampaignServiceError {
  if (!(error instanceof SqliteRpgCampaignStoreError)) return internal(error);
  return new DurableRpgCampaignServiceError({
    code: error.code,
    message: error.message,
    status: error.code === "campaign-not-found" ? 404
      : error.code === "campaign-access-denied" ? 403
      : error.code === "campaign-bootstrap-conflict" ? 409
      : error.code === "invalid-input" ? 400
      : 500,
    retryable: false,
    cause: error,
  });
}

function mapCommandError(
  error: unknown,
  state: ReturnType<SqliteRpgCommandAcceptanceRepository["state"]>,
): DurableRpgCampaignServiceError {
  if (!(error instanceof SqliteRpgCommandAcceptanceError)) return internal(error);
  return new DurableRpgCampaignServiceError({
    code: error.code,
    message: error.message,
    status: error.code === "campaign-not-found" ? 404
      : error.code === "player-not-authorized" ? 403
      : error.code === "invalid-input" ? 400
      : error.code === "corrupt-store" ? 500
      : 409,
    retryable: error.code === "coordination-revision-conflict",
    ...(state ? { state } : {}),
    cause: error,
  });
}

function mapRuntimeLinkError(
  error: unknown,
  state: ReturnType<SqliteRpgCommandAcceptanceRepository["state"]>,
): DurableRpgCampaignServiceError {
  if (!(error instanceof SqliteRpgRuntimeLinkError)) return internal(error);
  return new DurableRpgCampaignServiceError({
    code: error.code,
    message: error.message,
    status: error.code === "campaign-not-found" ? 404
      : error.code === "invalid-input" ? 400
      : error.code === "corrupt-store" ? 500
      : 409,
    retryable:
      error.code === "coordination-revision-conflict"
      || error.code === "runtime-source-revision-conflict",
    ...(state ? { state } : {}),
    cause: error,
  });
}

function internal(error: unknown): DurableRpgCampaignServiceError {
  return new DurableRpgCampaignServiceError({
    code: "internal-error",
    message: "The durable RPG campaign service could not complete the operation.",
    status: 500,
    cause: error,
  });
}

function requireProtocol(request: JsonRecord): void {
  if (request.protocolVersion !== DURABLE_RPG_CAMPAIGN_PROTOCOL_VERSION) {
    throw new DurableRpgCampaignServiceError({
      code: "unsupported-protocol-version",
      message: `RPG protocol version ${String(request.protocolVersion)} is not supported.`,
      status: 400,
    });
  }
}

function requestRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalid(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function invalid(message: string): DurableRpgCampaignServiceError {
  return new DurableRpgCampaignServiceError({
    code: "invalid-command",
    message,
    status: 400,
  });
}

function choiceError(code: string, message: string, status: number): DurableRpgCampaignServiceError {
  return new DurableRpgCampaignServiceError({ code, message, status });
}

function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) {
    throw invalid(`${label} is not a valid identifier`);
  }
  return value;
}

function boundedText(value: unknown, label: string, maximumLength: number): string {
  if (typeof value !== "string") throw invalid(`${label} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximumLength) {
    throw invalid(`${label} must contain from 1 through ${maximumLength} characters`);
  }
  return normalized;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw invalid(`${label} must be a non-negative integer`);
  }
  return value;
}

function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw invalid(`${label} must be a timestamp`);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw invalid(`${label} must be a valid timestamp`);
  return new Date(milliseconds).toISOString();
}

function actionEventId(campaignId: string, commandId: string): string {
  return `event:action:${commandDigest(campaignId, commandId)}`;
}

function choiceEventId(campaignId: string, commandId: string): string {
  return `event:choice:${commandDigest(campaignId, commandId)}`;
}

function commandDigest(campaignId: string, commandId: string): string {
  return createHash("sha256")
    .update(campaignId, "utf8")
    .update("\0")
    .update(commandId, "utf8")
    .digest("base64url");
}
