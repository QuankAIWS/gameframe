import { readFileSync } from "node:fs";
import {
  InMemoryRpgService,
  RpgServiceError,
  type RpgCampaignAttached,
  type RpgCommandResponse,
  type RpgEncounterHandle,
  type RpgPrincipal,
  type RpgRuntimeEventsAccepted,
  type RpgTerminalOutcome,
} from "./in-memory-rpg-service.ts";

type JsonRecord = Record<string, unknown>;

type RuntimeReceipt = {
  fingerprint: string;
};

type EncounterEvidence = {
  request: JsonRecord;
  launchServiceId: string;
  terminalOutcome?: RpgTerminalOutcome;
};

type MemberProjection = {
  active: boolean;
  partyIds: Set<string>;
};

const RPG_RUNTIME_SERVICE_ID = "rpg-gm-runtime";
const GAMEFRAME_ENCOUNTER_ENGINE_SERVICE_ID = "gameframe-encounter-engine";

/**
 * Adds cross-operation guards that need visibility across the memory adapter's
 * campaign, command, and encounter calls. Durable storage will own these
 * invariants when the Node-local service is replaced.
 */
export class GuardedInMemoryRpgService {
  readonly #inner: InMemoryRpgService;
  readonly #knownEventIds = new Set<string>();
  readonly #members = new Map<string, MemberProjection>();
  readonly #runtimeReceipts = new Map<string, RuntimeReceipt>();
  readonly #encounters = new Map<string, EncounterEvidence>();

