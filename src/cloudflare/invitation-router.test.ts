import assert from "node:assert/strict";
import test from "node:test";
import { GAMEFRAME_BOT_PLAYER_ID } from "../agents/gameframe-bot.ts";
import { SignedSessionCodec } from "../auth/signed-session.ts";
import { InvitationObjectRuntime } from "./invitation-object-runtime.ts";
import { GameFrameMatchObjectRuntime } from "./match-object-runtime.ts";
import { PlayerPlatformObjectRuntime } from "./player-platform-object-runtime.ts";
import type {
  DurableObjectNamespaceLike,
  DurableObjectStubLike,
  DurableStorageLike,
  GameFrameWorkerEnv,
} from "./runtime-contracts.ts";
import { createGameFrameWorker } from "./worker-router.ts";

const secret = "0123456789abcdef0123456789abcdef";
const sessionCodec = new SignedSessionCodec(secret);

class FakeStorage implements DurableStorageLike {
  readonly values = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    const value = this.values.get(key);
    return value === undefined ? undefined : structuredClone(value) as T;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.values.set(key, structuredClone(value));
  }
}

type Runtime = InvitationObjectRuntime | GameFrameMatchObjectRuntime | PlayerPlatformObjectRuntime;

class HybridNamespace implements DurableObjectNamespaceLike {
  readonly #storage = new Map<string, FakeStorage>();
  readonly #instances = new Map<string, Runtime>();

  idFromName(name: string): unknown {
    return name;
  }

  get(id: unknown): DurableObjectStubLike {
    const name = String(id);
    return { fetch: (request) => this.#instance(name).fetch(request) };
  }

  evict(name: string): void {
    this.#instances.delete(name);
  }

  #instance(name: string): Runtime {
    let instance = this.#instances.get(name);
    if (instance) return instance;
    let storage = this.#storage.get(name);
    if (!storage) {
      storage = new FakeStorage();
      this.#storage.set(name, storage);
    }
    instance = name.startsWith("invite:")
      ? new InvitationObjectRuntime(storage)
      : name.startsWith("player:") || name.startsWith("directory:")
        ? new PlayerPlatformObjectRuntime(storage)
        : new GameFrameMatchObjectRuntime(storage);
    this.#instances.set(name, instance);
    return instance;
  }
}

async function cookieFor(playerId: string, displayName = playerId): Promise<string> {
  const token = await sessionCodec.issue({
    playerId,
    source: "discord",
    displayName,
  });
  return `gameframe_session=${token}`;
}

async function authenticatedFetch(
  worker: ReturnType<typeof createGameFrameWorker>,
  env: GameFrameWorkerEnv,
  path: string,
  playerId: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("cookie", await cookieFor(playerId));
  return worker.fetch(new Request(`https://games.example${path}`, { ...init, headers }), env);
}

function sequenceGenerator(values: string[]): () => string {
  let index = 0;
  return () => values[index++] ?? `generated-${index}`;
}

function invitationFromFeed(feed: any, invitationId: string) {
  return feed.invitations.find((invitation: any) => invitation.invitationId === invitationId);
}

