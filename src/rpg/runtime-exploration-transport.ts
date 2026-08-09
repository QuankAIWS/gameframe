import { createHash } from "node:crypto";

import {
  normalizeRpgExplorationProjection,
  type RpgExplorationProjectionV1,
} from "./rpg-exploration-contract.ts";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_BYTES = 131_072;

type FetchLike = typeof fetch;

type RuntimeErrorBody = {
  error?: unknown;
  message?: unknown;
};

export class RuntimeExplorationTransportError extends Error {
  readonly code: "runtime-unavailable" | "runtime-rejected" | "invalid-runtime-response";
  readonly retryable: boolean;
  readonly status?: number;

  constructor(input: {
    code: RuntimeExplorationTransportError["code"];
    message: string;
    retryable: boolean;
    status?: number;
    cause?: unknown;
  }) {
    super(input.message, input.cause === undefined ? undefined : { cause: input.cause });
    this.name = "RuntimeExplorationTransportError";
    this.code = input.code;
    this.retryable = input.retryable;
    if (input.status !== undefined) this.status = input.status;
  }
}

export class RuntimeExplorationHttpTransport {
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
    this.#endpoint = endpoint(input?.baseUrl);
    this.#serviceToken = serviceToken(input?.serviceToken);
    this.#timeoutMs = boundedInteger(input.timeoutMs ?? DEFAULT_TIMEOUT_MS, "timeoutMs", 100, 60_000);
    this.#maxResponseBytes = boundedInteger(
      input.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES,
      "maxResponseBytes",
      4_096,
      1_048_576,
    );
    this.#fetch = input.fetchImpl ?? fetch;
  }

  async attach(input: {
    campaignId: string;
    authenticatedPlayerId: string;
  }): Promise<RpgExplorationProjectionV1> {
    const campaignId = identifier(input.campaignId, "campaignId");
    const authenticatedPlayerId = identifier(input.authenticatedPlayerId, "authenticatedPlayerId");
    const connectionId = explorationConnectionId(campaignId, authenticatedPlayerId);

    let response: Response;
    try {
      response = await this.#fetch(this.#endpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${this.#serviceToken}`,
          "content-type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          protocolVersion: 1,
          kind: "campaign.exploration.attach",
          campaignId,
          connectionId,
          authenticatedPlayerId,
        }),
        redirect: "error",
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
    } catch (error) {
      throw new RuntimeExplorationTransportError({
        code: "runtime-unavailable",
        message: "RPG GM Runtime exploration endpoint was unavailable.",
        retryable: true,
        cause: error,
      });
    }

    let body: unknown;
    try {
      body = JSON.parse(await readBoundedText(response, this.#maxResponseBytes));
    } catch (error) {
      throw new RuntimeExplorationTransportError({
        code: "invalid-runtime-response",
        message: "RPG GM Runtime returned an invalid or oversized exploration response.",
        retryable: response.status >= 500,
        status: response.status,
        cause: error,
      });
    }

    if (!response.ok) {
      const errorBody = body && typeof body === "object" && !Array.isArray(body)
        ? body as RuntimeErrorBody
        : {};
      throw new RuntimeExplorationTransportError({
        code: response.status >= 500 || response.status === 429
          ? "runtime-unavailable"
          : "runtime-rejected",
        message: typeof errorBody.message === "string"
          ? errorBody.message
          : `RPG GM Runtime rejected exploration attach with HTTP ${response.status}.`,
        retryable: response.status >= 500 || response.status === 429,
        status: response.status,
      });
    }

    let projection: RpgExplorationProjectionV1;
    try {
      projection = normalizeRpgExplorationProjection(body);
    } catch (error) {
      throw new RuntimeExplorationTransportError({
        code: "invalid-runtime-response",
        message: "RPG GM Runtime returned a malformed exploration projection.",
        retryable: false,
        status: response.status,
        cause: error,
      });
    }
    if (
      projection.campaignId !== campaignId
      || projection.viewer.playerId !== authenticatedPlayerId
    ) {
      throw new RuntimeExplorationTransportError({
        code: "invalid-runtime-response",
        message: "RPG GM Runtime substituted exploration campaign or viewer identity.",
        retryable: false,
        status: response.status,
      });
    }
    return projection;
  }
}

export function explorationConnectionId(campaignId: string, playerId: string): string {
  const digest = createHash("sha256")
    .update(`${campaignId}\u0000${playerId}`, "utf8")
    .digest("base64url")
    .slice(0, 32);
  return `connection:rpg-exploration:${digest}`;
}

function endpoint(value: unknown): URL {
  if (typeof value !== "string" || !value.trim()) throw new TypeError("baseUrl is required");
  return new URL("/v1/gameframe/exploration/attach", new URL(value));
}

function serviceToken(value: unknown): string {
  if (typeof value !== "string") throw new TypeError("serviceToken must be a string");
  const bytes = Buffer.byteLength(value, "utf8");
  if (bytes < 32 || bytes > 512) {
    throw new TypeError("serviceToken must contain from 32 through 512 UTF-8 bytes");
  }
  return value;
}

function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value)) {
    throw new TypeError(`${label} is not a valid identifier`);
  }
  return value;
}

function boundedInteger(value: unknown, label: string, minimum: number, maximum: number): number {
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
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maximumBytes) throw new Error("response exceeds maximum size");
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
