import { readFileSync } from "node:fs";

import {
  RpgServiceError,
  type RpgCampaignAttached,
  type RpgCommandResponse,
  type RpgEncounterHandle,
  type RpgPrincipal,
  type RpgRuntimeEventsAccepted,
} from "./in-memory-rpg-service.ts";
import {
  InMemoryGameFrameCoordinationLedger,
  RpgRevisionContractError,
  type GameFrameCoordinationState,
  type RuntimeNarrativeCommitReceipt,
} from "./rpg-dual-revision-contract.ts";

export const RPG_LIVE_CAMPAIGN_PROTOCOL_VERSION = 2 as const;
export const RPG_LIVE_ENCOUNTER_PROTOCOL_VERSION = 2 as const;

const LEGACY_PROTOCOL_VERSION = 1 as const;
const MAX_PRESENTATION_EVENTS = 16;

type JsonRecord = Record<string, unknown>;

type LegacyRpgService = {
  attachCampaign(request: unknown, principal: RpgPrincipal): Promise<RpgCampaignAttached>;
  handleCommand(request: unknown, principal: RpgPrincipal): Promise<RpgCommandResponse>;
  appendRuntimeEvents(request: unknown, principal: RpgPrincipal): Promise<RpgRuntimeEventsAccepted>;
  launchEncounter(request: unknown, principal: RpgPrincipal): Promise<RpgEncounterHandle>;
  completeEncounter(encounterId: unknown, request: unknown, principal: RpgPrincipal): Promise<RpgEncounterHandle>;
  getEncounter(encounterId: unknown, principal: RpgPrincipal): Promise<RpgEncounterHandle>;
};

type StoredReceipt<T> = {
  fingerprint: string;
  response: T;
};

type V2EncounterHandle = Omit<RpgEncounterHandle, "protocolVersion"> & GameFrameCoordinationState & {
  protocolVersion: typeof RPG_LIVE_ENCOUNTER_PROTOCOL_VERSION;
  coordinationMutationId: string;
  runtimeCommitId: string;
};

export class RpgLiveProtocolError extends RpgServiceError {
  readonly gameframeCoordinationRevision?: number;
  readonly presentationSequence?: number;
  readonly linkedNarrativeRevision?: number;

  constructor(input: {
    code: string;
    message: string;
    status?: number;
    retryable?: boolean;
    state?: GameFrameCoordinationState;
  }) {
    super({
      code: input.code,
      message: input.message,
      status: input.status,
      retryable: input.retryable,
      revision: input.state?.gameframeCoordinationRevision,
    });
    this.name = "RpgLiveProtocolError";
    if (input.state) {
      this.gameframeCoordinationRevision = input.state.gameframeCoordinationRevision;
      this.presentationSequence = input.state.presentationSequence;
      this.linkedNarrativeRevision = input.state.linkedNarrativeRevision;
    }
  }
}

/**
 * Production-facing protocol adapter for the Node-local RPG service.
 *
 * Protocol v2 owns GameFrame coordination revision and presentation sequence,
 * links runtime-owned narrative receipts, and keeps the proven protocol-v1
 * event reducer behind an explicit compatibility boundary.
 */
export class VersionedInMemoryRpgService {
  readonly #inner: LegacyRpgService;
  readonly #ledgers = new Map<string, InMemoryGameFrameCoordinationLedger>();
  readonly #commandReceipts = new Map<string, StoredReceipt<JsonRecord>>();
  readonly #runtimeLinkReceipts = new Map<string, StoredReceipt<JsonRecord>>();
  readonly #linkedRuntimeCommits = new Map<string, string>();
  readonly #v2EncounterHandles = new Map<string, V2EncounterHandle>();

  constructor(inner: LegacyRpgService) {
    this.#inner = inner;
  }

