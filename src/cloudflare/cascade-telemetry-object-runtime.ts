import { errorResponse, json, readJson } from "./http-utils.ts";
import type { DurableStorageLike } from "./runtime-contracts.ts";

const INDEX_KEY = "gameframe:cascade-telemetry-index:v1";
const CHUNK_PREFIX = "gameframe:cascade-telemetry-chunk:v1:";
const MAX_REQUEST_EVENTS = 24;
const MAX_EVENTS_PER_CHUNK = 120;
const RECENT_EVENT_ID_LIMIT = 2_048;
const MAX_EVENT_PAYLOAD_BYTES = 2_048;

export interface CascadeTelemetryStoredEvent {
  eventId: string;
  at: string;
  timestamp: number;
  type: string;
  sessionId: string | null;
  attemptId: string | null;
  payload: Record<string, unknown>;
  receivedAt: number;
}

interface CascadeTelemetryChunk {
  version: 1;
  day: string;
  events: CascadeTelemetryStoredEvent[];
}

interface CascadeTelemetryChunkIndex {
  key: string;
  day: string;
  count: number;
  firstAt: number;
  lastAt: number;
}

interface CascadeTelemetryIndex {
  version: 1;
  nextChunk: number;
  chunks: CascadeTelemetryChunkIndex[];
  recentEventIds: string[];
  updatedAt: number;
}

interface RejectedTelemetryEvent {
  index: number;
  eventId: string | null;
  code: string;
  message: string;
}

function emptyIndex(): CascadeTelemetryIndex {
  return {
    version: 1,
    nextChunk: 1,
    chunks: [],
    recentEventIds: [],
    updatedAt: 0,
  };
}

function boundedText(value: unknown, name: string, maximum: number): string {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > maximum) {
    throw Object.assign(new Error(`${name} must be non-empty and bounded.`), { code: "cascade_telemetry_invalid" });
  }
  return normalized;
}

function nullableText(value: unknown, maximum: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).trim();
  if (!normalized || normalized.length > maximum) {
    throw Object.assign(new Error("Cascade telemetry identifier is invalid."), { code: "cascade_telemetry_invalid" });
  }
  return normalized;
}

function payload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw Object.assign(new Error("Cascade telemetry payload must be JSON serializable."), { code: "cascade_telemetry_invalid" });
  }
  if (serialized.length > MAX_EVENT_PAYLOAD_BYTES) {
    throw Object.assign(new Error("Cascade telemetry payload is too large."), { code: "cascade_telemetry_invalid" });
  }
  return JSON.parse(serialized) as Record<string, unknown>;
}

function normalizeEvent(value: unknown, receivedAt: number): CascadeTelemetryStoredEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw Object.assign(new Error("Cascade telemetry events must be objects."), { code: "cascade_telemetry_invalid" });
  }
  const input = value as Record<string, unknown>;
  const timestamp = Date.parse(String(input.at ?? ""));
  if (!Number.isFinite(timestamp)) {
    throw Object.assign(new Error("Cascade telemetry event timestamp is invalid."), { code: "cascade_telemetry_invalid" });
  }
  return {
    eventId: boundedText(input.eventId, "Cascade telemetry event ID", 180),
    at: new Date(timestamp).toISOString(),
    timestamp,
    type: boundedText(input.type, "Cascade telemetry event type", 80),
    sessionId: nullableText(input.sessionId, 180),
    attemptId: nullableText(input.attemptId, 180),
    payload: payload(input.payload),
    receivedAt,
  };
}

function rejectedEvent(value: unknown, index: number, error: unknown): RejectedTelemetryEvent {
  const input = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  const rawId = input?.eventId === undefined || input?.eventId === null ? "" : String(input.eventId).trim();
  const caught = error as { code?: string; message?: string };
  return {
    index,
    eventId: rawId ? rawId.slice(0, 180) : null,
    code: caught.code ?? "cascade_telemetry_invalid",
    message: caught.message ?? "Cascade telemetry event was rejected.",
  };
}

function chunkKey(index: CascadeTelemetryIndex, day: string): string {
  const key = `${CHUNK_PREFIX}${String(index.nextChunk).padStart(8, "0")}:${day}`;
  index.nextChunk += 1;
  return key;
}

export class CascadeTelemetryObjectRuntime {
  readonly #storage: DurableStorageLike;
  #tail: Promise<void> = Promise.resolve();

  constructor(storage: DurableStorageLike) {
    this.#storage = storage;
  }

  fetch(request: Request): Promise<Response> {
    const execute = async () => this.#handle(request);
    const result = this.#tail.then(execute, execute);
    this.#tail = result.then(() => undefined, () => undefined);
    return result;
  }