test("authenticated invitation claim creates a match with both verified principals", async () => {
  const namespace = new HybridNamespace();
  const env: GameFrameWorkerEnv = { SESSION_SECRET: secret, MATCHES: namespace };
  const worker = createGameFrameWorker({
    idGenerator: sequenceGenerator(["invite-1", "match-1", "unused-retry"]),
  });

  const createdResponse = await authenticatedFetch(worker, env, "/api/invitations", "discord:111", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ gameId: "american-checkers" }),
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json() as any;
  assert.equal(created.invitation.invitationId, "invite-1");
  assert.equal(created.invitation.status, "pending");
  assert.equal(created.invitation.inviter.playerId, "discord:111");
  const token = new URL(created.inviteUrl).searchParams.get("token");
  assert.ok(token);
  assert.doesNotMatch(created.inviteUrl, /player=/);

  const claimedResponse = await authenticatedFetch(worker, env, "/api/invitations/claim", "discord:222", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  assert.equal(claimedResponse.status, 200);
  const claimed = await claimedResponse.json() as any;
  assert.equal(claimed.invitation.status, "claimed");
  assert.equal(claimed.invitation.matchId, "match-1");
  assert.equal(claimed.invitation.claimant.playerId, "discord:222");
  assert.equal(claimed.resumePath, "/?game=american-checkers&match=match-1");

  for (const playerId of ["discord:111", "discord:222"]) {
    const match = await authenticatedFetch(worker, env, "/api/matches/match-1", playerId);
    assert.equal(match.status, 200);
    const view = await match.json() as any;
    assert.deepEqual(view.playerIds, ["discord:111", "discord:222"]);
    assert.equal(view.gameId, "american-checkers");
  }

  namespace.evict("invite:invite-1");
  namespace.evict("match-1");
  const status = await authenticatedFetch(worker, env, "/api/invitations/invite-1", "discord:111");
  assert.equal(status.status, 200);
  assert.equal((await status.json() as any).resumePath, "/?game=american-checkers&match=match-1");

  const retry = await authenticatedFetch(worker, env, "/api/invitations/claim", "discord:222", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  assert.equal(retry.status, 200);
  assert.equal((await retry.json() as any).invitation.matchId, "match-1");

  const lateClaim = await authenticatedFetch(worker, env, "/api/invitations/claim", "discord:333", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  assert.equal(lateClaim.status, 409);
  assert.equal((await lateClaim.json() as any).error, "invitation_claimed");
});

test("Discord direct match creation permits GameFrameBot but rejects an unclaimed human seat", async () => {
  const env: GameFrameWorkerEnv = { SESSION_SECRET: secret, MATCHES: new HybridNamespace() };
  const worker = createGameFrameWorker({
    idGenerator: sequenceGenerator(["match-bot", "must-not-create"]),
  });

  const humanSpoof = await authenticatedFetch(worker, env, "/api/matches", "discord:111", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      gameId: "tic-tac-toe",
      playerIds: ["discord:111", "discord:222"],
    }),
  });
  assert.equal(humanSpoof.status, 403);
  assert.match((await humanSpoof.json() as any).message, /signed invitation/);

  const botMatch = await authenticatedFetch(worker, env, "/api/matches", "discord:111", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      gameId: "tic-tac-toe",
      playerIds: ["discord:111", GAMEFRAME_BOT_PLAYER_ID],
    }),
  });
  assert.equal(botMatch.status, 201);
  assert.equal((await botMatch.json() as any).matchId, "match-bot");
});

test("canonical targeted invitations deliver Accept custody and support recipient decline", async () => {
  const env: GameFrameWorkerEnv = { SESSION_SECRET: secret, MATCHES: new HybridNamespace() };
  const worker = createGameFrameWorker({ idGenerator: sequenceGenerator(["targeted-invite"]) });

  const createdResponse = await authenticatedFetch(worker, env, "/api/invitations", "discord:111", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ gameId: "american-checkers", targetPlayerId: "discord:222" }),
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json() as any;
  assert.equal(created.invitation.targetPlayerId, "discord:222");
  const token = new URL(created.inviteUrl).searchParams.get("token");
  assert.ok(token);

  const recipientFeedResponse = await authenticatedFetch(worker, env, "/api/me/feed", "discord:222");
  assert.equal(recipientFeedResponse.status, 200);
  const recipientPending = invitationFromFeed(await recipientFeedResponse.json(), "targeted-invite");
  assert.equal(recipientPending.status, "pending");
  assert.equal(recipientPending.claimToken, token);

  const inviterFeedResponse = await authenticatedFetch(worker, env, "/api/me/feed", "discord:111");
  assert.equal(inviterFeedResponse.status, 200);
  const inviterPending = invitationFromFeed(await inviterFeedResponse.json(), "targeted-invite");
  assert.equal(inviterPending.status, "pending");
  assert.equal(inviterPending.claimToken, null);

  const outsiderDecline = await authenticatedFetch(
    worker,
    env,
    "/api/invitations/targeted-invite/decline",
    "discord:333",
    { method: "POST" },
  );
  assert.equal(outsiderDecline.status, 403);

  const declinedResponse = await authenticatedFetch(
    worker,
    env,
    "/api/invitations/targeted-invite/decline",
    "discord:222",
    { method: "POST" },
  );
  assert.equal(declinedResponse.status, 200);
  assert.equal((await declinedResponse.json() as any).invitation.status, "declined");

  for (const playerId of ["discord:111", "discord:222"]) {
    const feedResponse = await authenticatedFetch(worker, env, "/api/me/feed", playerId);
    assert.equal(feedResponse.status, 200);
    const invitation = invitationFromFeed(await feedResponse.json(), "targeted-invite");
    assert.equal(invitation.status, "cancelled");
  }

  const viewAsInviter = await authenticatedFetch(worker, env, "/api/invitations/targeted-invite", "discord:111");
  assert.equal(viewAsInviter.status, 200);
  assert.equal((await viewAsInviter.json() as any).invitation.status, "declined");

  const claimAfterDecline = await authenticatedFetch(worker, env, "/api/invitations/claim", "discord:222", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  assert.equal(claimAfterDecline.status, 409);
  assert.equal((await claimAfterDecline.json() as any).error, "invitation_declined");
});

