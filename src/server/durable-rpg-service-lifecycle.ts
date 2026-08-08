import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";

import type { RequestAuthenticator } from "../auth/request-authenticator.ts";
import {
  RuntimeCommandDeliveryHttpTransport,
  RuntimeCommandDeliveryWorker,
  type RuntimeCommandDeliveryWorkerResult,
} from "../rpg/runtime-command-delivery-worker.ts";
import { SqliteRuntimeCommandOutbox } from "../rpg/runtime-command-outbox.ts";
import type { DurableCampaignBootstrap } from "../rpg/sqlite-rpg-campaign-store.ts";
import { createDurableRpgHttpServer } from "./durable-rpg-http-server.ts";

const DEFAULT_POLL_INTERVAL_MS = 250;

export type DurableRpgServiceState =
  | "created"
  | "starting"
  | "running"
  | "retiring"
  | "stopped"
  | "failed";

export type DurableRpgServiceAddress = {
  host: string;
  port: number;
};

type DeliveryWorker = {
  runOnce(): Promise<RuntimeCommandDeliveryWorkerResult>;
};

/**
 * Owns the durable RPG HTTP ingress and the single GameFrame-to-GM outbox loop.
 * Retirement closes player/runtime ingress first, then drains immediately
 * deliverable command work until idle or a retry must be left for a later run.
 */
export class DurableRpgServiceLifecycle {
  readonly #server: Server;
  readonly #worker: DeliveryWorker;
  readonly #pollIntervalMs: number;
  readonly #closeResources?: () => void | Promise<void>;
  #state: DurableRpgServiceState = "created";
  #failure?: Error;
  #loop?: Promise<void>;
  #pollAbort?: AbortController;
  #serverClose?: Promise<void>;
  #resourcesClosed = false;

  constructor(input: {
    server: Server;
    worker: DeliveryWorker;
    pollIntervalMs?: number;
    closeResources?: () => void | Promise<void>;
  }) {
    if (!input?.server) throw new TypeError("server is required");
    if (!input.worker) throw new TypeError("worker is required");
    this.#server = input.server;
    this.#worker = input.worker;
    this.#pollIntervalMs = boundedInteger(
      input.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      "pollIntervalMs",
      1,
      60_000,
    );
    this.#closeResources = input.closeResources;
  }

  get state(): DurableRpgServiceState {
    return this.#state;
  }

  get failure(): Error | undefined {
    return this.#failure;
  }

  async start(input: {
    host?: string;
    port?: number;
  } = {}): Promise<DurableRpgServiceAddress> {
    if (this.#state !== "created") {
      throw new Error(`Durable RPG service cannot start from ${this.#state}.`);
    }
    const host = input.host?.trim() || "127.0.0.1";
    const port = boundedInteger(input.port ?? 0, "port", 0, 65_535);
    this.#state = "starting";
    try {
      await listen(this.#server, host, port);
      const address = requireAddress(this.#server);
      this.#state = "running";
      this.#loop = this.#runLoop();
      return address;
    } catch (error) {
      this.#failure = toError(error);
      await this.#closeResourcesOnce();
      this.#state = "failed";
      throw this.#failure;
    }
  }

  async retire(): Promise<void> {
    if (this.#state === "stopped") return;
    if (this.#state === "created") {
      this.#state = "stopped";
      await this.#closeResourcesOnce();
      return;
    }
    if (this.#state === "starting") {
      throw new Error("Durable RPG service cannot retire while startup is unresolved.");
    }
    if (this.#state === "running") this.#state = "retiring";
    this.#wakeLoop();
    await this.#closeIngress();
    await this.#loop;
    await this.#closeResourcesOnce();
    if (this.#failure) throw this.#failure;
    this.#state = "stopped";
  }

  /** Waits for fatal termination or a concurrently requested retirement. */
  async waitUntilTerminated(): Promise<void> {
    if (this.#state === "created" || this.#state === "starting") {
      throw new Error(`Durable RPG service cannot be awaited from ${this.#state}.`);
    }
    if (this.#state === "stopped") return;
    await this.#loop;
    if (this.#failure) throw this.#failure;
  }

  async #runLoop(): Promise<void> {
    try {
      while (this.#state === "running" || this.#state === "retiring") {
        const result = await this.#worker.runOnce();
        if (this.#state === "retiring") {
          if (result.kind === "idle" || result.kind === "retry-scheduled") break;
          continue;
        }
        if (result.kind === "idle" || result.kind === "retry-scheduled") {
          await this.#waitForPoll();
        }
      }
    } catch (error) {
      this.#failure = toError(error);
      await this.#closeIngress();
      await this.#closeResourcesOnce();
      this.#state = "failed";
    }
  }

  async #waitForPoll(): Promise<void> {
    const controller = new AbortController();
    this.#pollAbort = controller;
    try {
      await sleep(this.#pollIntervalMs, undefined, { signal: controller.signal });
    } catch (error) {
      if (!controller.signal.aborted) throw error;
    } finally {
      if (this.#pollAbort === controller) this.#pollAbort = undefined;
    }
  }

  #wakeLoop(): void {
    this.#pollAbort?.abort();
  }

  async #closeIngress(): Promise<void> {
    if (this.#serverClose) return await this.#serverClose;
    if (!this.#server.listening) return;
    this.#serverClose = new Promise<void>((resolve, reject) => {
      this.#server.close((error) => error ? reject(error) : resolve());
    });
    return await this.#serverClose;
  }

  async #closeResourcesOnce(): Promise<void> {
    if (this.#resourcesClosed) return;
    this.#resourcesClosed = true;
    await this.#closeResources?.();
  }
}

export function createConfiguredDurableRpgService(input: {
  filePath: string;
  gmBaseUrl: string;
  gmServiceToken: string;
  authenticator?: RequestAuthenticator;
  bootstrapCampaigns?: DurableCampaignBootstrap[];
  stagingAdminReset?: {
    campaignId: string;
    requestReset: () => void | Promise<void>;
  };
  clock?: () => string;
  pollIntervalMs?: number;
  deliveryTimeoutMs?: number;
}): DurableRpgServiceLifecycle {
  const clock = input.clock ?? (() => new Date().toISOString());
  const server = createDurableRpgHttpServer({
    filePath: input.filePath,
    ...(input.authenticator ? { authenticator: input.authenticator } : {}),
    ...(input.bootstrapCampaigns ? { bootstrapCampaigns: input.bootstrapCampaigns } : {}),
    ...(input.stagingAdminReset ? { stagingAdminReset: input.stagingAdminReset } : {}),
    clock,
  });
  const outbox = new SqliteRuntimeCommandOutbox({ filePath: input.filePath });
  const worker = new RuntimeCommandDeliveryWorker({
    outbox,
    transport: new RuntimeCommandDeliveryHttpTransport({
      baseUrl: input.gmBaseUrl,
      serviceToken: input.gmServiceToken,
      ...(input.deliveryTimeoutMs === undefined
        ? {}
        : { timeoutMs: input.deliveryTimeoutMs }),
    }),
    clock,
  });
  return new DurableRpgServiceLifecycle({
    server,
    worker,
    ...(input.pollIntervalMs === undefined
      ? {}
      : { pollIntervalMs: input.pollIntervalMs }),
    closeResources: () => outbox.close(),
  });
}

function listen(server: Server, host: string, port: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

function requireAddress(server: Server): DurableRpgServiceAddress {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Durable RPG service did not acquire a TCP address.");
  }
  const tcp = address as AddressInfo;
  return { host: tcp.address, port: tcp.port };
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

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Durable RPG service failed.");
}