  constructor(inner = new InMemoryRpgService()) {
    this.#inner = inner;
    const fixture = readReferenceFixture();
    const campaign = record(fixture.campaign, "fixture.campaign");
    for (const eventValue of array(campaign.events, "fixture.campaign.events")) {
      const event = record(eventValue, "fixture campaign event");
      this.#knownEventIds.add(text(event.eventId, "fixture eventId"));
      applyMembershipEvent(this.#members, event);
    }
  }

  async attachCampaign(
    requestValue: unknown,
    principalValue: RpgPrincipal,
  ): Promise<RpgCampaignAttached> {
    const attached = await this.#inner.attachCampaign(requestValue, principalValue);
    return redactPlayerProjection(attached);
  }

  async handleCommand(
    envelopeValue: unknown,
    principalValue: RpgPrincipal,
  ): Promise<RpgCommandResponse> {
    const response = await this.#inner.handleCommand(envelopeValue, principalValue);
    if (response.kind === "campaign.command_accepted") {
      this.#knownEventIds.add(response.eventId);
      for (const eventId of response.eventIds ?? []) this.#knownEventIds.add(eventId);
    }
    return response;
  }

  async appendRuntimeEvents(
    batchValue: unknown,
    principalValue: RpgPrincipal,
  ): Promise<RpgRuntimeEventsAccepted> {
    const principal = runtimePrincipal(principalValue);
    const batch = record(batchValue, "runtime event batch");
    const campaignId = text(batch.campaignId, "campaignId");
    const batchId = text(batch.batchId, "batchId");
    const receiptKey = `${campaignId}\0${principal.serviceId}\0${batchId}`;
    const fingerprint = stableJson(batch);
    const existingReceipt = this.#runtimeReceipts.get(receiptKey);

    if (!existingReceipt) {
      this.#preflightRuntimeBatch(batch, principal.serviceId);
    } else if (existingReceipt.fingerprint !== fingerprint) {
      throw conflict("Runtime event batch ID was reused with a different request.");
    }

    const response = await this.#inner.appendRuntimeEvents(batchValue, principalValue);
    if (!existingReceipt) {
      for (const eventId of response.eventIds) this.#knownEventIds.add(eventId);
      this.#runtimeReceipts.set(receiptKey, { fingerprint });
    }
    return response;
  }

  async launchEncounter(
    requestValue: unknown,
    principalValue: RpgPrincipal,
  ): Promise<RpgEncounterHandle> {
    const principal = runtimePrincipal(principalValue);
    const request = record(requestValue, "encounter launch request");
    const handle = await this.#inner.launchEncounter(requestValue, principalValue);
    const existing = this.#encounters.get(handle.encounterId);
    if (!existing) {
      this.#encounters.set(handle.encounterId, {
        request: structuredClone(request),
        launchServiceId: principal.serviceId,
      });
    }
    return handle;
  }

  async completeEncounter(
    encounterIdValue: unknown,
    requestValue: unknown,
    principalValue: RpgPrincipal,
  ): Promise<RpgEncounterHandle> {
    const principal = runtimePrincipal(principalValue);
    if (principal.serviceId !== GAMEFRAME_ENCOUNTER_ENGINE_SERVICE_ID) {
      return await this.#inner.completeEncounter(
        encounterIdValue,
        requestValue,
        principalValue,
      );
    }

    const encounterId = text(encounterIdValue, "encounterId");
    const request = record(requestValue, "encounter completion request");
    const outcome = record(request.outcome, "encounter completion outcome");
    const evidence = this.#encounters.get(encounterId);
    if (!evidence) {
      return await this.#inner.completeEncounter(encounterIdValue, requestValue, principalValue);
    }
    validateTerminalOutcomeCoverage(outcome, evidence.request);

    const completed = await this.#inner.completeEncounter(
      encounterIdValue,
      requestValue,
      principalValue,
    );
    if (completed.terminalOutcome) {
      evidence.terminalOutcome = structuredClone(completed.terminalOutcome);
    }
    return completed;
  }

  async getEncounter(
    encounterIdValue: unknown,
    principalValue: RpgPrincipal,
  ): Promise<RpgEncounterHandle> {
    return await this.#inner.getEncounter(encounterIdValue, principalValue);
  }

  #preflightRuntimeBatch(batch: JsonRecord, serviceId: string): void {
    if (serviceId !== RPG_RUNTIME_SERVICE_ID) {
      throw forbidden("Campaign presentation events require the RPG runtime service principal.");
    }
    const events = array(batch.events, "runtime event batch.events").map((value, index) =>
      record(value, `runtime event batch.events[${index}]`)
    );
    const eventIds = events.map((event, index) => text(event.eventId, `events[${index}].eventId`));
    if (new Set(eventIds).size !== eventIds.length) {
      throw invalid("Runtime event IDs must be unique.");
    }
    for (const eventId of eventIds) {
      if (this.#knownEventIds.has(eventId)) {
        throw invalid(`Duplicate campaign event ID: ${eventId}`);
      }
    }

    for (const event of events) {
      if (event.type === "choice.presented") this.#validateChoiceEvent(event);
      if (event.type === "encounter.completed") this.#validateEncounterCompletedEvent(event);
    }
  }

  #validateChoiceEvent(event: JsonRecord): void {
    const audience = record(event.audience, "choice event audience");
    if (audience.kind === "runtime") {
      throw invalid("A player choice cannot use a runtime-only audience.");
    }
    const payload = record(event.payload, "choice event payload");
    const allowedPlayerIds = array(payload.allowedPlayerIds, "choice.allowedPlayerIds")
      .map((value, index) => text(value, `choice.allowedPlayerIds[${index}]`));
    for (const playerId of allowedPlayerIds) {
      const member = this.#members.get(playerId);
      if (!member?.active) throw invalid(`Choice targets an inactive player: ${playerId}`);
      if (!audienceVisibleToPlayer(audience, playerId, member.partyIds)) {
        throw invalid(`Choice audience is not visible to allowed player: ${playerId}`);
      }
    }
  }

  #validateEncounterCompletedEvent(event: JsonRecord): void {
    const payload = record(event.payload, "encounter.completed payload");
    const encounterId = text(payload.encounterId, "encounter.completed encounterId");
    const evidence = this.#encounters.get(encounterId);
    if (!evidence || evidence.launchServiceId !== RPG_RUNTIME_SERVICE_ID) {
      throw invalid("Encounter completion does not reference a runtime-owned encounter.");
    }
    const outcome = evidence.terminalOutcome;
    if (!outcome) throw invalid("Encounter completion was presented before a terminal outcome existed.");

    if (payload.result !== outcome.result) {
      throw invalid("Encounter completion result does not match the terminal outcome.");
    }
    if ((payload.winnerTeamId ?? undefined) !== outcome.winnerTeamId) {
      throw invalid("Encounter completion winner does not match the terminal outcome.");
    }
    const commit = record(payload.commit, "encounter.completed commit");
    if (
      commit.matchId !== outcome.commit.matchId
      || commit.matchRevision !== outcome.commit.matchRevision
      || commit.eventCount !== outcome.commit.eventCount
    ) {
      throw invalid("Encounter completion commit does not match the terminal outcome.");
    }
  }
}

