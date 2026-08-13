import assert from "node:assert/strict";
import test from "node:test";
import { SignedSessionCodec } from "../auth/signed-session.ts";
import type { ChallengeNotificationInput } from "./challenge-notification-port.ts";
import { InvitationObjectRuntime } from "./invitation-object-runtime.ts";
import { GameFrameMatchObjectRuntime } from "./match-object-runtime.ts";
import { createNotifyingGameFrameWorker } from "./notifying-gameframe-worker.ts";
import { PlayerPlatformObjectRuntime } from "./player-platform-object-runtime.ts";
import type {
  DurableObjectNamespaceLike,
  DurableObjectStubLike,
  DurableStorageLike,
  GameFrameWorkerEnv,
} from "./runtime-contracts.ts";

const secret = "0123456789abcdef0123456789abcdef";

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

async function cookieFor(playerId: string): Promise<string> {
  const codec = new SignedSessionCodec(secret);
  const token = await codec.issue({ playerId, source: "discord", displayName: "Inviter" });
  return `gameframe_session=${token}`;
}

test("targeted challenge remains durable when notification provider throws", async () => {
  const observed: ChallengeNotificationInput[] = [];
  const worker = createNotifyingGameFrameWorker(async (_env, input) => {
    observed.push(input);
    throw new Error("provider unavailable");
  });
  const env: GameFrameWorkerEnv = {
    SESSION_SECRET: secret,
    MATCHES: new HybridNamespace(),
  };
  const response = await worker.fetch(new Request("https://gameframe.cc/api/invitations", {
    method: "POST",
    headers: {
      cookie: await cookieFor("discord:111"),
      "content-type": "application/json",
    },
    body: JSON.stringify({ gameId: "american-checkers", targetPlayerId: "discord:222" }),
  }), env);

  assert.equal(response.status, 201);
  const created = await response.json() as any;
  assert.equal(created.invitation.status, "pending");
  assert.equal(created.invitation.targetPlayerId, "discord:222");
  assert.equal(observed.length, 1);
  assert.equal(observed[0].origin, "https://gameframe.cc");
  assert.equal(observed[0].invitation.invitationId, created.invitation.invitationId);

  const recipientFeed = await worker.fetch(new Request("https://gameframe.cc/api/me/feed", {
    headers: { cookie: await cookieFor("discord:222") },
  }), env);
  assert.equal(recipientFeed.status, 200);
  const feed = await recipientFeed.json() as any;
  const invitation = feed.invitations.find((entry: any) => entry.invitationId === created.invitation.invitationId);
  assert.equal(invitation.status, "pending");
  assert.equal(typeof invitation.claimToken, "string");
  assert.ok(invitation.claimToken.length > 0);
});

test("shareable challenge does not invoke targeted notification provider", async () => {
  let calls = 0;
  const worker = createNotifyingGameFrameWorker(async () => {
    calls += 1;
    return true;
  });
  const env: GameFrameWorkerEnv = { SESSION_SECRET: secret, MATCHES: new HybridNamespace() };
  const response = await worker.fetch(new Request("https://gameframe.cc/api/invitations", {
    method: "POST",
    headers: {
      cookie: await cookieFor("discord:111"),
      "content-type": "application/json",
    },
    body: JSON.stringify({ gameId: "tic-tac-toe" }),
  }), env);
  assert.equal(response.status, 201);
  assert.equal(calls, 0);
});
