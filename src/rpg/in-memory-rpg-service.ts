import { readFileSync } from "node:fs";

export const RPG_CAMPAIGN_PROTOCOL_VERSION = 1;
export const RPG_ENCOUNTER_PROTOCOL_VERSION = 1;

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const MAX_CONNECTION_ID_LENGTH = 160;
const MAX_COMMAND_TEXT_LENGTH = 2_000;
const MAX_PARTICIPANTS = 32;
const MAX_OBJECTIVES = 32;
const MAX_RUNTIME_EVENTS = 16;
const MAX_CHOICE_OPTIONS = 16;
const MAX_CONDITIONS = 32;
const MAX_REWARDS = 32;
const RPG_RUNTIME_SERVICE_ID = "rpg-gm-runtime";
const GAMEFRAME_ENCOUNTER_ENGINE_SERVICE_ID = "gameframe-encounter-engine";

export type RpgPrincipal =
  | { kind: "player"; playerId: string }
  | { kind: "runtime"; serviceId: string };

export type RpgAudience =
  | { kind: "public" }
  | { kind: "player"; playerId: string }
  | { kind: "party"; partyId: string }
  | { kind: "runtime" };

export type RpgEvent = {
  eventId: string;
  sequence: number;
  type: string;
  audience: RpgAudience;
  payload: unknown;
  createdAt: string;
};

export type RpgCampaignSnapshot = {
  schemaVersion: number;
  campaignId: string;
  title: string;
  status: "active" | "completed" | "archived";
  revision: number;
  createdAt: string;
  updatedAt: string;
  events: RpgEvent[];
};

export type RpgCampaignAttachRequest = {
  protocolVersion: 1;
  kind: "campaign.attach";
  campaignId: string;
  connectionId: string;
  cursor?: string;
  limit?: number;
};

export type RpgCampaignAttached = {
  protocolVersion: 1;
  kind: "campaign.attached";
  campaignId: string;
  campaignRevision: number;
  events: RpgEvent[];
  cursor: string;
  hasMore: false;
};

export type RpgCommandAccepted = {
  protocolVersion: 1;
  kind: "campaign.command_accepted";
  campaignId: string;
  commandId: string;
  campaignRevision: number;
  eventId: string;
  eventIds?: string[];
};

export type RpgCommandRejected = {
  protocolVersion: 1;
  kind: "campaign.command_rejected";
  campaignId: string;
  commandId: string;
  campaignRevision: number;
  code: "invalid-command" | "revision-conflict";
  retryable: boolean;
};

export type RpgCommandResponse = RpgCommandAccepted | RpgCommandRejected;

export type RpgRuntimeEventsAccepted = {
  protocolVersion: 1;
  kind: "campaign.events_appended";
  campaignId: string;
  batchId: string;
  campaignRevision: number;
  eventIds: string[];
};

export type RpgTerminalOutcome = {
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

export type RpgEncounterHandle = {
  protocolVersion: 1;
  encounterId: string;
  campaignId: string;
  state: "preparing" | "completed";
  resumeToken: string;
  terminalOutcome?: RpgTerminalOutcome;
};

export class RpgServiceError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;
  readonly revision?: number;

  constructor(input: {
    code: string;
    message: string;
    status?: number;
    retryable?: boolean;
    revision?: number;
  }) {
    super(input.message);
    this.name = "RpgServiceError";
    this.code = input.code;
    this.status = input.status ?? 400;
    this.retryable = input.retryable ?? false;
    if (input.revision !== undefined) this.revision = input.revision;
  }
}

type Member = {
  playerId: string;
  role: "player" | "observer";
  active: boolean;
  partyIds: string[];
};

type SubmitActionCommand = {
  kind: "campaign.submit_action";
  expectedRevision: number;
  visibility: "public" | "private";
  text: string;
};

type SubmitChoiceCommand = {
  kind: "campaign.submit_choice";
  expectedRevision: number;
  choiceId: string;
  optionId: string;
};

type CommandEnvelope = {
  protocolVersion: 1;
  commandId: string;
  campaignId: string;
  issuedAt: string;
  command: SubmitActionCommand | SubmitChoiceCommand;
};

type RuntimeEventInput = {
  eventId: string;
  type: "choice.presented" | "encounter.completed" | "scene.presented" | "narration.presented" | "campaign.reveal";
  audience: RpgAudience;
  payload: Record<string, unknown>;
  createdAt: string;
};

type RuntimeEventBatch = {
  protocolVersion: 1;
  batchId: string;
  campaignId: string;
  expectedRevision: number;
  events: RuntimeEventInput[];
};

type EncounterRequest = {
  protocolVersion: 1;
  encounterId: string;
  campaignId: string;
  campaignRevision: number;
  rulesetId: string;
  idempotencyKey: string;
  participants: Record<string, unknown>[];
  objectives: Record<string, unknown>[];
  battlefield: Record<string, unknown>;
  difficulty: Record<string, unknown>;
  [key: string]: unknown;
};

type EncounterCompletionRequest = {
  protocolVersion: 1;
  completionId: string;
  encounterId: string;
  outcome: RpgTerminalOutcome;
};

type CommandReceipt = {
  fingerprint: string;
  response: RpgCommandResponse;
};

type RuntimeEventReceipt = {
  fingerprint: string;
  response: RpgRuntimeEventsAccepted;
};

type EncounterRecord = {
  fingerprint: string;
  handle: RpgEncounterHandle;
  request: EncounterRequest;
  serviceId: string;
  completionReceipt?: {
    fingerprint: string;
    handle: RpgEncounterHandle;
  };
};

