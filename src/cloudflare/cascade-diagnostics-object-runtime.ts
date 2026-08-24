import { errorResponse, json, readJson } from "./http-utils.ts";
import type { DurableStorageLike } from "./runtime-contracts.ts";

const DIAGNOSTICS_KEY = "gameframe:cascade-diagnostics:v1";
const MAX_REQUEST_INCIDENTS = 8;
const MAX_STORED_INCIDENTS = 40;
const MAX_INCIDENT_PAYLOAD_BYTES = 8_192;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

export interface CascadeDiagnosticIncident {
  incidentId: string;
  at: string;
  timestamp: number;
  type: string;
  payload: Record<string, unknown>;
  receivedAt: number;
}

interface CascadeDiagnosticsState {
  version: 1;
  updatedAt: number;
  incidents: CascadeDiagnosticIncident[];
}

function emptyState(): CascadeDiagnosticsState {
  return { version: 1, updatedAt: 0, incidents: [] };
}

function boundedText(value: unknown, name: string, maximum: number): string {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > maximum) {
    throw Object.assign(new Error(`${name} must be non-empty and bounded.`), { code: "cascade_diagnostics_invalid" });
  }
  return normalized;
}

function boundedPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw Object.assign(new Error("Cascade diagnostic payload must be JSON serializable."), { code: "cascade_diagnostics_invalid" });
  }
  if (serialized.length > MAX_INCIDENT_PAYLOAD_BYTES) {
    throw Object.assign(new Error("Cascade diagnostic payload is too large."), { code: "cascade_diagnostics_invalid" });
  }
  return JSON.parse(serialized) as Record<string, unknown>;
}

function normalizeIncident(value: unknown, receivedAt: number): CascadeDiagnosticIncident {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw Object.assign(new Error("Cascade diagnostic incidents must be objects."), { code: "cascade_diagnostics_invalid" });
  }
  const input = value as Record<string, unknown>;
  const timestamp = Date.parse(String(input.at ?? ""));
  if (!Number.isFinite(timestamp)) {
    throw Object.assign(new Error("Cascade diagnostic timestamp is invalid."), { code: "cascade_diagnostics_invalid" });
  }
  return {
    incidentId: boundedText(input.incidentId, "Cascade diagnostic incident ID", 180),
    at: new Date(timestamp).toISOString(),
    timestamp,
    type: boundedText(input.type, "Cascade diagnostic incident type", 80),
    payload: boundedPayload(input.payload),
    receivedAt,
  };
}

function prune(state: CascadeDiagnosticsState, now: number): CascadeDiagnosticsState {
  const cutoff = now - RETENTION_MS;
  const incidents = state.incidents
    .filter((incident) => incident.receivedAt >= cutoff)
    .sort((left, right) => left.timestamp - right.timestamp || left.receivedAt - right.receivedAt || left.incidentId.localeCompare(right.incidentId))
    .slice(-MAX_STORED_INCIDENTS);
  return { version: 1, updatedAt: state.updatedAt, incidents };
}

export class CascadeDiagnosticsObjectRuntime {
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
      if (request.method === "POST" && url.pathname === "/diagnostics/cascade/ingest") {
        return json(200, await this.#ingest(await readJson(request)));
      }
      if (request.method === "GET" && url.pathname === "/diagnostics/cascade/export") {
        return json(200, await this.#export());
      }
      return json(404, { error: "not_found" });
    } catch (error) {
      return errorResponse(error);
    }
  }

  async #ingest(body: Record<string, unknown>) {
    const values = Array.isArray(body.incidents) ? body.incidents : [];
    if (!values.length || values.length > MAX_REQUEST_INCIDENTS) {
      throw Object.assign(new Error(`Cascade diagnostic batches must contain 1-${MAX_REQUEST_INCIDENTS} incidents.`), {
        code: "cascade_diagnostics_invalid",
      });
    }

    const now = Date.now();
    const incoming = values.map((value) => normalizeIncident(value, now));
    let state = prune(await this.#storage.get<CascadeDiagnosticsState>(DIAGNOSTICS_KEY) ?? emptyState(), now);
    const ids = new Set(state.incidents.map((incident) => incident.incidentId));
    let accepted = 0;
    let duplicates = 0;
    for (const incident of incoming) {
      if (ids.has(incident.incidentId)) {
        duplicates += 1;
        continue;
      }
      state.incidents.push(incident);
      ids.add(incident.incidentId);
      accepted += 1;
    }
    state.updatedAt = now;
    state = prune(state, now);
    await this.#storage.put(DIAGNOSTICS_KEY, state);
    return {
      accepted,
      duplicates,
      storedIncidents: state.incidents.length,
      retentionDays: 30,
      updatedAt: state.updatedAt,
    };
  }

  async #export() {
    const now = Date.now();
    const stored = await this.#storage.get<CascadeDiagnosticsState>(DIAGNOSTICS_KEY) ?? emptyState();
    const state = prune(stored, now);
    if (state.incidents.length !== stored.incidents.length) await this.#storage.put(DIAGNOSTICS_KEY, state);
    return {
      schemaVersion: 1,
      updatedAt: state.updatedAt,
      retentionDays: 30,
      maxStoredIncidents: MAX_STORED_INCIDENTS,
      incidents: state.incidents,
    };
  }
}
