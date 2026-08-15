import assert from "node:assert/strict";
import test from "node:test";
import { SignedSessionCodec } from "../auth/signed-session.ts";
import { handleFamilyAuthEdge } from "./family-auth-edge.ts";
import type { GameFrameWorkerEnv } from "./runtime-contracts.ts";

const SESSION_SECRET = "0123456789abcdef0123456789abcdef";
const APPROVAL_SECRET = "abcdef0123456789abcdef0123456789";
const ADMIN_ID = "123456789012345678";

async function adminCookie() {
  const codec = new SignedSessionCodec(SESSION_SECRET);
  const token = await codec.issue({
    playerId: `discord:${ADMIN_ID}`,
    source: "discord",
    displayName: "Admin",
  }, 300);
  return `gameframe_session=${token}`;
}

function envWithInternal(fetcher: (request: Request) => Promise<Response>): GameFrameWorkerEnv {
  return {
    SESSION_SECRET,
    GAMEFRAME_ADMIN_DISCORD_USER_IDS: ADMIN_ID,
    GAMEFRAME_FAMILY_APPROVAL_SECRET: APPROVAL_SECRET,
    MATCHES: {
      idFromName(name: string) { return name as any; },
      get() { return { fetch: fetcher } as any; },
    } as any,
  } as GameFrameWorkerEnv;
}

test("family approval rejects the wrong approval credential with 403", async () => {
  const request = new Request("https://gameframe.test/api/admin/family/enrollments/approve", {
    method: "POST",
    headers: {
      cookie: await adminCookie(),
      "content-type": "application/json",
      "x-gameframe-family-approval": "x".repeat(64),
    },
    body: JSON.stringify({ requestId: "request-1" }),
  });
  const response = await handleFamilyAuthEdge(request, envWithInternal(async () => {
    throw new Error("internal family runtime should not be reached with a bad approval secret");
  }));

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: "family_approval_required",
    message: "Family device approval requires the separate approval credential.",
  });
});

test("family approval forwards the authenticated administrator identity", async () => {
  let forwarded: Record<string, unknown> | null = null;
  const request = new Request("https://gameframe.test/api/admin/family/enrollments/approve", {
    method: "POST",
    headers: {
      cookie: await adminCookie(),
      "content-type": "application/json",
      "x-gameframe-family-approval": APPROVAL_SECRET,
    },
    body: JSON.stringify({ requestId: "request-2" }),
  });
  const response = await handleFamilyAuthEdge(request, envWithInternal(async (internalRequest) => {
    assert.equal(new URL(internalRequest.url).pathname, "/family/approve");
    forwarded = await internalRequest.json() as Record<string, unknown>;
    return new Response(JSON.stringify({ approved: true, requestId: "request-2" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(forwarded, {
    requestId: "request-2",
    approvedBy: `discord:${ADMIN_ID}`,
  });
});

test("pending enrollment removal requires admin auth and does not require the approval credential", async () => {
  let forwarded: Record<string, unknown> | null = null;
  const request = new Request("https://gameframe.test/api/admin/family/enrollments/remove", {
    method: "POST",
    headers: {
      cookie: await adminCookie(),
      "content-type": "application/json",
    },
    body: JSON.stringify({ requestId: "duplicate-request" }),
  });
  const response = await handleFamilyAuthEdge(request, envWithInternal(async (internalRequest) => {
    assert.equal(new URL(internalRequest.url).pathname, "/family/enrollment/remove");
    forwarded = await internalRequest.json() as Record<string, unknown>;
    return new Response(JSON.stringify({ removed: true, requestId: "duplicate-request" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(forwarded, { requestId: "duplicate-request" });
});