type ChoiceOption = {
  optionId: string;
  label: string;
  check: {
    checkId: string;
    kind: string;
    target: number;
    deterministicRoll: number;
    modifier: number;
    success: Record<string, unknown>;
    failure: Record<string, unknown>;
  };
};

type OpenChoice = {
  choiceId: string;
  audience: RpgAudience;
  allowedPlayerIds: string[];
  options: ChoiceOption[];
};

export type InMemoryRpgServiceOptions = {
  campaigns?: readonly RpgCampaignSnapshot[];
  createEventId?: () => string;
  now?: () => string;
};

export class InMemoryRpgService {
  readonly #campaigns = new Map<string, RpgCampaignSnapshot>();
  readonly #commandReceipts = new Map<string, CommandReceipt>();
  readonly #runtimeEventReceipts = new Map<string, RuntimeEventReceipt>();
  readonly #encounters = new Map<string, EncounterRecord>();
  readonly #encounterIdempotency = new Map<string, EncounterRecord>();
  readonly #createEventId: () => string;
  readonly #now: () => string;

  constructor(options: InMemoryRpgServiceOptions = {}) {
    for (const campaign of options.campaigns ?? [loadMonsterMasterReferenceCampaign()]) {
      validateCampaignSnapshot(campaign);
      this.#campaigns.set(campaign.campaignId, structuredClone(campaign));
    }
    this.#createEventId = options.createEventId ?? (() => `rpg-event:${crypto.randomUUID()}`);
    this.#now = options.now ?? (() => new Date().toISOString());
  }

  async attachCampaign(
    requestValue: unknown,
    principalValue: RpgPrincipal,
  ): Promise<RpgCampaignAttached> {
    const request = normalizeAttachRequest(requestValue);
    const principal = normalizePrincipal(principalValue);
    if (principal.kind !== "player") {
      throw forbidden("Campaign attachment requires a player principal.");
    }

    const campaign = this.#getCampaign(request.campaignId);
    requireActiveCampaign(campaign);
    const projection = projectVisibleEvents(campaign, principal.playerId);
    if (!projection.activeMember) {
      throw forbidden("The authenticated player is not an active campaign member.");
    }

    return {
      protocolVersion: RPG_CAMPAIGN_PROTOCOL_VERSION,
      kind: "campaign.attached",
      campaignId: campaign.campaignId,
      campaignRevision: campaign.revision,
      events: projection.events,
      cursor: `campaign:${campaign.campaignId}:revision:${campaign.revision}`,
      hasMore: false,
    };
  }

