import {
  AuthenticationError,
  type AuthenticatedPrincipal,
} from "./request-authenticator.ts";

export interface StagingAdminEnvironment {
  GAMEFRAME_ADMIN_DISCORD_USER_IDS?: string;
}

/**
 * Operator authority is deliberately separate from ordinary staging access.
 * Missing or malformed configuration fails closed; wildcard admin grants are
 * never accepted.
 */
export function stagingAdminDiscordUserIds(
  environment: StagingAdminEnvironment,
): ReadonlySet<string> {
  const configured = environment.GAMEFRAME_ADMIN_DISCORD_USER_IDS?.trim() ?? "";
  if (!configured) return new Set();
  if (configured === "*") {
    throw new Error("GAMEFRAME_ADMIN_DISCORD_USER_IDS must never use a wildcard.");
  }
  const ids = configured.split(",").map((value) => value.trim()).filter(Boolean);
  if (ids.length === 0 || ids.some((id) => !/^\d+$/.test(id))) {
    throw new Error(
      "GAMEFRAME_ADMIN_DISCORD_USER_IDS must contain comma-separated numeric Discord user IDs.",
    );
  }
  return new Set(ids);
}

export function isStagingAdminPrincipal(
  environment: StagingAdminEnvironment,
  principal: AuthenticatedPrincipal,
): boolean {
  if (principal.source !== "discord") return false;
  const match = /^discord:(\d+)$/.exec(principal.playerId);
  if (!match) return false;
  return stagingAdminDiscordUserIds(environment).has(match[1]!);
}

export function requireStagingAdminPrincipal(
  environment: StagingAdminEnvironment,
  principal: AuthenticatedPrincipal,
): AuthenticatedPrincipal & { admin: true } {
  if (!isStagingAdminPrincipal(environment, principal)) {
    throw new AuthenticationError(
      "forbidden",
      "This Discord account does not have GameFrame staging administrator authority.",
    );
  }
  return { ...principal, admin: true };
}
