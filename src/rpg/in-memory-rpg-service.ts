import { readFileSync } from "node:fs";

export const RPG_CAMPAIGN_PROTOCOL_VERSION = 1;
export const RPG_ENCOUNTER_PROTOCOL_VERSION = 1;

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const MAX_CONNECTION_ID_LENGTH = 160;
const MAX_COMMAND_TEXT_LENGTH = 2_000;
const MAX_PARTICIPANTS = 32;
const MAX_OBJECTIVES = 32;

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

export type RpgEncounterHandle = {
  protocolVersion: 1;
  encounterId: string;
  campaignId: string;
  state: "preparing";
  resumeToken: string;
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

type CommandReceipt = {
  fingerprint: string;
  response: RpgCommandResponse;
};

type EncounterRecord = {
  fingerprint: string;
  handle: RpgEncounterHandle;
  request: Record<string, unknown>;
  serviceId: string;
};

export type InMemoryRpgServiceOptions = {
  campaigns?: readonly RpgCampaignSnapshot[];
  createEventId?: () => string;
  now?: () => string;
};

export class InMemoryRpgService {
  readonly #campaigns = new Map<string, RpgCampaignSnapshot>();
  readonly #commandReceipts = new Map<string, CommandReceipt>();
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

    const projection = projectVisibleEvents(campaign, principal);
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

    const campaign = this.#getCampaign(envelope.campaignId);
    requireActiveCampaign(campaign);
    const members = projectMembers(campaign.events);
    const member = members.get(principal.playerId);
    if (!member?.active || member.role !== "player") {
      throw forbidden("The authenticated player cannot submit campaign actions.");
    }

    const receiptKey = `${campaign.campaignId}\0${principal.playerId}\0${envelope.commandId}`;
    const fingerprint = stableJson(envelope);
    const receipt = this.#commandReceipts.get(receiptKey);
    if (receipt) {
      if (receipt.fingerprint === fingerprint) return structuredClone(receipt.response);
      return {
        protocolVersion: RPG_CAMPAIGN_PROTOCOL_VERSION,
        kind: "campaign.command_rejected",
        campaignId: campaign.campaignId,
        commandId: envelope.commandId,
        campaignRevision: campaign.revision,
        code: "invalid-command",
        retryable: false,
      };
    }

    if (campaign.revision !== envelope.command.expectedRevision) {
      return {
        protocolVersion: RPG_CAMPAIGN_PROTOCOL_VERSION,
        kind: "campaign.command_rejected",
        campaignId: campaign.campaignId,
        commandId: envelope.commandId,
        campaignRevision: campaign.revision,
        code: "revision-conflict",
        retryable: true,
      };
    }

    const createdAt = this.#now();
    const event: RpgEvent = {
      eventId: normalizeIdentifier(this.#createEventId(), "generated eventId"),
      sequence: campaign.revision + 1,
      type: "campaign.action_submitted",
      audience: envelope.command.visibility === "public"
        ? { kind: "public" }
        : { kind: "player", playerId: principal.playerId },
      payload: {
        commandId: envelope.commandId,
        playerId: principal.playerId,
        text: envelope.command.text,
        issuedAt: envelope.issuedAt,
      },
      createdAt,
    };
    campaign.events.push(event);
    campaign.revision = event.sequence;
    campaign.updatedAt = createdAt;

    const response: RpgCommandAccepted = {
      protocolVersion: RPG_CAMPAIGN_PROTOCOL_VERSION,
      kind: "campaign.command_accepted",
      campaignId: campaign.campaignId,
      commandId: envelope.commandId,
      campaignRevision: campaign.revision,
      eventId: event.eventId,
    };
    this.#commandReceipts.set(receiptKey, { fingerprint, response: structuredClone(response) });
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

    const fingerprint = stableJson(request);
    const receiptKey = `${campaign.campaignId}\0${principal.serviceId}\0${request.idempotencyKey}`;
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

  async getEncounter(
    encounterIdValue: unknown,
    principalValue: RpgPrincipal,
  ): Promise<RpgEncounterHandle> {
    const principal = normalizePrincipal(principalValue);
    if (principal.kind !== "runtime") {
      throw forbidden("Encounter operations require the RPG runtime service principal.");
    }
    const encounterId = normalizeIdentifier(encounterIdValue, "encounterId");
    const record = this.#encounters.get(encounterId);
    if (!record) {
      throw new RpgServiceError({
        code: "encounter-not-found",
        message: `Encounter not found: ${encounterId}`,
        status: 404,
      });
    }
    if (record.serviceId !== principal.serviceId) {
      throw forbidden("Encounter belongs to a different runtime service principal.");
    }
    return structuredClone(record.handle);
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

function normalizeAttachRequest(value: unknown): RpgCampaignAttachRequest {
  const input = record(value, "campaign attach request");
  if (input.protocolVersion !== RPG_CAMPAIGN_PROTOCOL_VERSION) {
    throw invalid("Unsupported campaign protocol version.");
  }
  if (input.kind !== "campaign.attach") throw invalid("Unsupported campaign attach kind.");
  const cursor = input.cursor === undefined ? undefined : normalizeText(input.cursor, "cursor", 8_192);
  const limit = input.limit === undefined ? undefined : normalizeInteger(input.limit, "limit", 1, 200);
  return {
    protocolVersion: RPG_CAMPAIGN_PROTOCOL_VERSION,
    kind: "campaign.attach",
    campaignId: normalizeIdentifier(input.campaignId, "campaignId"),
    connectionId: normalizeText(input.connectionId, "connectionId", MAX_CONNECTION_ID_LENGTH),
    ...(cursor ? { cursor } : {}),
    ...(limit === undefined ? {} : { limit }),
  };
}

function normalizeCommandEnvelope(value: unknown) {
  const input = record(value, "campaign command envelope");
  if (input.protocolVersion !== RPG_CAMPAIGN_PROTOCOL_VERSION) {
    throw invalid("Unsupported campaign protocol version.");
  }
  const command = record(input.command, "command");
  if (command.kind !== "campaign.submit_action") {
    throw invalid("Unsupported campaign command kind.");
  }
  const visibility = command.visibility;
  if (visibility !== "public" && visibility !== "private") {
    throw invalid("Campaign action visibility must be public or private.");
  }
  return {
    protocolVersion: RPG_CAMPAIGN_PROTOCOL_VERSION,
    commandId: normalizeIdentifier(input.commandId, "commandId"),
    campaignId: normalizeIdentifier(input.campaignId, "campaignId"),
    issuedAt: normalizeTimestamp(input.issuedAt, "issuedAt"),
    command: {
      kind: "campaign.submit_action" as const,
      expectedRevision: normalizeInteger(command.expectedRevision, "expectedRevision", 0),
      visibility,
      text: normalizeText(command.text, "text", MAX_COMMAND_TEXT_LENGTH),
    },
  };
}

function normalizeEncounterRequest(value: unknown) {
  const input = record(value, "encounter launch request");
  if (input.protocolVersion !== RPG_ENCOUNTER_PROTOCOL_VERSION) {
    throw invalid("Unsupported encounter protocol version.");
  }
  const participants = array(input.participants, "participants", 1, MAX_PARTICIPANTS)
    .map((participant, index) => normalizeParticipant(participant, index));
  const objectives = array(input.objectives, "objectives", 1, MAX_OBJECTIVES)
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

function projectVisibleEvents(campaign: RpgCampaignSnapshot, principal: RpgPrincipal) {
  const members = new Map<string, Member>();
  const visible: RpgEvent[] = [];
  for (const event of campaign.events) {
    applyMembershipEvent(members, event);
    if (principal.kind === "runtime") {
      visible.push(structuredClone(event));
      continue;
    }
    const member = members.get(principal.playerId);
    if (!member?.active) continue;
    if (event.audience.kind === "public") visible.push(structuredClone(event));
    else if (event.audience.kind === "player" && event.audience.playerId === principal.playerId) {
      visible.push(structuredClone(event));
    } else if (event.audience.kind === "party" && member.partyIds.includes(event.audience.partyId)) {
      visible.push(structuredClone(event));
    }
  }
  const activeMember = principal.kind === "runtime" || Boolean(members.get(principal.playerId)?.active);
  return { events: visible, activeMember };
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
    const role = payload.role;
    if (role !== "player" && role !== "observer") throw invalid("Membership role is invalid.");
    const partyIds = Array.isArray(payload.partyIds)
      ? payload.partyIds.map((value) => normalizeIdentifier(value, "membership.partyId"))
      : [];
    members.set(playerId, { playerId, role, active: true, partyIds });
  } else if (event.type === "campaign.member_removed") {
    const payload = record(event.payload, `${event.eventId}.payload`);
    const member = members.get(normalizeIdentifier(payload.playerId, "membership.playerId"));
    if (member) member.active = false;
  } else if (event.type === "campaign.member_parties_changed") {
    const payload = record(event.payload, `${event.eventId}.payload`);
    const member = members.get(normalizeIdentifier(payload.playerId, "membership.playerId"));
    if (member) {
      member.partyIds = Array.isArray(payload.partyIds)
        ? payload.partyIds.map((value) => normalizeIdentifier(value, "membership.partyId"))
        : [];
    }
  }
}

function validateCampaignSnapshot(campaign: RpgCampaignSnapshot): void {
  normalizeIdentifier(campaign.campaignId, "campaign.campaignId");
  normalizeText(campaign.title, "campaign.title", 200);
  if (!Number.isInteger(campaign.revision) || campaign.revision < 0) throw invalid("Campaign revision is invalid.");
  if (campaign.events.length !== campaign.revision) throw invalid("Campaign events must match revision.");
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
  if (!value || typeof value !== "object") throw forbidden("Authenticated principal is required.");
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
    return `{${Object.keys(input).sort().map((key) => `${JSON.stringify(key)}:${stableJson(input[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizeIdentifier(value: unknown, label: string): string {
  const normalized = normalizeText(value, label, 160);
  if (!IDENTIFIER_PATTERN.test(normalized)) throw invalid(`${label} is not a valid identifier.`);
  return normalized;
}

function normalizeText(value: unknown, label: string, maximumLength: number): string {
  if (typeof value !== "string") throw invalid(`${label} must be a string.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximumLength) throw invalid(`${label} is invalid.`);
  return normalized;
}

function normalizeInteger(value: unknown, label: string, minimum: number, maximum = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw invalid(`${label} must be an integer between ${minimum} and ${maximum}.`);
  }
  return Number(value);
}

function normalizeTimestamp(value: unknown, label: string): string {
  const normalized = normalizeText(value, label, 64);
  if (Number.isNaN(Date.parse(normalized))) throw invalid(`${label} must be an ISO timestamp.`);
  return normalized;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string, minimum: number, maximum: number): unknown[] {
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