test("sender cancellation remains tied to the authenticated inviter", async () => {
  const env: GameFrameWorkerEnv = { SESSION_SECRET: secret, MATCHES: new HybridNamespace() };
  const worker = createGameFrameWorker({ idGenerator: sequenceGenerator(["cancelled-invite"]) });
  const cancellable = await authenticatedFetch(worker, env, "/api/invitations", "discord:111", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ gameId: "tic-tac-toe" }),
  }).then((response) => response.json() as Promise<any>);

  const cancelByOutsider = await authenticatedFetch(
    worker,
    env,
    `/api/invitations/${cancellable.invitation.invitationId}/cancel`,
    "discord:222",
    { method: "POST" },
  );
  assert.equal(cancelByOutsider.status, 403);

  const cancelled = await authenticatedFetch(
    worker,
    env,
    `/api/invitations/${cancellable.invitation.invitationId}/cancel`,
    "discord:111",
    { method: "POST" },
  );
  assert.equal(cancelled.status, 200);
  assert.equal((await cancelled.json() as any).invitation.status, "cancelled");
  const cancelledToken = new URL(cancellable.inviteUrl).searchParams.get("token");
  const claimCancelled = await authenticatedFetch(worker, env, "/api/invitations/claim", "discord:222", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: cancelledToken }),
  });
  assert.equal(claimCancelled.status, 409);
  assert.equal((await claimCancelled.json() as any).error, "invitation_cancelled");
});

test("legacy Discord target input remains supported", async () => {
  const env: GameFrameWorkerEnv = { SESSION_SECRET: secret, MATCHES: new HybridNamespace() };
  const worker = createGameFrameWorker({ idGenerator: sequenceGenerator(["legacy-target"]) });
  const created = await authenticatedFetch(worker, env, "/api/invitations", "discord:111", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ gameId: "tic-tac-toe", targetDiscordUserId: "222" }),
  });
  assert.equal(created.status, 201);
  assert.equal((await created.json() as any).invitation.targetPlayerId, "discord:222");
});

test("tampered invitation tokens are rejected before a seat or match is created", async () => {
  const env: GameFrameWorkerEnv = { SESSION_SECRET: secret, MATCHES: new HybridNamespace() };
  const worker = createGameFrameWorker({ idGenerator: sequenceGenerator(["invite-tamper"]) });
  const created = await authenticatedFetch(worker, env, "/api/invitations", "discord:111", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ gameId: "tic-tac-toe" }),
  }).then((response) => response.json() as Promise<any>);
  const token = new URL(created.inviteUrl).searchParams.get("token") as string;
  const [payload, signature] = token.split(".");
  const tamperedPayload = `${payload[0] === "A" ? "B" : "A"}${payload.slice(1)}`;
  const response = await authenticatedFetch(worker, env, "/api/invitations/claim", "discord:222", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: `${tamperedPayload}.${signature}` }),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json() as any).error, "invitation_invalid");
});
