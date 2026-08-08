import { describe, expect, it } from "vitest";

import {
  isStagingAdminPrincipal,
  requireStagingAdminPrincipal,
  stagingAdminDiscordUserIds,
} from "./staging-admin.ts";

describe("staging administrator authorization", () => {
  it("grants only explicitly configured Discord principals", () => {
    const env = { GAMEFRAME_ADMIN_DISCORD_USER_IDS: "1234,5678" };
    expect(stagingAdminDiscordUserIds(env)).toEqual(new Set(["1234", "5678"]));
    expect(isStagingAdminPrincipal(env, {
      playerId: "discord:1234",
      source: "discord",
    })).toBe(true);
    expect(isStagingAdminPrincipal(env, {
      playerId: "discord:9999",
      source: "discord",
    })).toBe(false);
    expect(isStagingAdminPrincipal(env, {
      playerId: "discord:1234",
      source: "development",
    })).toBe(false);
  });

  it("never accepts wildcard or malformed administrator configuration", () => {
    expect(() => stagingAdminDiscordUserIds({
      GAMEFRAME_ADMIN_DISCORD_USER_IDS: "*",
    })).toThrow(/wildcard/i);
    expect(() => stagingAdminDiscordUserIds({
      GAMEFRAME_ADMIN_DISCORD_USER_IDS: "1234,nope",
    })).toThrow(/numeric/i);
    expect(stagingAdminDiscordUserIds({})).toEqual(new Set());
  });

  it("fails closed when a non-admin principal requests operator authority", () => {
    expect(() => requireStagingAdminPrincipal(
      { GAMEFRAME_ADMIN_DISCORD_USER_IDS: "1234" },
      { playerId: "discord:5678", source: "discord" },
    )).toThrow(/administrator authority/i);
  });
});
