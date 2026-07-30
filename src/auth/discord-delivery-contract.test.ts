import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Discord authentication remains a provider boundary rather than game authority", async () => {
  const oauth = await read("src/auth/discord-oauth.ts");
  const sessions = await read("src/auth/signed-session.ts");
  const router = await read("src/cloudflare/worker-router.ts");
  const wrangler = await read("wrangler.jsonc");
  const launcher = await read("public/auth-launcher.js");
  const identity = await read("public/gameframe-auth.js");
  const invitations = await read("public/secure-match-invite.js");

  assert.match(oauth, /DiscordOAuthStateCodec/);
  assert.match(oauth, /DISCORD_ALLOWED_USER_IDS/);
  assert.match(oauth, /safeReturnTo/);
  assert.match(oauth, /oauth_state_invalid/);
  assert.match(oauth, /https:\/\/discord\.com\/api\/v10\/users\/@me/);
  assert.doesNotMatch(oauth, /MatchSession|applyAction|legalActions/);

  assert.match(sessions, /createWebsiteSessionCookie/);
  assert.match(sessions, /SameSite=Lax/);
  assert.match(sessions, /createDiscordActivitySessionCookie/);
  assert.match(sessions, /SameSite=None/);
  assert.match(sessions, /Partitioned/);

  for (const route of [
    "/auth/discord/start",
    "/auth/discord/callback",
    "/auth/discord/activity/config",
    "/auth/discord/activity/session",
    "/api/session",
    "/auth/logout",
    "/api/invitations",
    "/api/invitations/claim",
  ]) {
    assert.match(router, new RegExp(route.replaceAll("/", "\\/")));
  }
  assert.match(router, /requireDirectMatchCreationPolicy/);
  assert.match(router, /SignedCookieSessionAuthenticator/);
  assert.match(router, /authenticatedInvitations: true/);
  assert.doesNotMatch(router, /x-gameframe-player-id/);

  for (const requiredBinding of [
    "SESSION_SECRET",
    "DISCORD_CLIENT_ID",
    "DISCORD_CLIENT_SECRET",
    "DISCORD_ALLOWED_USER_IDS",
  ]) {
    assert.match(wrangler, new RegExp(`"${requiredBinding}"`));
  }
  assert.match(wrangler, /"\/auth\/\*"/);

  assert.match(launcher, /establishGameFrameIdentity/);
  assert.match(launcher, /url\.searchParams\.delete\("player"\)/);
  assert.match(launcher, /installAuthenticatedInvitationFlow/);
  assert.doesNotMatch(launcher, /Verified friend invites are not enabled/);
  assert.match(invitations, /\/api\/invitations/);
  assert.doesNotMatch(invitations, /player=/);
  assert.match(identity, /\/auth\/discord\/start/);
  assert.match(identity, /\/api\/session/);
});

test("every browser surface resolves server identity before loading game code", async () => {
  const pages = [
    ["public/index.html", "/app.js"],
    ["public/tactical.html", "/tactical-app.js"],
    ["public/combat.html", "/combat-app.js"],
    ["public/invite.html", "/invite-app.js"],
  ] as const;

  for (const [path, entry] of pages) {
    const page = await read(path);
    assert.match(page, /src="\/auth-launcher\.js"/);
    assert.match(page, new RegExp(`data-entry="${entry.replaceAll("/", "\\/").replaceAll(".", "\\.")}"`));
    assert.doesNotMatch(page, new RegExp(`src="${entry.replaceAll("/", "\\/").replaceAll(".", "\\.")}"`));
  }
});
