import {
  normalizeRuntimeCommandInboxReceipt,
  RuntimeCommandOutboxError,
  SqliteRuntimeCommandOutbox,
  type RuntimeCommandDeliveryV1,
  type RuntimeCommandInboxReceiptV1,
  type RuntimeCommandOutboxRecord,
} from "./runtime-command-outbox.ts";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_BYTES = 16_384;
const DEFAULT_LEASE_DURATION_MS = 30_000;

type FetchLike = typeof fetch;

type JsonRecord = Record<string, unknown>;

export interface RuntimeCommandDeliveryTransport {
  deliver(delivery: RuntimeCommandDeliveryV1): Promise<RuntimeCommandInboxReceiptV1>;
}

export class RuntimeCommandDeliveryTransportError extends Error {
  readonly code:
    | "runtime-unavailable"
    | "runtime-rejected"
    | "invalid-runtime-response";
  readonly retryable: boolean;
  readonly status?: number;

  constructor(input: {
    code: RuntimeCommandDeliveryTransportError["code"];
    message: string;
    retryable: boolean;
    status?: number;
    cause?: unknown;
  }) {
    super(input.message, input.cause === undefined ? undefined : { cause: input.cause });
    this.name = "RuntimeCommandDeliveryTransportError";
    this.code = input.code;
    this.retryable = input.retryable;
    if (input.status !== undefined) this.status = input.status;
  }
}

export class RuntimeCommandDeliveryHttpTransport implements RuntimeCommandDeliveryTransport {
  readonly #endpoint: URL;
  readonly #serviceToken: string;
  readonly #timeoutMs: number;
  readonly #maxResponseBytes: number;
  readonly #fetch: FetchLike;

  constructor(input: {
    baseUrl: string;
    serviceToken: string;
    timeoutMs?: number;
    maxResponseBytes?: number;
    fetchImpl?: FetchLike;
  }) {
    this.#endpoint = commandEndpoint(input?.baseUrl);
    this.#serviceToken = serviceToken(input?.serviceToken);
    this.#timeoutMs = boundedInteger(
      input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      "timeoutMs",
      100,
      60_000,
    );
    this.#maxResponseBytes = boundedInteger(
      input.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES,
      "maxResponseBytes",
      1_024,
      65_536,
    );
    this.#fetch = input.fetchImpl ?? fetch;
  }

  async deliver(delivery: RuntimeCommandDeliveryV1): Promise<RuntimeCommandInboxReceiptV1> {
    let response: Response;
    try {
      response = await this.#fetch(this.#endpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${this.#serviceToken}`,
          "content-type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(delivery),
        redirect: "error",
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
    } catch (error) {
      throw new RuntimeCommandDeliveryTransportError({
        code: "runtime-unavailable",
        message: "RPG GM Runtime command endpoint was unavailable.",
        retryable: true,
        cause: error,
      });
    }

    let body: unknown;
    try {
      body = JSON.parse(await readBoundedText(response, this.#maxResponseBytes));
    } catch (error) {
      throw new RuntimeCommandDeliveryTransportError({
        code: "invalid-runtime-response",
        message: "RPG GM Runtime returned an invalid or oversized JSON response.",
        retryable: response.status >= 500,
        status: response.status,
        cause: error,
      });
    }

    if (!response.ok) {
      const errorBody = jsonRecord(body);
      throw new RuntimeCommandDeliveryTransportError({
        code: response.status >= 500 || response.status === 429
          ? "runtime-unavailable"
          : "runtime-rejected",
        message: safeErrorMessage(
          errorBody,
          `RPG GM Runtime rejected command delivery with HTTP ${response.status}.`,
        ),
        retryable: response.status >= 500 || response.status === 429,
        status: response.status,
      });
    }

    let receipt: RuntimeCommandInboxReceiptV1;
    try {
      receipt = normalizeRuntimeCommandInboxReceipt(body);
    } catch (error) {
      throw new RuntimeCommandDeliveryTransportError({
        code: "invalid-runtime-response",
        message: "RPG GM Runtime returned a malformed command receipt.",
        retryable: false,
        status: response.status,
        cause: error,
      });
    }
    if (
      receipt.deliveryId !== delivery.deliveryId
      || receipt.campaignId !== delivery.campaignId
      || receipt.commandId !== delivery.commandId
    ) {
      throw new RuntimeCommandDeliveryTransportError({
        code: "invalid-runtime-response",
        message: "RPG GM Runtime substituted command receipt identity.",
        retryable: false,
        status: response.status,
      });
    }
    return receipt;
  }
}

export type RuntimeCommandDeliveryWorkerResult =
  | { kind: "idle" }
  | { kind: "runtime-accepted"; record: RuntimeCommandOutboxRecord }
  | {
      kind: "retry-scheduled" | "reconciliation-required";
      record: RuntimeCommandOutboxRecord;
      error: RuntimeCommandDeliveryTransportError;
    };

export class RuntimeCommandDeliveryWorker {
  readonly #outbox: SqliteRuntimeCommandOutbox;
  readonly #transport: RuntimeCommandDeliveryTransport;
  readonly #clock: () => string;
  readonly #leaseDurationMs: number;

  constructor(input: {
    outbox: SqliteRuntimeCommandOutbox;
    transport: RuntimeCommandDeliveryTransport;
    clock?: () => string;
    leaseDurationMs?: number;
  }) {
    if (!input?.outbox) throw new TypeError("outbox is required");
    if (!input.transport) throw new TypeError("transport is required");
    this.#outbox = input.outbox;
    this.#transport = input.transport;
    this.#clock = input.clock ?? (() => new Date().toISOString());
    this.#leaseDurationMs = boundedInteger(
      input.leaseDurationMs ?? DEFAULT_LEASE_DURATION_MS,
      "leaseDurationMs",
      1_000,
      300_000,
    );
  }

  async runOnce(): Promise<RuntimeCommandDeliveryWorkerResult> {
    const claim = this.#outbox.claimNext({
      now: this.#clock(),
      leaseDurationMs: this.#leaseDurationMs,
    });
    if (!claim) return { kind: "idle" };

    try {
      const receipt = await this.#transport.deliver(claim.record.delivery);
      return {
        kind: "runtime-accepted",
        record: this.#outbox.markRuntimeAccepted({
          deliveryId: claim.record.delivery.deliveryId,
          leaseToken: claim.leaseToken,
          receipt,
          now: this.#clock(),
        }),
      };
    } catch (error) {
      const transportError = normalizeTransportError(error);
      const failureInput = {
        deliveryId: claim.record.delivery.deliveryId,
        leaseToken: claim.leaseToken,
        code: transportError.code,
        message: transportError.message,
        now: this.#clock(),
      };
      if (transportError.retryable) {
        return {
          kind: "retry-scheduled",
          record: this.#outbox.markRetryableFailure(failureInput),
          error: transportError,
        };
      }
      return {
        kind: "reconciliation-required",
        record: this.#outbox.markReconciliationRequired(failureInput),
        error: transportError,
      };
    }
  }
}