  async #handle(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (request.method === "POST" && url.pathname === "/telemetry/cascade/ingest") {
        return json(200, await this.#ingest(await readJson(request)));
      }
      if (request.method === "GET" && url.pathname === "/telemetry/cascade/export") {
        return json(200, await this.#export());
      }
      return json(404, { error: "not_found" });
    } catch (error) {
      return errorResponse(error);
    }
  }

  async #ingest(body: Record<string, unknown>) {
    const values = Array.isArray(body.events) ? body.events : [];
    if (!values.length || values.length > MAX_REQUEST_EVENTS) {
      throw Object.assign(new Error(`Cascade telemetry batches must contain 1-${MAX_REQUEST_EVENTS} events.`), {
        code: "cascade_telemetry_invalid",
      });
    }

    const now = Date.now();
    const incoming: CascadeTelemetryStoredEvent[] = [];
    const rejected: RejectedTelemetryEvent[] = [];
    values.forEach((value, index) => {
      try {
        incoming.push(normalizeEvent(value, now));
      } catch (error) {
        rejected.push(rejectedEvent(value, index, error));
      }
    });

    const index = await this.#storage.get<CascadeTelemetryIndex>(INDEX_KEY) ?? emptyIndex();
    const recent = new Set(index.recentEventIds);
    const chunkCache = new Map<string, CascadeTelemetryChunk>();
    const dirty = new Set<string>();
    const acceptedEventIds: string[] = [];
    const duplicateEventIds: string[] = [];

    const readChunk = async (meta: CascadeTelemetryChunkIndex): Promise<CascadeTelemetryChunk> => {
      const cached = chunkCache.get(meta.key);
      if (cached) return cached;
      const stored = await this.#storage.get<CascadeTelemetryChunk>(meta.key) ?? {
        version: 1,
        day: meta.day,
        events: [],
      };
      chunkCache.set(meta.key, stored);
      return stored;
    };

    for (const event of incoming) {
      if (recent.has(event.eventId)) {
        duplicateEventIds.push(event.eventId);
        continue;
      }
      const day = event.at.slice(0, 10);
      let meta = [...index.chunks].reverse().find((candidate) => (
        candidate.day === day && candidate.count < MAX_EVENTS_PER_CHUNK
      ));
      if (!meta) {
        meta = {
          key: chunkKey(index, day),
          day,
          count: 0,
          firstAt: event.timestamp,
          lastAt: event.timestamp,
        };
        index.chunks.push(meta);
      }
      let chunk = await readChunk(meta);
      if (chunk.events.length >= MAX_EVENTS_PER_CHUNK) {
        meta = {
          key: chunkKey(index, day),
          day,
          count: 0,
          firstAt: event.timestamp,
          lastAt: event.timestamp,
        };
        index.chunks.push(meta);
        chunk = { version: 1, day, events: [] };
        chunkCache.set(meta.key, chunk);
      }
      chunk.events.push(event);
      meta.count = chunk.events.length;
      meta.firstAt = Math.min(meta.firstAt, event.timestamp);
      meta.lastAt = Math.max(meta.lastAt, event.timestamp);
      dirty.add(meta.key);
      recent.add(event.eventId);
      acceptedEventIds.push(event.eventId);
    }

    if (acceptedEventIds.length) {
      for (const key of dirty) {
        await this.#storage.put(key, chunkCache.get(key)!);
      }
      index.recentEventIds = [...recent].slice(-RECENT_EVENT_ID_LIMIT);
      index.updatedAt = now;
      await this.#storage.put(INDEX_KEY, index);
    }

    return {
      accepted: acceptedEventIds.length,
      duplicates: duplicateEventIds.length,
      rejected,
      acceptedEventIds,
      duplicateEventIds,
      storedChunks: index.chunks.length,
      updatedAt: index.updatedAt,
    };
  }

  async #export() {
    const index = await this.#storage.get<CascadeTelemetryIndex>(INDEX_KEY) ?? emptyIndex();
    const events: CascadeTelemetryStoredEvent[] = [];
    for (const meta of index.chunks) {
      const chunk = await this.#storage.get<CascadeTelemetryChunk>(meta.key);
      if (!chunk?.events) continue;
      events.push(...chunk.events);
    }
    events.sort((left, right) => left.timestamp - right.timestamp || left.receivedAt - right.receivedAt || left.eventId.localeCompare(right.eventId));
    return {
      schemaVersion: 1,
      updatedAt: index.updatedAt,
      events,
    };
  }
}
