import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("hosted human seats require signed invitations and verified principals", async () => {
  const token = await read("src/auth/match-invitation.ts");
  const runtime = await read("src/cloudflare/invitation-object-runtime.ts");
  const coordinator = await read("src/cloudflare/invitation-coordinator.ts");
  const router = await read("src/cloudflare/worker-router.ts");
  const worker = await read("src/cloudflare/worker.ts");
  const planning = await read("planning/authenticated-match-invitations.md");

  assert.match(token, /MatchInvitationTokenCodec/);
  assert.match(token, /scribbles-gameframe:match-invitation/);
  assert.match(token, /requireInvitationTarget/);
  assert.match(token, /resumePathForGame/);
  assert.doesNotMatch(token, /MatchSession|applyAction|legalActions/);

  assert.match(runtime, /INVITATION_RECORD_KEY/);
  assert.match(runtime, /#tail/);
  assert.match(runtime, /claimedNew: false/);
  assert.match(runtime, /invitation_claimed/);
  assert.match(runtime, /invitation_cancelled/);
  assert.match(runtime, /invitation_target_mismatch/);

  assert.match(coordinator, /invite:\$\{invitationId\}/);
  assert.match(coordinator, /#ensureMatch/);
  assert.match(coordinator, /playerIds = \[invitation\.inviter\.playerId, claimant\.playerId\]/);
  assert.match(coordinator, /existing\.playerIds\[0\] !== playerIds\[0\]/);
  assert.match(worker, /url\.pathname\.startsWith\("\/invitation\/"\)/);

  assert.match(router, /authenticatedInvitations: true/);
  assert.match(router, /Discord-authenticated human matches require a signed invitation/);
  assert.match(router, /\/api\/invitations\/claim/);
  assert.match(router, /requireDirectMatchCreationPolicy/);
  assert.doesNotMatch(router, /x-gameframe-player-id/);

  assert.match(planning, /An invitation is not a match and is not a player identity/);
  assert.match(planning, /The URL contains no `player` parameter/);
  assert.match(planning, /A Discord-authenticated principal may directly create only/);
});

test("hosted browser invitation links never transport a player identity", async () => {
  const launcher = await read("public/auth-launcher.js");
  const inviter = await read("public/secure-match-invite.js");
  const claimPage = await read("public/invite.html");
  const claimant = await read("public/invite-app.js");
  const browserTest = await read("test/browser/authenticated-invitation.spec.mjs");
  const packageJson = JSON.parse(await read("package.json"));

  assert.match(launcher, /installAuthenticatedInvitationFlow/);
  assert.doesNotMatch(launcher, /Verified friend invites are not enabled/);
  assert.match(inviter, /\/api\/invitations/);
  assert.match(inviter, /stopImmediatePropagation/);
  assert.doesNotMatch(inviter, /player=/);
  assert.match(claimPage, /name="referrer" content="no-referrer"/);
  assert.match(claimant, /searchParams\.delete\("token"\)/);
  assert.match(claimant, /\/api\/invitations\/claim/);
  assert.doesNotMatch(claimant, /player=/);
  assert.match(browserTest, /removes the token from browser history/);
  assert.match(packageJson.scripts["check:browser"], /public\/secure-match-invite\.js/);
  assert.match(packageJson.scripts["check:browser"], /public\/invite-app\.js/);
});
