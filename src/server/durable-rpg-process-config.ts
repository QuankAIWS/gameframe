import { resolve } from "node:path";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8790;
const MINIMUM_SERVICE_TOKEN_LENGTH = 32;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

export type DurableRpgProcessConfig = {
  filePath: string;
  host: string;
  port: number;
  gmBaseUrl: string;
  gmServiceToken: string;
  pollIntervalMs: number;
  deliveryTimeoutMs: number;
  developmentAuthEnabled: true;
};

/**
 * Current VM entrypoint is intentionally loopback-only and development-auth
 * only. It must not be placed behind Cloudflare Tunnel until a production
 * RequestAuthenticator replaces trusted development headers.
 */
export function parseDurableRpgProcessConfig(
  environment: NodeJS.ProcessEnv,
): DurableRpgProcessConfig {
  if (environment.GAMEFRAME_ALLOW_DEVELOPMENT_AUTH !== "1") {
    throw new Error(
      "GAMEFRAME_ALLOW_DEVELOPMENT_AUTH=1 is required until a production identity provider is configured.",
    );
  }

  const host = requiredOrDefault(environment.GAMEFRAME_RPG_HOST, DEFAULT_HOST);
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error(
      "GAMEFRAME_RPG_HOST must remain loopback-only while development header authentication is enabled.",
    );
  }

  const filePath = required(environment.GAMEFRAME_RPG_DATABASE_PATH, "GAMEFRAME_RPG_DATABASE_PATH");
  const gmBaseUrl = normalizeLoopbackUrl(
    required(environment.RPG_GM_BASE_URL, "RPG_GM_BASE_URL"),
  );
  const gmServiceToken = required(
    environment.RPG_GM_SERVICE_TOKEN,
    "RPG_GM_SERVICE_TOKEN",
  );
  if (gmServiceToken.length < MINIMUM_SERVICE_TOKEN_LENGTH) {
    throw new Error(
      `RPG_GM_SERVICE_TOKEN must contain at least ${MINIMUM_SERVICE_TOKEN_LENGTH} characters.`,
    );
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
    developmentAuthEnabled: true,
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
