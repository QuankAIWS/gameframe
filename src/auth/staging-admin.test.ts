import assert from "node:assert/strict";
import test from "node:test";

import {
  isStagingAdminPrincipal,
  requireStagingAdminPrincipal,
  stagingAdminDiscordUserIds,
} from "./staging-admin.ts";

test("staging administrator grants only explicitly configured Discord principals", () => {
  const env = { GAMEFRAME_ADMIN_DISCORD_USER_IDS: "1234,5678" };
  assert.deepEqual(stagingAdminDiscordUserIds(env), new Set(["1234", "5678"]));
  assert.equal(isStagingAdminPrincipal(env, {
    playerId: "discord:1234",
    source: "discord",
  }), true);
  assert.equal(isStagingAdminPrincipal(env, {
    playerId: "discord:9999",
    source: "discord",
  }), false);
  assert.equal(isStagingAdminPrincipal(env, {
    playerId: "discord:1234",
    source: "development",
  }), false);
});

test("staging administrator never accepts wildcard or malformed configuration", () => {
  assert.throws(
    () => stagingAdminDiscordUserIds({ GAMEFRAME_ADMIN_DISCORD_USER_IDS: "*" }),
    /wildcard/i,
  );
  assert.throws(
    () => stagingAdminDiscordUserIds({ GAMEFRAME_ADMIN_DISCORD_USER_IDS: "1234,nope" }),
    /numeric/i,
  );
  assert.deepEqual(stagingAdminDiscordUserIds({}), new Set());
});

test("staging administrator fails closed for a non-admin principal", () => {
  assert.throws(
    () => requireStagingAdminPrincipal(
      { GAMEFRAME_ADMIN_DISCORD_USER_IDS: "1234" },
      { playerId: "discord:5678", source: "discord" },
    ),
    /administrator authority/i,
  );
});