  async attachCampaign(requestValue: unknown, principal: RpgPrincipal): Promise<unknown> {
    const request = record(requestValue, "campaign attach request");
    if (request.protocolVersion !== RPG_LIVE_CAMPAIGN_PROTOCOL_VERSION) {
      return await this.#inner.attachCampaign(requestValue, principal);
    }

    const campaignId = identifier(request.campaignId, "campaignId");
    const attached = await this.#inner.attachCampaign(
      { ...structuredClone(request), protocolVersion: LEGACY_PROTOCOL_VERSION },
      principal,
    );
    const state = this.#ledger(campaignId).state;
    return {
      protocolVersion: RPG_LIVE_CAMPAIGN_PROTOCOL_VERSION,
      kind: "campaign.attached",
      campaignId,
      ...state,
      events: attached.events,
      cursor: `campaign:${campaignId}:coordination:${state.gameframeCoordinationRevision}:presentation:${state.presentationSequence}`,
      hasMore: false,
    };
  }

  async handleCommand(requestValue: unknown, principal: RpgPrincipal): Promise<unknown> {
    const request = record(requestValue, "campaign command envelope");
    if (request.protocolVersion !== RPG_LIVE_CAMPAIGN_PROTOCOL_VERSION) {
      return await this.#inner.handleCommand(requestValue, principal);
    }
    if (principal.kind !== "player") {
      throw forbidden("Campaign player commands require a player principal.");
    }

    const campaignId = identifier(request.campaignId, "campaignId");
    const commandId = identifier(request.commandId, "commandId");
    const command = record(request.command, "command");
    const expected = nonNegativeInteger(
      command.expectedGameframeCoordinationRevision,
      "expectedGameframeCoordinationRevision",
    );
    const receiptKey = `${campaignId}\0${principal.playerId}\0${commandId}`;
    const fingerprint = stableJson(request);
    const existing = this.#commandReceipts.get(receiptKey);
    if (existing?.fingerprint === fingerprint) return structuredClone(existing.response);

    const ledger = this.#ledger(campaignId);
    const state = ledger.state;
    if (existing) {
      return rejectedCommand(campaignId, commandId, "command-conflict", false, state);
    }
    if (expected !== state.gameframeCoordinationRevision) {
      return rejectedCommand(
        campaignId,
        commandId,
        "coordination-revision-conflict",
        true,
        state,
      );
    }

    const legacyResponse = await this.#inner.handleCommand(
      {
        ...structuredClone(request),
        protocolVersion: LEGACY_PROTOCOL_VERSION,
        command: {
          ...structuredClone(command),
          expectedRevision: state.presentationSequence,
          expectedGameframeCoordinationRevision: undefined,
        },
      },
      principal,
    );
    if (legacyResponse.kind === "campaign.command_rejected") {
      return rejectedCommand(
        campaignId,
        commandId,
        legacyResponse.code === "revision-conflict"
          ? "coordination-revision-conflict"
          : legacyResponse.code,
        legacyResponse.retryable,
        ledger.state,
      );
    }

    const eventIds = legacyResponse.eventIds ?? [legacyResponse.eventId];
    const committed = ledger.acceptCommand({
      commandId,
      expectedGameframeCoordinationRevision: expected,
      presentationEventCount: eventIds.length,
    });
    const response: JsonRecord = {
      protocolVersion: RPG_LIVE_CAMPAIGN_PROTOCOL_VERSION,
      kind: "gameframe.command_committed",
      campaignId,
      commandId,
      ...committed,
      eventId: eventIds[0],
      eventIds,
    };
    this.#commandReceipts.set(receiptKey, {
      fingerprint,
      response: structuredClone(response),
    });
    return response;
  }

  async appendRuntimeEvents(requestValue: unknown, principal: RpgPrincipal): Promise<unknown> {
    const request = record(requestValue, "runtime event batch");
    if (request.protocolVersion !== RPG_LIVE_CAMPAIGN_PROTOCOL_VERSION) {
      return await this.#inner.appendRuntimeEvents(requestValue, principal);
    }
    if (principal.kind !== "runtime") {
      throw forbidden("A runtime service principal is required.");
    }

    const campaignId = identifier(request.campaignId, "campaignId");
    const coordinationMutationId = identifier(
      request.coordinationMutationId,
      "coordinationMutationId",
    );
    const receiptKey = `${campaignId}\0${principal.serviceId}\0${coordinationMutationId}`;
    const fingerprint = stableJson(request);
    const existing = this.#runtimeLinkReceipts.get(receiptKey);
    if (existing?.fingerprint === fingerprint) return structuredClone(existing.response);
    if (existing) {
      throw conflict(
        "coordination-mutation-conflict",
        "Coordination mutation ID was reused with different content.",
        this.#ledger(campaignId).state,
      );
    }

    const events = array(request.events, "events");
    if (events.length < 1 || events.length > MAX_PRESENTATION_EVENTS) {
      throw invalid(`events must contain between 1 and ${MAX_PRESENTATION_EVENTS} entries.`);
    }
    const expected = nonNegativeInteger(
      request.expectedGameframeCoordinationRevision,
      "expectedGameframeCoordinationRevision",
    );
    const runtimeCommit = runtimeReceipt(request.runtimeCommit, "runtimeCommit");
    this.#preflightRuntimeLink(
      campaignId,
      coordinationMutationId,
      expected,
      runtimeCommit,
      "runtime.events",
    );

    const state = this.#ledger(campaignId).state;
    const accepted = await this.#inner.appendRuntimeEvents(
      {
        protocolVersion: LEGACY_PROTOCOL_VERSION,
        batchId: coordinationMutationId,
        campaignId,
        expectedRevision: state.presentationSequence,
        events: structuredClone(events),
      },
      principal,
    );
    const linked = this.#acceptRuntimeLink(
      campaignId,
      coordinationMutationId,
      expected,
      events.length,
      runtimeCommit,
    );
    const response: JsonRecord = {
      protocolVersion: RPG_LIVE_CAMPAIGN_PROTOCOL_VERSION,
      kind: "gameframe.runtime_link_committed",
      campaignId,
      coordinationMutationId,
      runtimeCommitId: runtimeCommit.runtimeCommitId,
      ...linked,
      eventIds: accepted.eventIds,
    };
    this.#runtimeLinkReceipts.set(receiptKey, {
      fingerprint,
      response: structuredClone(response),
    });
    return response;
  }

  async launchEncounter(requestValue: unknown, principal: RpgPrincipal): Promise<unknown> {
    const request = record(requestValue, "encounter launch request");
    if (request.protocolVersion !== RPG_LIVE_ENCOUNTER_PROTOCOL_VERSION) {
      return await this.#inner.launchEncounter(requestValue, principal);
    }
    if (principal.kind !== "runtime") {
      throw forbidden("Encounter operations require a runtime service principal.");
    }

    const encounterId = identifier(request.encounterId, "encounterId");
    const campaignId = identifier(request.campaignId, "campaignId");
    const coordinationMutationId = identifier(
      request.coordinationMutationId,
      "coordinationMutationId",
    );
    const receiptKey = `${campaignId}\0${principal.serviceId}\0${coordinationMutationId}`;
    const fingerprint = stableJson(request);
    const existing = this.#runtimeLinkReceipts.get(receiptKey);
    if (existing?.fingerprint === fingerprint) {
      const handle = this.#v2EncounterHandles.get(encounterId);
      if (!handle) throw invalid("Encounter retry receipt exists without its handle.");
      return structuredClone(handle);
    }
    if (existing) {
      throw conflict(
        "coordination-mutation-conflict",
        "Coordination mutation ID was reused with different content.",
        this.#ledger(campaignId).state,
      );
    }

    const expected = nonNegativeInteger(
      request.expectedGameframeCoordinationRevision,
      "expectedGameframeCoordinationRevision",
    );
    const runtimeCommit = runtimeReceipt(request.runtimeCommit, "runtimeCommit");
    this.#preflightRuntimeLink(
      campaignId,
      coordinationMutationId,
      expected,
      runtimeCommit,
      "runtime.encounter_launch",
    );

    const state = this.#ledger(campaignId).state;
    const {
      coordinationMutationId: _coordinationMutationId,
      expectedGameframeCoordinationRevision: _expected,
      runtimeCommit: _runtimeCommit,
      ...legacyFields
    } = request;
    const legacyHandle = await this.#inner.launchEncounter(
      {
        ...structuredClone(legacyFields),
        protocolVersion: LEGACY_PROTOCOL_VERSION,
        campaignRevision: state.presentationSequence,
      },
      principal,
    );
    const linked = this.#acceptRuntimeLink(
      campaignId,
      coordinationMutationId,
      expected,
      0,
      runtimeCommit,
    );
    const handle: V2EncounterHandle = {
      ...legacyHandle,
      protocolVersion: RPG_LIVE_ENCOUNTER_PROTOCOL_VERSION,
      coordinationMutationId,
      runtimeCommitId: runtimeCommit.runtimeCommitId,
      ...linked,
    };
    this.#v2EncounterHandles.set(encounterId, structuredClone(handle));
    this.#runtimeLinkReceipts.set(receiptKey, {
      fingerprint,
      response: {
        protocolVersion: RPG_LIVE_ENCOUNTER_PROTOCOL_VERSION,
        kind: "gameframe.runtime_link_committed",
        campaignId,
        coordinationMutationId,
        runtimeCommitId: runtimeCommit.runtimeCommitId,
        ...linked,
      },
    });
    return handle;
  }

  async completeEncounter(
    encounterIdValue: unknown,
    requestValue: unknown,
    principal: RpgPrincipal,
  ): Promise<unknown> {
    const request = record(requestValue, "encounter completion request");
    const completed = await this.#inner.completeEncounter(
      encounterIdValue,
      request.protocolVersion === RPG_LIVE_ENCOUNTER_PROTOCOL_VERSION
        ? { ...structuredClone(request), protocolVersion: LEGACY_PROTOCOL_VERSION }
        : requestValue,
      principal,
    );
    const encounterId = identifier(encounterIdValue, "encounterId");
    const v2 = this.#v2EncounterHandles.get(encounterId);
    if (!v2) return completed;
    const updated: V2EncounterHandle = {
      ...v2,
      state: completed.state,
      ...(completed.terminalOutcome
        ? { terminalOutcome: structuredClone(completed.terminalOutcome) }
        : {}),
    };
    this.#v2EncounterHandles.set(encounterId, structuredClone(updated));
    return updated;
  }

  async getEncounter(encounterIdValue: unknown, principal: RpgPrincipal): Promise<unknown> {
    const current = await this.#inner.getEncounter(encounterIdValue, principal);
    const encounterId = identifier(encounterIdValue, "encounterId");
    const v2 = this.#v2EncounterHandles.get(encounterId);
    if (!v2) return current;
    const updated: V2EncounterHandle = {
      ...v2,
      state: current.state,
      ...(current.terminalOutcome
        ? { terminalOutcome: structuredClone(current.terminalOutcome) }
        : {}),
    };
    this.#v2EncounterHandles.set(encounterId, structuredClone(updated));
    return updated;
  }

  #ledger(campaignId: string): InMemoryGameFrameCoordinationLedger {
    let ledger = this.#ledgers.get(campaignId);
    if (!ledger) {
      const presentationSequence = initialPresentationSequence(campaignId);
      ledger = new InMemoryGameFrameCoordinationLedger({
        gameframeCoordinationRevision: presentationSequence,
        presentationSequence,
        linkedNarrativeRevision: 0,
      });
      this.#ledgers.set(campaignId, ledger);
    }
    return ledger;
  }

  #preflightRuntimeLink(
    campaignId: string,
    coordinationMutationId: string,
    expected: number,
    runtimeCommit: RuntimeNarrativeCommitReceipt,
    requiredKind: RuntimeNarrativeCommitReceipt["runtimeCommitKind"],
  ): void {
    const state = this.#ledger(campaignId).state;
    if (expected !== state.gameframeCoordinationRevision) {
      throw conflict(
        "coordination-revision-conflict",
        `Expected GameFrame coordination revision ${expected}, actual ${state.gameframeCoordinationRevision}.`,
        state,
        true,
      );
    }
    if (runtimeCommit.runtimeCommitKind !== requiredKind) {
      throw invalid(`Runtime commit kind must be ${requiredKind}.`);
    }
    if (runtimeCommit.sourceGameframeCoordinationRevision !== expected) {
      throw conflict(
        "runtime-source-revision-conflict",
        "Runtime commit was derived from a different GameFrame coordination revision.",
        state,
        true,
      );
    }
    if (
      runtimeCommit.previousNarrativeRevision !== state.linkedNarrativeRevision
      || runtimeCommit.narrativeRevision !== state.linkedNarrativeRevision + 1
    ) {
      throw conflict(
        "narrative-link-conflict",
        "Runtime narrative receipt is not the next linked narrative revision.",
        state,
        true,
      );
    }
    const linkedMutation = this.#linkedRuntimeCommits.get(runtimeCommit.runtimeCommitId);
    if (linkedMutation && linkedMutation !== coordinationMutationId) {
      throw conflict(
        "runtime-link-conflict",
        `Runtime commit is already linked through ${linkedMutation}.`,
        state,
      );
    }
  }

  #acceptRuntimeLink(
    campaignId: string,
    coordinationMutationId: string,
    expected: number,
    presentationEventCount: number,
    runtimeCommit: RuntimeNarrativeCommitReceipt,
  ): GameFrameCoordinationState {
    try {
      const accepted = this.#ledger(campaignId).acceptRuntimeLink({
        coordinationMutationId,
        expectedGameframeCoordinationRevision: expected,
        presentationEventCount,
        runtimeCommit,
      });
      this.#linkedRuntimeCommits.set(runtimeCommit.runtimeCommitId, coordinationMutationId);
      return {
        gameframeCoordinationRevision: accepted.gameframeCoordinationRevision,
        presentationSequence: accepted.presentationSequence,
        linkedNarrativeRevision: accepted.linkedNarrativeRevision,
      };
    } catch (error) {
      if (error instanceof RpgRevisionContractError) {
        throw conflict(error.code, error.message, this.#ledger(campaignId).state, true);
      }
      throw error;
    }
  }
}

