import {
  RpgServiceError,
  type RpgPrincipal,
  type RpgRuntimeEventsAccepted,
} from "./in-memory-rpg-service.ts";
import { GuardedInMemoryRpgService } from "./guarded-in-memory-rpg-service.ts";
import {
  RPG_LIVE_CAMPAIGN_PROTOCOL_VERSION,
  RPG_LIVE_ENCOUNTER_PROTOCOL_VERSION,
  VersionedInMemoryRpgService,
} from "./versioned-in-memory-rpg-service.ts";

type JsonRecord = Record<string, unknown>;

const RESERVED_CONSEQUENCE_KEYS = new Set(["choiceId", "checkId", "result"]);

export const RPG_CAMPAIGN_PROTOCOL_VERSION = RPG_LIVE_CAMPAIGN_PROTOCOL_VERSION;
export const RPG_ENCOUNTER_PROTOCOL_VERSION = RPG_LIVE_ENCOUNTER_PROTOCOL_VERSION;

/**
 * Public Node-local RPG service. Protocol v2 is the live boundary; protocol v1
 * remains encapsulated inside the deterministic reducer for regression coverage.
 */
export class StrictInMemoryRpgService extends VersionedInMemoryRpgService {
  constructor() {
    super(new ConsequenceStrictLegacyService());
  }
}

/**
 * Rejects runtime consequence fields that could overwrite the deterministic
 * choice/check metadata emitted by the underlying campaign service.
 */
class ConsequenceStrictLegacyService extends GuardedInMemoryRpgService {
  override async appendRuntimeEvents(
    batchValue: unknown,
    principalValue: RpgPrincipal,
  ): Promise<RpgRuntimeEventsAccepted> {
    validateConsequenceFields(batchValue);
    return await super.appendRuntimeEvents(batchValue, principalValue);
  }
}

function validateConsequenceFields(batchValue: unknown): void {
  const batch = record(batchValue, "runtime event batch");
  if (!Array.isArray(batch.events)) return;
  for (const [eventIndex, eventValue] of batch.events.entries()) {
    const event = record(eventValue, `events[${eventIndex}]`);
    if (event.type !== "choice.presented") continue;
    const payload = record(event.payload, `events[${eventIndex}].payload`);
    if (!Array.isArray(payload.options)) continue;
    for (const [optionIndex, optionValue] of payload.options.entries()) {
      const option = record(optionValue, `events[${eventIndex}].payload.options[${optionIndex}]`);
      const check = record(
        option.check,
        `events[${eventIndex}].payload.options[${optionIndex}].check`,
      );
      for (const branch of ["success", "failure"] as const) {
        const consequence = record(
          check[branch],
          `events[${eventIndex}].payload.options[${optionIndex}].check.${branch}`,
        );
        for (const key of RESERVED_CONSEQUENCE_KEYS) {
          if (Object.hasOwn(consequence, key)) {
            throw invalid(
              `Choice ${branch} consequence cannot override reserved field: ${key}.`,
            );
          }
        }
      }
    }
  }
}

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalid(`${label} must be an object.`);
  }
  return value as JsonRecord;
}

function invalid(message: string): RpgServiceError {
  return new RpgServiceError({ code: "invalid-command", message, status: 400 });
}