function normalizeTransportError(error: unknown): RuntimeCommandDeliveryTransportError {
  if (error instanceof RuntimeCommandDeliveryTransportError) return error;
  if (error instanceof RuntimeCommandOutboxError) throw error;
  return new RuntimeCommandDeliveryTransportError({
    code: "runtime-unavailable",
    message: error instanceof Error ? error.message : "Unknown RPG GM Runtime delivery failure.",
    retryable: true,
    cause: error,
  });
}

function commandEndpoint(value: unknown): URL {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError("baseUrl is required");
  }
  const base = new URL(value.trim());
  if (base.protocol !== "http:" && base.protocol !== "https:") {
    throw new TypeError("baseUrl must use http or https");
  }
  if (base.username || base.password) {
    throw new TypeError("baseUrl must not contain URL credentials");
  }
  if (base.search || base.hash) {
    throw new TypeError("baseUrl must not contain a query or fragment");
  }
  return new URL("/v1/gameframe/commands", base);
}

function serviceToken(value: unknown): string {
  if (typeof value !== "string") throw new TypeError("serviceToken must be a string");
  const bytes = Buffer.byteLength(value, "utf8");
  if (bytes < 32 || bytes > 512) {
    throw new TypeError("serviceToken must contain from 32 through 512 UTF-8 bytes");
  }
  return value;
}

function boundedInteger(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== "number"
    || !Number.isInteger(value)
    || value < minimum
    || value > maximum
  ) {
    throw new TypeError(`${label} must be an integer from ${minimum} through ${maximum}`);
  }
  return value;
}

async function readBoundedText(response: Response, maximumBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximumBytes) {
        await reader.cancel("response too large");
        throw new Error(`response exceeds ${maximumBytes} bytes`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const combined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

function jsonRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : undefined;
}

function safeErrorMessage(body: JsonRecord | undefined, fallback: string): string {
  const message = body?.message;
  return typeof message === "string" && message.trim() && message.length <= 1_000
    ? message.trim()
    : fallback;
}
