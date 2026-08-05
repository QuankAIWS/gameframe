import { createHash } from "node:crypto";

import {
  SqliteRpgCampaignStore,
  SqliteRpgCampaignStoreError,
  type DurableCampaignBootstrap,
  type DurableCampaignBootstrapReceipt,
  type PlayerCampaignProjection,
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

type JsonRecord = Record<string, unknown>;

export type DurableRpgPrincipal =
  | { kind: "player"; playerId: string }
  | { kind: "runtime"; serviceId: string };

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
    if (command.kind !== "campaign.submit_action") {
      throw new DurableRpgCampaignServiceError({
        code: "unsupported-command",
        message: "The durable campaign service currently accepts campaign.submit_action.",
        status: 400,
      });
    }
    const visibility = command.visibility === "public"
      ? "public" as const
      : command.visibility === "private-to-runtime"
        ? "private-to-runtime" as const
        : undefined;
    if (!visibility) {
      throw invalid("command.visibility is not supported");
    }
    const text = boundedText(command.text, "command.text", MAX_ACTION_TEXT_LENGTH);
    const expected = nonNegativeInteger(
      command.expectedGameframeCoordinationRevision,
      "expectedGameframeCoordinationRevision",
    );
    const presentationEvents = visibility === "public"
      ? [
          {
            eventId: actionEventId(campaignId, commandId),
            kind: "campaign.action_submitted",
            audience: { kind: "public" as const },
            payload: {
              commandId,
              actorId: principal.playerId,
              text,
            },
          },
        ]
      : [];
    try {
      return this.#commands.acceptCommand({
        campaignId,
        commandId,
        authenticatedPlayerId: principal.playerId,
        expectedGameframeCoordinationRevision: expected,
        issuedAt,
        command: {
          kind: "campaign.submit_action",
          visibility,
          text,
        },
        presentationEvents,
      });
    } catch (error) {
      throw mapCommandError(error, this.#commands.state(campaignId));
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
  return `event:action:${createHash("sha256")
    .update(campaignId, "utf8")
    .update("\0")
    .update(commandId, "utf8")
    .digest("base64url")}`;
}
