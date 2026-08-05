import { resolve } from "node:path";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8790;
const MINIMUM_SECRET_BYTES = 32;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

export type DurableRpgAuthenticationConfig =
  | { mode: "development-header" }
  | {
      mode: "hmac-proxy";
      proxyHmacSecret: string;
      maxClockSkewMs: number;
      maxReplayEntries: number;
    };

export type DurableRpgProcessConfig = {
  filePath: string;
  host: string;
  port: number;
  gmBaseUrl: string;
  gmServiceToken: string;
  pollIntervalMs: number;
  deliveryTimeoutMs: number;
  authentication: DurableRpgAuthenticationConfig;
};

export function parseDurableRpgProcessConfig(
  environment: NodeJS.ProcessEnv,
): DurableRpgProcessConfig {
  const host = requiredOrDefault(environment.GAMEFRAME_RPG_HOST, DEFAULT_HOST);
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error("GAMEFRAME_RPG_HOST must remain loopback-only.");
  }

  const filePath = required(environment.GAMEFRAME_RPG_DATABASE_PATH, "GAMEFRAME_RPG_DATABASE_PATH");
  const gmBaseUrl = normalizeLoopbackUrl(
    required(environment.RPG_GM_BASE_URL, "RPG_GM_BASE_URL"),
  );
  const gmServiceToken = required(
    environment.RPG_GM_SERVICE_TOKEN,
    "RPG_GM_SERVICE_TOKEN",
  );
  if (Buffer.byteLength(gmServiceToken, "utf8") < MINIMUM_SECRET_BYTES) {
    throw new Error(`RPG_GM_SERVICE_TOKEN must contain at least ${MINIMUM_SECRET_BYTES} bytes.`);
  }

  return {
    filePath: resolve(filePath),
    host,
    port: integer(environment.GAMEFRAME_RPG_PORT, "GAMEFRAME_RPG_PORT", DEFAULT_PORT, 1, 65_535),
    gmBaseUrl,
    gmServiceToken,
    pollIntervalMs: integer(
      environment.GAMEFRAME_RPG_DELIVERY_POLL_MS,
      "GAMEFRAME_RPG_DELIVERY_POLL_MS",
      250,
      10,
      60_000,
    ),
    deliveryTimeoutMs: integer(
      environment.GAMEFRAME_RPG_DELIVERY_TIMEOUT_MS,
      "GAMEFRAME_RPG_DELIVERY_TIMEOUT_MS",
      10_000,
      100,
      60_000,
    ),
    authentication: authenticationConfig(environment),
  };
}

function authenticationConfig(environment: NodeJS.ProcessEnv): DurableRpgAuthenticationConfig {
  const mode = required(environment.GAMEFRAME_RPG_AUTH_MODE, "GAMEFRAME_RPG_AUTH_MODE");
  if (mode === "development-header") {
    if (environment.GAMEFRAME_ALLOW_DEVELOPMENT_AUTH !== "1") {
      throw new Error(
        "GAMEFRAME_ALLOW_DEVELOPMENT_AUTH=1 is required for development-header mode.",
      );
    }
    return { mode };
  }
  if (mode !== "hmac-proxy") {
    throw new Error("GAMEFRAME_RPG_AUTH_MODE must be development-header or hmac-proxy.");
  }
  const proxyHmacSecret = required(
    environment.GAMEFRAME_RPG_PROXY_HMAC_SECRET,
    "GAMEFRAME_RPG_PROXY_HMAC_SECRET",
  );
  if (Buffer.byteLength(proxyHmacSecret, "utf8") < MINIMUM_SECRET_BYTES) {
    throw new Error(
      `GAMEFRAME_RPG_PROXY_HMAC_SECRET must contain at least ${MINIMUM_SECRET_BYTES} bytes.`,
    );
  }
  return {
    mode,
    proxyHmacSecret,
    maxClockSkewMs: integer(
      environment.GAMEFRAME_RPG_PROXY_MAX_CLOCK_SKEW_MS,
      "GAMEFRAME_RPG_PROXY_MAX_CLOCK_SKEW_MS",
      60_000,
      1_000,
      300_000,
    ),
    maxReplayEntries: integer(
      environment.GAMEFRAME_RPG_PROXY_MAX_REPLAY_ENTRIES,
      "GAMEFRAME_RPG_PROXY_MAX_REPLAY_ENTRIES",
      10_000,
      100,
      1_000_000,
    ),
  };
}

function required(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function requiredOrDefault(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

function normalizeLoopbackUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw new Error("RPG_GM_BASE_URL must be a valid absolute URL.", { cause: error });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("RPG_GM_BASE_URL must use http or https.");
  }
  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error(
      "RPG_GM_BASE_URL must target the loopback GM service in the initial single-VM deployment.",
    );
  }
  url.username = "";
  url.password = "";
  url.hash = "";
  if (!url.pathname.endsWith("/")) url.pathname = `${url.pathname}/`;
  return url.toString();
}

function integer(
  value: string | undefined,
  label: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined || !value.trim()) return fallback;
  if (!/^\d+$/.test(value.trim())) {
    throw new Error(`${label} must be an integer from ${minimum} through ${maximum}.`);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
    throw new Error(`${label} must be an integer from ${minimum} through ${maximum}.`);
  }
  return number;
}