function initialPresentationSequence(campaignId: string): number {
  if (campaignId !== "campaign-monster-master-reference") return 0;
  const fixture = JSON.parse(
    readFileSync(
      new URL("../../planning/fixtures/rpg/v1/campaign-port-a.json", import.meta.url),
      "utf8",
    ),
  ) as JsonRecord;
  const campaign = record(fixture.campaign, "fixture.campaign");
  return array(campaign.events, "fixture.campaign.events").length;
}

function rejectedCommand(
  campaignId: string,
  commandId: string,
  code: string,
  retryable: boolean,
  state: GameFrameCoordinationState,
): JsonRecord {
  return {
    protocolVersion: RPG_LIVE_CAMPAIGN_PROTOCOL_VERSION,
    kind: "gameframe.command_rejected",
    campaignId,
    commandId,
    ...state,
    code,
    retryable,
  };
}

function runtimeReceipt(value: unknown, label: string): RuntimeNarrativeCommitReceipt {
  const input = record(value, label);
  if (input.kind !== "runtime.narrative_committed") {
    throw invalid(`${label}.kind is unsupported.`);
  }
  if (
    input.runtimeCommitKind !== "runtime.events"
    && input.runtimeCommitKind !== "runtime.encounter_launch"
  ) {
    throw invalid(`${label}.runtimeCommitKind is unsupported.`);
  }
  const previousNarrativeRevision = nonNegativeInteger(
    input.previousNarrativeRevision,
    `${label}.previousNarrativeRevision`,
  );
  const narrativeRevision = nonNegativeInteger(
    input.narrativeRevision,
    `${label}.narrativeRevision`,
  );
  if (narrativeRevision !== previousNarrativeRevision + 1) {
    throw invalid(`${label} must advance narrative revision exactly once.`);
  }
  return {
    kind: "runtime.narrative_committed",
    runtimeCommitKind: input.runtimeCommitKind,
    runtimeCommitId: identifier(input.runtimeCommitId, `${label}.runtimeCommitId`),
    ...(input.sourceCommandId === undefined
      ? {}
      : { sourceCommandId: identifier(input.sourceCommandId, `${label}.sourceCommandId`) }),
    sourceGameframeCoordinationRevision: nonNegativeInteger(
      input.sourceGameframeCoordinationRevision,
      `${label}.sourceGameframeCoordinationRevision`,
    ),
    previousNarrativeRevision,
    narrativeRevision,
  };
}

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalid(`${label} must be an object.`);
  }
  return value as JsonRecord;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw invalid(`${label} must be an array.`);
  return value;
}

function identifier(value: unknown, label: string): string {
  if (
    typeof value !== "string"
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value)
  ) {
    throw invalid(`${label} is not a valid identifier.`);
  }
  return value;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 10_000_000) {
    throw invalid(`${label} must be a nonnegative integer.`);
  }
  return Number(value);
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

function invalid(message: string): RpgLiveProtocolError {
  return new RpgLiveProtocolError({ code: "invalid-command", message, status: 400 });
}

function forbidden(message: string): RpgLiveProtocolError {
  return new RpgLiveProtocolError({ code: "forbidden", message, status: 403 });
}

function conflict(
  code: string,
  message: string,
  state: GameFrameCoordinationState,
  retryable = false,
): RpgLiveProtocolError {
  return new RpgLiveProtocolError({ code, message, status: 409, retryable, state });
}