function redactPlayerProjection(attached: RpgCampaignAttached): RpgCampaignAttached {
  const clone = structuredClone(attached);
  clone.events = clone.events.map((event) => {
    if (event.type !== "choice.presented") return event;
    const payload = record(event.payload, `${event.eventId}.payload`);
    const options = array(payload.options, `${event.eventId}.payload.options`).map((value, index) => {
      const option = record(value, `${event.eventId}.payload.options[${index}]`);
      const check = record(option.check, `${event.eventId}.payload.options[${index}].check`);
      return {
        optionId: option.optionId,
        label: option.label,
        check: {
          checkId: check.checkId,
          kind: check.kind,
          target: check.target,
        },
      };
    });
    return {
      ...event,
      payload: {
        choiceId: payload.choiceId,
        prompt: payload.prompt,
        allowedPlayerIds: structuredClone(payload.allowedPlayerIds),
        options,
      },
    };
  });
  return clone;
}

function validateTerminalOutcomeCoverage(outcome: JsonRecord, encounter: JsonRecord): void {
  const objectiveIds = array(encounter.objectives, "encounter.objectives")
    .map((value, index) => text(record(value, `encounter.objectives[${index}]`).objectiveId, "objectiveId"));
  const participantRecords = array(encounter.participants, "encounter.participants")
    .map((value, index) => record(value, `encounter.participants[${index}]`));
  const participantIds = participantRecords
    .map((participant) => text(participant.participantId, "participantId"));
  const teamIds = new Set(participantRecords.map((participant) => text(participant.teamId, "teamId")));

  const objectiveResultIds = array(outcome.objectiveResults, "outcome.objectiveResults")
    .map((value, index) => text(record(value, `outcome.objectiveResults[${index}]`).objectiveId, "objective result ID"));
  const participantResultIds = array(outcome.participantResults, "outcome.participantResults")
    .map((value, index) => text(record(value, `outcome.participantResults[${index}]`).participantId, "participant result ID"));

  requireExactCoverage(objectiveResultIds, objectiveIds, "objective results");
  requireExactCoverage(participantResultIds, participantIds, "participant results");

  if (outcome.winnerTeamId !== undefined && !teamIds.has(text(outcome.winnerTeamId, "winnerTeamId"))) {
    throw invalid("Terminal outcome winnerTeamId is not an encounter team.");
  }
}

function requireExactCoverage(actual: string[], expected: string[], label: string): void {
  if (new Set(actual).size !== actual.length) throw invalid(`${label} must not contain duplicates.`);
  const actualSet = new Set(actual);
  if (actual.length !== expected.length || expected.some((id) => !actualSet.has(id))) {
    throw invalid(`${label} must cover every encounter entry exactly once.`);
  }
}

function audienceVisibleToPlayer(
  audience: JsonRecord,
  playerId: string,
  partyIds: Set<string>,
): boolean {
  if (audience.kind === "public") return true;
  if (audience.kind === "player") return audience.playerId === playerId;
  return audience.kind === "party" && partyIds.has(String(audience.partyId));
}

function applyMembershipEvent(members: Map<string, MemberProjection>, event: JsonRecord): void {
  const payload = event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
    ? event.payload as JsonRecord
    : {};
  if (event.type === "campaign.member_added") {
    const playerId = text(payload.playerId, "membership playerId");
    members.set(playerId, {
      active: true,
      partyIds: new Set(array(payload.partyIds ?? [], "membership partyIds").map(String)),
    });
  } else if (event.type === "campaign.member_removed") {
    const member = members.get(text(payload.playerId, "membership playerId"));
    if (member) member.active = false;
  } else if (event.type === "campaign.member_parties_changed") {
    const member = members.get(text(payload.playerId, "membership playerId"));
    if (member) member.partyIds = new Set(array(payload.partyIds ?? [], "membership partyIds").map(String));
  }
}

function runtimePrincipal(value: RpgPrincipal): { kind: "runtime"; serviceId: string } {
  if (!value || value.kind !== "runtime") {
    throw forbidden("A runtime service principal is required.");
  }
  return value;
}

function readReferenceFixture(): JsonRecord {
  return JSON.parse(
    readFileSync(
      new URL("../../planning/fixtures/rpg/v1/campaign-port-a.json", import.meta.url),
      "utf8",
    ),
  ) as JsonRecord;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const input = value as JsonRecord;
    return `{${Object.keys(input).sort().map((key) =>
      `${JSON.stringify(key)}:${stableJson(input[key])}`
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid(`${label} must be an object.`);
  return value as JsonRecord;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw invalid(`${label} must be an array.`);
  return value;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw invalid(`${label} must be a nonempty string.`);
  return value;
}

function invalid(message: string): RpgServiceError {
  return new RpgServiceError({ code: "invalid-command", message, status: 400 });
}

function forbidden(message: string): RpgServiceError {
  return new RpgServiceError({ code: "forbidden", message, status: 403 });
}

function conflict(message: string): RpgServiceError {
  return new RpgServiceError({ code: "invalid-command", message, status: 409 });
}