  async handleCommand(
    envelopeValue: unknown,
    principalValue: RpgPrincipal,
  ): Promise<RpgCommandResponse> {
    const envelope = normalizeCommandEnvelope(envelopeValue);
    const principal = normalizePrincipal(principalValue);
    if (principal.kind !== "player") {
      throw forbidden("Campaign player commands require a player principal.");
    }

    const receiptKey = commandReceiptKey(envelope.campaignId, principal.playerId, envelope.commandId);
    const fingerprint = stableJson(envelope);
    const receipt = this.#commandReceipts.get(receiptKey);
    if (receipt?.fingerprint === fingerprint) {
      return structuredClone(receipt.response);
    }

    const campaign = this.#getCampaign(envelope.campaignId);
    requireActiveCampaign(campaign);
    const member = projectMembers(campaign.events).get(principal.playerId);
    if (!member?.active || member.role !== "player") {
      throw forbidden("The authenticated player cannot submit campaign actions.");
    }

    if (receipt) {
      return rejectedCommand(campaign, envelope.commandId, "invalid-command", false);
    }
    if (campaign.revision !== envelope.command.expectedRevision) {
      return rejectedCommand(campaign, envelope.commandId, "revision-conflict", true);
    }

    const events = envelope.command.kind === "campaign.submit_action"
      ? [this.#createActionEvent(campaign, envelope, principal.playerId)]
      : this.#createChoiceEvents(campaign, envelope, principal.playerId);
    appendCampaignEvents(campaign, events);

    const eventIds = events.map((event) => event.eventId);
    const response: RpgCommandAccepted = {
      protocolVersion: RPG_CAMPAIGN_PROTOCOL_VERSION,
      kind: "campaign.command_accepted",
      campaignId: campaign.campaignId,
      commandId: envelope.commandId,
      campaignRevision: campaign.revision,
      eventId: eventIds[0],
      ...(eventIds.length > 1 ? { eventIds } : {}),
    };
    this.#commandReceipts.set(receiptKey, { fingerprint, response: structuredClone(response) });
    return response;
  }

  async appendRuntimeEvents(
    batchValue: unknown,
    principalValue: RpgPrincipal,
  ): Promise<RpgRuntimeEventsAccepted> {
    const principal = normalizePrincipal(principalValue);
    if (principal.kind !== "runtime" || principal.serviceId !== RPG_RUNTIME_SERVICE_ID) {
      throw forbidden("Campaign presentation events require the RPG runtime service principal.");
    }
    const batch = normalizeRuntimeEventBatch(batchValue);
    const receiptKey = runtimeEventReceiptKey(batch.campaignId, principal.serviceId, batch.batchId);
    const fingerprint = stableJson(batch);
    const receipt = this.#runtimeEventReceipts.get(receiptKey);
    if (receipt?.fingerprint === fingerprint) return structuredClone(receipt.response);

    const campaign = this.#getCampaign(batch.campaignId);
    requireActiveCampaign(campaign);
    if (receipt) {
      throw new RpgServiceError({
        code: "invalid-command",
        message: "Runtime event batch ID was reused with a different request.",
        status: 409,
      });
    }
    if (campaign.revision !== batch.expectedRevision) {
      throw new RpgServiceError({
        code: "revision-conflict",
        message: `Campaign revision conflict: expected ${batch.expectedRevision}, actual ${campaign.revision}.`,
        status: 409,
        retryable: true,
        revision: campaign.revision,
      });
    }

    const members = projectMembers(campaign.events);
    for (const event of batch.events) validateAudienceMembership(event.audience, members);
    const appended = batch.events.map((input, index): RpgEvent => ({
      eventId: input.eventId,
      sequence: campaign.revision + index + 1,
      type: input.type,
      audience: structuredClone(input.audience),
      payload: structuredClone(input.payload),
      createdAt: input.createdAt,
    }));
    appendCampaignEvents(campaign, appended);
    const response: RpgRuntimeEventsAccepted = {
      protocolVersion: RPG_CAMPAIGN_PROTOCOL_VERSION,
      kind: "campaign.events_appended",
      campaignId: campaign.campaignId,
      batchId: batch.batchId,
      campaignRevision: campaign.revision,
      eventIds: appended.map((event) => event.eventId),
    };
    this.#runtimeEventReceipts.set(receiptKey, { fingerprint, response: structuredClone(response) });
    return response;
  }

  async launchEncounter(
    requestValue: unknown,
    principalValue: RpgPrincipal,
  ): Promise<RpgEncounterHandle> {
    const principal = normalizePrincipal(principalValue);
    if (principal.kind !== "runtime") {
      throw forbidden("Encounter operations require the RPG runtime service principal.");
    }

    const request = normalizeEncounterRequest(requestValue);
    const fingerprint = stableJson(request);
    const receiptKey = encounterReceiptKey(
      request.campaignId,
      principal.serviceId,
      request.idempotencyKey,
    );
    const existingReceipt = this.#encounterIdempotency.get(receiptKey);
    if (existingReceipt) {
      if (existingReceipt.fingerprint !== fingerprint) {
        throw new RpgServiceError({
          code: "invalid-command",
          message: "Encounter idempotency key was reused with a different request.",
          status: 409,
        });
      }
      return structuredClone(existingReceipt.handle);
    }

    const campaign = this.#getCampaign(request.campaignId);
    requireActiveCampaign(campaign);
    if (campaign.revision !== request.campaignRevision) {
      throw new RpgServiceError({
        code: "revision-conflict",
        message: `Campaign revision conflict: expected ${request.campaignRevision}, actual ${campaign.revision}.`,
        status: 409,
        retryable: true,
        revision: campaign.revision,
      });
    }

    const members = projectMembers(campaign.events);
    for (const participant of request.participants) {
      const controller = record(participant.controller, "participant.controller");
      if (controller.kind !== "player") continue;
      const playerId = normalizeIdentifier(controller.playerId, "participant.controller.playerId");
      const member = members.get(playerId);
      if (!member?.active || member.role !== "player") {
        throw forbidden(`Encounter participant is not an active player member: ${playerId}`);
      }
    }

    if (this.#encounters.has(request.encounterId)) {
      throw new RpgServiceError({
        code: "invalid-command",
        message: `Encounter already exists: ${request.encounterId}`,
        status: 409,
      });
    }

    const handle: RpgEncounterHandle = {
      protocolVersion: RPG_ENCOUNTER_PROTOCOL_VERSION,
      encounterId: request.encounterId,
      campaignId: campaign.campaignId,
      state: "preparing",
      resumeToken: `mock:${request.encounterId}`,
    };
    const entry: EncounterRecord = {
      fingerprint,
      handle: structuredClone(handle),
      request: structuredClone(request),
      serviceId: principal.serviceId,
    };
    this.#encounters.set(request.encounterId, entry);
    this.#encounterIdempotency.set(receiptKey, entry);
    return handle;
  }

  async completeEncounter(
    encounterIdValue: unknown,
    requestValue: unknown,
    principalValue: RpgPrincipal,
  ): Promise<RpgEncounterHandle> {
    const principal = normalizePrincipal(principalValue);
    if (
      principal.kind !== "runtime"
      || principal.serviceId !== GAMEFRAME_ENCOUNTER_ENGINE_SERVICE_ID
    ) {
      throw forbidden("Encounter completion requires the GameFrame encounter-engine principal.");
    }
    const encounterId = normalizeIdentifier(encounterIdValue, "encounterId");
    const request = normalizeEncounterCompletionRequest(requestValue, encounterId);
    const encounter = this.#encounters.get(encounterId);
    if (!encounter) {
      throw new RpgServiceError({
        code: "encounter-not-found",
        message: `Encounter not found: ${encounterId}`,
        status: 404,
      });
    }

    const fingerprint = stableJson(request);
    if (encounter.completionReceipt) {
      if (encounter.completionReceipt.fingerprint !== fingerprint) {
        throw new RpgServiceError({
          code: "invalid-command",
          message: "Encounter completion ID was reused with a different outcome.",
          status: 409,
        });
      }
      return structuredClone(encounter.completionReceipt.handle);
    }

    validateOutcomeAgainstEncounter(request.outcome, encounter.request);
    const completed: RpgEncounterHandle = {
      ...encounter.handle,
      state: "completed",
      terminalOutcome: structuredClone(request.outcome),
    };
    encounter.handle = structuredClone(completed);
    encounter.completionReceipt = { fingerprint, handle: structuredClone(completed) };
    return completed;
  }

  async getEncounter(
    encounterIdValue: unknown,
    principalValue: RpgPrincipal,
  ): Promise<RpgEncounterHandle> {
    const principal = normalizePrincipal(principalValue);
    if (principal.kind !== "runtime") {
      throw forbidden("Encounter operations require the RPG runtime service principal.");
    }

    const encounterId = normalizeIdentifier(encounterIdValue, "encounterId");
    const encounter = this.#encounters.get(encounterId);
    if (!encounter) {
      throw new RpgServiceError({
        code: "encounter-not-found",
        message: `Encounter not found: ${encounterId}`,
        status: 404,
      });
    }
    if (encounter.serviceId !== principal.serviceId) {
      throw forbidden("Encounter belongs to a different runtime service principal.");
    }
    return structuredClone(encounter.handle);
  }

  #createActionEvent(
    campaign: RpgCampaignSnapshot,
    envelope: CommandEnvelope & { command: SubmitActionCommand },
    playerId: string,
  ): RpgEvent {
    return {
      eventId: normalizeIdentifier(this.#createEventId(), "generated eventId"),
      sequence: campaign.revision + 1,
      type: "campaign.action_submitted",
      audience: envelope.command.visibility === "public"
        ? { kind: "public" }
        : { kind: "player", playerId },
      payload: {
        commandId: envelope.commandId,
        playerId,
        text: envelope.command.text,
        issuedAt: envelope.issuedAt,
      },
      createdAt: this.#now(),
    };
  }

  #createChoiceEvents(
    campaign: RpgCampaignSnapshot,
    envelope: CommandEnvelope & { command: SubmitChoiceCommand },
    playerId: string,
  ): RpgEvent[] {
    const choice = findOpenChoice(campaign.events, envelope.command.choiceId);
    if (!choice || !choice.allowedPlayerIds.includes(playerId)) {
      throw invalid("The requested choice is not open for the authenticated player.");
    }
    const option = choice.options.find((candidate) => candidate.optionId === envelope.command.optionId);
    if (!option) throw invalid("The requested choice option is not available.");

    const total = option.check.deterministicRoll + option.check.modifier;
    const result = total >= option.check.target ? "success" : "failure";
    const consequence = result === "success" ? option.check.success : option.check.failure;
    const createdAt = this.#now();
    const baseSequence = campaign.revision;
    const eventIds = [
      normalizeIdentifier(this.#createEventId(), "generated choice eventId"),
      normalizeIdentifier(this.#createEventId(), "generated check eventId"),
      normalizeIdentifier(this.#createEventId(), "generated consequence eventId"),
    ];
    return [
      {
        eventId: eventIds[0],
        sequence: baseSequence + 1,
        type: "campaign.choice_submitted",
        audience: structuredClone(choice.audience),
        payload: {
          commandId: envelope.commandId,
          choiceId: choice.choiceId,
          optionId: option.optionId,
          playerId,
          issuedAt: envelope.issuedAt,
        },
        createdAt,
      },
      {
        eventId: eventIds[1],
        sequence: baseSequence + 2,
        type: "check.resolved",
        audience: structuredClone(choice.audience),
        payload: {
          checkId: option.check.checkId,
          choiceId: choice.choiceId,
          optionId: option.optionId,
          actorPlayerId: playerId,
          kind: option.check.kind,
          target: option.check.target,
          deterministicRoll: option.check.deterministicRoll,
          modifier: option.check.modifier,
          total,
          result,
        },
        createdAt,
      },
      {
        eventId: eventIds[2],
        sequence: baseSequence + 3,
        type: "campaign.consequence",
        audience: structuredClone(choice.audience),
        payload: {
          choiceId: choice.choiceId,
          checkId: option.check.checkId,
          result,
          ...structuredClone(consequence),
        },
        createdAt,
      },
    ];
  }

  #getCampaign(campaignId: string): RpgCampaignSnapshot {
    const campaign = this.#campaigns.get(campaignId);
    if (!campaign) {
      throw new RpgServiceError({
        code: "campaign-not-found",
        message: `Campaign not found: ${campaignId}`,
        status: 404,
      });
    }
    return campaign;
  }
}

export function loadMonsterMasterReferenceCampaign(): RpgCampaignSnapshot {
  const fixture = JSON.parse(
    readFileSync(
      new URL("../../planning/fixtures/rpg/v1/campaign-port-a.json", import.meta.url),
      "utf8",
    ),
  ) as Record<string, unknown>;
  return structuredClone(record(fixture.campaign, "fixture.campaign")) as RpgCampaignSnapshot;
}

function appendCampaignEvents(campaign: RpgCampaignSnapshot, events: readonly RpgEvent[]): void {
  const existingIds = new Set(campaign.events.map((event) => event.eventId));
  for (const event of events) {
    if (existingIds.has(event.eventId)) throw invalid(`Duplicate campaign event ID: ${event.eventId}`);
    if (event.sequence !== campaign.events.length + 1) {
      throw invalid("Campaign event sequence is invalid.");
    }
    campaign.events.push(structuredClone(event));
    existingIds.add(event.eventId);
  }
  campaign.revision = campaign.events.length;
  campaign.updatedAt = events.at(-1)?.createdAt ?? campaign.updatedAt;
}

function rejectedCommand(
  campaign: RpgCampaignSnapshot,
  commandId: string,
  code: RpgCommandRejected["code"],
  retryable: boolean,
): RpgCommandRejected {
  return {
    protocolVersion: RPG_CAMPAIGN_PROTOCOL_VERSION,
    kind: "campaign.command_rejected",
    campaignId: campaign.campaignId,
    commandId,
    campaignRevision: campaign.revision,
    code,
    retryable,
  };
}

function commandReceiptKey(campaignId: string, playerId: string, commandId: string): string {
  return `${campaignId}\0${playerId}\0${commandId}`;
}

function runtimeEventReceiptKey(campaignId: string, serviceId: string, batchId: string): string {
  return `${campaignId}\0${serviceId}\0${batchId}`;
}

function encounterReceiptKey(campaignId: string, serviceId: string, key: string): string {
  return `${campaignId}\0${serviceId}\0${key}`;
}

function normalizeAttachRequest(value: unknown): RpgCampaignAttachRequest {
  const input = record(value, "campaign attach request");
  if (input.protocolVersion !== RPG_CAMPAIGN_PROTOCOL_VERSION) {
    throw invalid("Unsupported campaign protocol version.");
  }
  if (input.kind !== "campaign.attach") throw invalid("Unsupported campaign attach kind.");
  const cursor = input.cursor === undefined
    ? undefined
    : normalizeText(input.cursor, "cursor", 8_192);
  const limit = input.limit === undefined
    ? undefined
    : normalizeInteger(input.limit, "limit", 1, 200);
  return {
    protocolVersion: RPG_CAMPAIGN_PROTOCOL_VERSION,
    kind: "campaign.attach",
    campaignId: normalizeIdentifier(input.campaignId, "campaignId"),
    connectionId: normalizeText(input.connectionId, "connectionId", MAX_CONNECTION_ID_LENGTH),
    ...(cursor ? { cursor } : {}),
    ...(limit === undefined ? {} : { limit }),
  };
}

function normalizeCommandEnvelope(value: unknown): CommandEnvelope {
  const input = record(value, "campaign command envelope");
  if (input.protocolVersion !== RPG_CAMPAIGN_PROTOCOL_VERSION) {
    throw invalid("Unsupported campaign protocol version.");
  }
  const command = record(input.command, "command");
  const common = {
    protocolVersion: RPG_CAMPAIGN_PROTOCOL_VERSION,
    commandId: normalizeIdentifier(input.commandId, "commandId"),
    campaignId: normalizeIdentifier(input.campaignId, "campaignId"),
    issuedAt: normalizeTimestamp(input.issuedAt, "issuedAt"),
  } as const;
  if (command.kind === "campaign.submit_action") {
    if (command.visibility !== "public" && command.visibility !== "private") {
      throw invalid("Campaign action visibility must be public or private.");
    }
    return {
      ...common,
      command: {
        kind: "campaign.submit_action",
        expectedRevision: normalizeInteger(command.expectedRevision, "expectedRevision", 0),
        visibility: command.visibility,
        text: normalizeText(command.text, "text", MAX_COMMAND_TEXT_LENGTH),
      },
    };
  }
  if (command.kind === "campaign.submit_choice") {
    return {
      ...common,
      command: {
        kind: "campaign.submit_choice",
        expectedRevision: normalizeInteger(command.expectedRevision, "expectedRevision", 0),
        choiceId: normalizeIdentifier(command.choiceId, "choiceId"),
        optionId: normalizeIdentifier(command.optionId, "optionId"),
      },
    };
  }
  throw invalid("Unsupported campaign command kind.");
}

function normalizeRuntimeEventBatch(value: unknown): RuntimeEventBatch {
  const input = record(value, "runtime event batch");
  if (input.protocolVersion !== RPG_CAMPAIGN_PROTOCOL_VERSION) {
    throw invalid("Unsupported campaign protocol version.");
  }
  const events = boundedArray(input.events, "events", 1, MAX_RUNTIME_EVENTS)
    .map((event, index) => normalizeRuntimeEvent(event, index));
  const eventIds = events.map((event) => event.eventId);
  if (new Set(eventIds).size !== eventIds.length) throw invalid("Runtime event IDs must be unique.");
  return {
    protocolVersion: RPG_CAMPAIGN_PROTOCOL_VERSION,
    batchId: normalizeIdentifier(input.batchId, "batchId"),
    campaignId: normalizeIdentifier(input.campaignId, "campaignId"),
    expectedRevision: normalizeInteger(input.expectedRevision, "expectedRevision", 0),
    events,
  };
}

function normalizeRuntimeEvent(value: unknown, index: number): RuntimeEventInput {
  const input = record(value, `events[${index}]`);
  const allowed = new Set([
    "choice.presented",
    "encounter.completed",
    "scene.presented",
    "narration.presented",
    "campaign.reveal",
  ]);
  if (typeof input.type !== "string" || !allowed.has(input.type)) {
    throw invalid(`events[${index}].type is not supported.`);
  }
  const audience = normalizeAudience(input.audience, `events[${index}].audience`);
  const payload = structuredClone(record(input.payload, `events[${index}].payload`));
  if (input.type === "choice.presented") normalizeChoicePayload(payload);
  return {
    eventId: normalizeIdentifier(input.eventId, `events[${index}].eventId`),
    type: input.type as RuntimeEventInput["type"],
    audience,
    payload,
    createdAt: normalizeTimestamp(input.createdAt, `events[${index}].createdAt`),
  };
}

function normalizeChoicePayload(value: unknown): void {
  const input = record(value, "choice payload");
  normalizeIdentifier(input.choiceId, "choice.choiceId");
  normalizeText(input.prompt, "choice.prompt", 1_000);
  const allowedPlayerIds = boundedArray(input.allowedPlayerIds, "choice.allowedPlayerIds", 1, 32)
    .map((playerId) => normalizeIdentifier(playerId, "choice.allowedPlayerId"));
  if (new Set(allowedPlayerIds).size !== allowedPlayerIds.length) {
    throw invalid("choice.allowedPlayerIds must be unique.");
  }
  const options = boundedArray(input.options, "choice.options", 2, MAX_CHOICE_OPTIONS)
    .map((option, index) => normalizeChoiceOption(option, index));
  const optionIds = options.map((option) => option.optionId);
  if (new Set(optionIds).size !== optionIds.length) throw invalid("choice option IDs must be unique.");
}

function normalizeChoiceOption(value: unknown, index: number): ChoiceOption {
  const input = record(value, `choice.options[${index}]`);
  const check = record(input.check, `choice.options[${index}].check`);
  return {
    optionId: normalizeIdentifier(input.optionId, `choice.options[${index}].optionId`),
    label: normalizeText(input.label, `choice.options[${index}].label`, 240),
    check: {
      checkId: normalizeIdentifier(check.checkId, `choice.options[${index}].check.checkId`),
      kind: normalizeIdentifier(check.kind, `choice.options[${index}].check.kind`),
      target: normalizeInteger(check.target, `choice.options[${index}].check.target`, 0, 10_000),
      deterministicRoll: normalizeInteger(
        check.deterministicRoll,
        `choice.options[${index}].check.deterministicRoll`,
        0,
        10_000,
      ),
      modifier: normalizeInteger(
        check.modifier,
        `choice.options[${index}].check.modifier`,
        -10_000,
        10_000,
      ),
      success: structuredClone(record(check.success, `choice.options[${index}].check.success`)),
      failure: structuredClone(record(check.failure, `choice.options[${index}].check.failure`)),
    },
  };
}

function normalizeEncounterRequest(value: unknown): EncounterRequest {
  const input = record(value, "encounter launch request");
  if (input.protocolVersion !== RPG_ENCOUNTER_PROTOCOL_VERSION) {
    throw invalid("Unsupported encounter protocol version.");
  }
  const participants = boundedArray(input.participants, "participants", 1, MAX_PARTICIPANTS)
    .map((participant, index) => normalizeParticipant(participant, index));
  const objectives = boundedArray(input.objectives, "objectives", 1, MAX_OBJECTIVES)
    .map((objective, index) => structuredClone(record(objective, `objectives[${index}]`)));
  return {
    ...structuredClone(input),
    protocolVersion: RPG_ENCOUNTER_PROTOCOL_VERSION,
    encounterId: normalizeIdentifier(input.encounterId, "encounterId"),
    campaignId: normalizeIdentifier(input.campaignId, "campaignId"),
    campaignRevision: normalizeInteger(input.campaignRevision, "campaignRevision", 0),
    rulesetId: normalizeIdentifier(input.rulesetId, "rulesetId"),
    idempotencyKey: normalizeIdentifier(input.idempotencyKey, "idempotencyKey"),
    participants,
    objectives,
    battlefield: structuredClone(record(input.battlefield, "battlefield")),
    difficulty: structuredClone(record(input.difficulty, "difficulty")),
  };
}

function normalizeEncounterCompletionRequest(
  value: unknown,
  encounterId: string,
): EncounterCompletionRequest {
  const input = record(value, "encounter completion request");
  if (input.protocolVersion !== RPG_ENCOUNTER_PROTOCOL_VERSION) {
    throw invalid("Unsupported encounter protocol version.");
  }
  if (input.encounterId !== encounterId) {
    throw invalid("Encounter ID in the request body must match the route.");
  }
  return {
    protocolVersion: RPG_ENCOUNTER_PROTOCOL_VERSION,
    completionId: normalizeIdentifier(input.completionId, "completionId"),
    encounterId,
    outcome: normalizeTerminalOutcome(input.outcome),
  };
}

function normalizeTerminalOutcome(value: unknown): RpgTerminalOutcome {
  const input = record(value, "terminal outcome");
  if (input.kind !== "encounter.terminal_outcome") throw invalid("Unsupported terminal outcome kind.");
  if (
    input.result !== "victory"
    && input.result !== "defeat"
    && input.result !== "draw"
    && input.result !== "cancelled"
  ) {
    throw invalid("Unsupported terminal outcome result.");
  }
  const objectiveResults = boundedArray(
    input.objectiveResults,
    "outcome.objectiveResults",
    1,
    MAX_OBJECTIVES,
  ).map((value, index) => {
    const item = record(value, `outcome.objectiveResults[${index}]`);
    if (item.status !== "completed" && item.status !== "failed" && item.status !== "partial") {
      throw invalid(`outcome.objectiveResults[${index}].status is invalid.`);
    }
    return {
      objectiveId: normalizeIdentifier(item.objectiveId, `outcome.objectiveResults[${index}].objectiveId`),
      status: item.status,
    };
  });
  const participantResults = boundedArray(
    input.participantResults,
    "outcome.participantResults",
    1,
    MAX_PARTICIPANTS,
  ).map((value, index) => {
    const item = record(value, `outcome.participantResults[${index}]`);
    if (item.status !== "active" && item.status !== "defeated" && item.status !== "withdrawn") {
      throw invalid(`outcome.participantResults[${index}].status is invalid.`);
    }
    const resourceInput = record(
      item.resourceChanges ?? {},
      `outcome.participantResults[${index}].resourceChanges`,
    );
    const resourceChanges = Object.fromEntries(Object.entries(resourceInput).map(([key, amount]) => [
      normalizeIdentifier(key, `outcome.participantResults[${index}].resourceChanges key`),
      normalizeInteger(amount, `outcome.participantResults[${index}].resourceChanges.${key}`, -1_000_000, 1_000_000),
    ]));
    return {
      participantId: normalizeIdentifier(item.participantId, `outcome.participantResults[${index}].participantId`),
      status: item.status,
      ...(item.healthRemaining === undefined
        ? {}
        : { healthRemaining: normalizeInteger(item.healthRemaining, `outcome.participantResults[${index}].healthRemaining`, 0, 1_000_000) }),
      conditions: boundedArray(item.conditions ?? [], `outcome.participantResults[${index}].conditions`, 0, MAX_CONDITIONS)
        .map((condition) => normalizeIdentifier(condition, `outcome.participantResults[${index}].condition`)),
      resourceChanges,
    };
  });
  const rewards = boundedArray(input.rewards ?? [], "outcome.rewards", 0, MAX_REWARDS)
    .map((value, index) => {
      const item = record(value, `outcome.rewards[${index}]`);
      if (
        item.kind !== "item"
        && item.kind !== "currency"
        && item.kind !== "experience"
        && item.kind !== "flag"
      ) {
        throw invalid(`outcome.rewards[${index}].kind is invalid.`);
      }
      return {
        rewardId: normalizeIdentifier(item.rewardId, `outcome.rewards[${index}].rewardId`),
        kind: item.kind,
        quantity: normalizeInteger(item.quantity, `outcome.rewards[${index}].quantity`, 1, 1_000_000),
      };
    });
  const ruleset = record(input.ruleset, "outcome.ruleset");
  const commit = record(input.commit, "outcome.commit");
  return {
    kind: "encounter.terminal_outcome",
    result: input.result,
    ...(input.winnerTeamId === undefined
      ? {}
      : { winnerTeamId: normalizeIdentifier(input.winnerTeamId, "outcome.winnerTeamId") }),
    objectiveResults,
    participantResults,
    rewards,
    ruleset: {
      id: normalizeIdentifier(ruleset.id, "outcome.ruleset.id"),
      revision: normalizeInteger(ruleset.revision, "outcome.ruleset.revision", 0),
    },
    commit: {
      matchId: normalizeIdentifier(commit.matchId, "outcome.commit.matchId"),
      matchRevision: normalizeInteger(commit.matchRevision, "outcome.commit.matchRevision", 0),
      eventCount: normalizeInteger(commit.eventCount, "outcome.commit.eventCount", 0),
      completedAt: normalizeTimestamp(commit.completedAt, "outcome.commit.completedAt"),
    },
  };
}

function validateOutcomeAgainstEncounter(
  outcome: RpgTerminalOutcome,
  request: EncounterRequest,
): void {
  if (outcome.ruleset.id !== request.rulesetId) {
    throw invalid("Terminal outcome ruleset does not match the encounter.");
  }
  const objectiveIds = new Set(request.objectives.map((objective) =>
    normalizeIdentifier(objective.objectiveId, "encounter objectiveId")
  ));
  const participantIds = new Set(request.participants.map((participant) =>
    normalizeIdentifier(participant.participantId, "encounter participantId")
  ));
  for (const result of outcome.objectiveResults) {
    if (!objectiveIds.has(result.objectiveId)) {
      throw invalid(`Terminal outcome references an unknown objective: ${result.objectiveId}`);
    }
  }
  for (const result of outcome.participantResults) {
    if (!participantIds.has(result.participantId)) {
      throw invalid(`Terminal outcome references an unknown participant: ${result.participantId}`);
    }
  }
}

function normalizeParticipant(value: unknown, index: number): Record<string, unknown> {
  const input = record(value, `participants[${index}]`);
  const controller = record(input.controller, `participants[${index}].controller`);
  if (controller.kind !== "player" && controller.kind !== "runtime") {
    throw invalid(`participants[${index}].controller.kind is not supported.`);
  }
  return {
    ...structuredClone(input),
    participantId: normalizeIdentifier(input.participantId, `participants[${index}].participantId`),
    teamId: normalizeIdentifier(input.teamId, `participants[${index}].teamId`),
    displayName: normalizeText(input.displayName, `participants[${index}].displayName`, 120),
    controller: controller.kind === "player"
      ? {
          kind: "player",
          playerId: normalizeIdentifier(
            controller.playerId,
            `participants[${index}].controller.playerId`,
          ),
        }
      : { kind: "runtime" },
    rulesState: structuredClone(record(input.rulesState, `participants[${index}].rulesState`)),
  };
}

function findOpenChoice(events: readonly RpgEvent[], choiceId: string): OpenChoice | null {
  let open: OpenChoice | null = null;
  for (const event of events) {
    if (event.type === "choice.presented") {
      const payload = record(event.payload, `${event.eventId}.payload`);
      if (payload.choiceId !== choiceId) continue;
      normalizeChoicePayload(payload);
      open = {
        choiceId,
        audience: structuredClone(event.audience),
        allowedPlayerIds: (payload.allowedPlayerIds as unknown[])
          .map((playerId) => normalizeIdentifier(playerId, "choice.allowedPlayerId")),
        options: (payload.options as unknown[])
          .map((option, index) => normalizeChoiceOption(option, index)),
      };
    } else if (event.type === "campaign.choice_submitted") {
      const payload = record(event.payload, `${event.eventId}.payload`);
      if (payload.choiceId === choiceId) open = null;
    }
  }
  return open;
}

function projectVisibleEvents(campaign: RpgCampaignSnapshot, playerId: string) {
  const members = new Map<string, Member>();
  const visible: RpgEvent[] = [];
  for (const event of campaign.events) {
    applyMembershipEvent(members, event);
    const member = members.get(playerId);
    if (!member?.active) continue;
    if (event.audience.kind === "public") {
      visible.push(structuredClone(event));
    } else if (event.audience.kind === "player" && event.audience.playerId === playerId) {
      visible.push(structuredClone(event));
    } else if (event.audience.kind === "party" && member.partyIds.includes(event.audience.partyId)) {
      visible.push(structuredClone(event));
    }
  }
  return { events: visible, activeMember: Boolean(members.get(playerId)?.active) };
}

function projectMembers(events: readonly RpgEvent[]): Map<string, Member> {
  const members = new Map<string, Member>();
  for (const event of events) applyMembershipEvent(members, event);
  return members;
}

function applyMembershipEvent(members: Map<string, Member>, event: RpgEvent): void {
  if (event.type === "campaign.member_added") {
    const payload = record(event.payload, `${event.eventId}.payload`);
    const playerId = normalizeIdentifier(payload.playerId, "membership.playerId");
    if (payload.role !== "player" && payload.role !== "observer") {
      throw invalid("Membership role is invalid.");
    }
    const partyIds = Array.isArray(payload.partyIds)
      ? payload.partyIds.map((value) => normalizeIdentifier(value, "membership.partyId"))
      : [];
    members.set(playerId, {
      playerId,
      role: payload.role,
      active: true,
      partyIds,
    });
    return;
  }
  if (event.type === "campaign.member_removed") {
    const payload = record(event.payload, `${event.eventId}.payload`);
    const member = members.get(normalizeIdentifier(payload.playerId, "membership.playerId"));
    if (member) member.active = false;
    return;
  }
  if (event.type === "campaign.member_parties_changed") {
    const payload = record(event.payload, `${event.eventId}.payload`);
    const member = members.get(normalizeIdentifier(payload.playerId, "membership.playerId"));
    if (member) {
      member.partyIds = Array.isArray(payload.partyIds)
        ? payload.partyIds.map((value) => normalizeIdentifier(value, "membership.partyId"))
        : [];
    }
  }
}

function validateAudienceMembership(audience: RpgAudience, members: Map<string, Member>): void {
  if (audience.kind === "player") {
    if (!members.get(audience.playerId)?.active) {
      throw invalid(`Runtime event targets an inactive player: ${audience.playerId}`);
    }
  } else if (audience.kind === "party") {
    if (![...members.values()].some((member) =>
      member.active && member.partyIds.includes(audience.partyId)
    )) {
      throw invalid(`Runtime event targets an inactive party: ${audience.partyId}`);
    }
  }
}

function normalizeAudience(value: unknown, label: string): RpgAudience {
  const input = record(value, label);
  if (input.kind === "public" || input.kind === "runtime") return { kind: input.kind };
  if (input.kind === "player") {
    return { kind: "player", playerId: normalizeIdentifier(input.playerId, `${label}.playerId`) };
  }
  if (input.kind === "party") {
    return { kind: "party", partyId: normalizeIdentifier(input.partyId, `${label}.partyId`) };
  }
  throw invalid(`${label}.kind is not supported.`);
}

function validateCampaignSnapshot(campaign: RpgCampaignSnapshot): void {
  normalizeIdentifier(campaign.campaignId, "campaign.campaignId");
  normalizeText(campaign.title, "campaign.title", 200);
  if (!Number.isInteger(campaign.revision) || campaign.revision < 0) {
    throw invalid("Campaign revision is invalid.");
  }
  if (campaign.events.length !== campaign.revision) {
    throw invalid("Campaign events must match revision.");
  }
  for (const [index, event] of campaign.events.entries()) {
    if (event.sequence !== index + 1) throw invalid("Campaign event sequence is invalid.");
    normalizeIdentifier(event.eventId, "event.eventId");
  }
}

function requireActiveCampaign(campaign: RpgCampaignSnapshot): void {
  if (campaign.status !== "active") {
    throw new RpgServiceError({
      code: "invalid-state",
      message: `Campaign is not active: ${campaign.campaignId}`,
      status: 409,
    });
  }
}

function normalizePrincipal(value: RpgPrincipal): RpgPrincipal {
  if (!value || typeof value !== "object") {
    throw forbidden("Authenticated principal is required.");
  }
  if (value.kind === "runtime") {
    return { kind: "runtime", serviceId: normalizeIdentifier(value.serviceId, "serviceId") };
  }
  if (value.kind === "player") {
    return { kind: "player", playerId: normalizeIdentifier(value.playerId, "playerId") };
  }
  throw forbidden("Authenticated principal kind is not supported.");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    return `{${Object.keys(input)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(input[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizeIdentifier(value: unknown, label: string): string {
  const normalized = normalizeText(value, label, 160);
  if (!IDENTIFIER_PATTERN.test(normalized)) {
    throw invalid(`${label} is not a valid identifier.`);
  }
  return normalized;
}

function normalizeText(value: unknown, label: string, maximumLength: number): string {
  if (typeof value !== "string") throw invalid(`${label} must be a string.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximumLength) {
    throw invalid(`${label} is invalid.`);
  }
  return normalized;
}

function normalizeInteger(
  value: unknown,
  label: string,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw invalid(`${label} must be an integer between ${minimum} and ${maximum}.`);
  }
  return Number(value);
}

function normalizeTimestamp(value: unknown, label: string): string {
  const normalized = normalizeText(value, label, 64);
  if (Number.isNaN(Date.parse(normalized))) {
    throw invalid(`${label} must be an ISO timestamp.`);
  }
  return normalized;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalid(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function boundedArray(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): unknown[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw invalid(`${label} must contain between ${minimum} and ${maximum} entries.`);
  }
  return value;
}

function invalid(message: string): RpgServiceError {
  return new RpgServiceError({ code: "invalid-command", message, status: 400 });
}

function forbidden(message: string): RpgServiceError {
  return new RpgServiceError({ code: "forbidden", message, status: 403 });
}
