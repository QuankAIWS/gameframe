import assert from "node:assert/strict";
import test from "node:test";
import { DevelopmentHeaderAuthenticator } from "../auth/request-authenticator.ts";
import type {
  DurableObjectNamespaceLike,
  DurableObjectStubLike,
  GameFrameWorkerEnv,
} from "./runtime-contracts.ts";
import { createGameFrameWorker } from "./worker-router.ts";

function authenticatedRequest(path: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("x-gameframe-player-id", "discord:reader");
  return new Request(`https://games.example${path}`, { ...init, headers });
}

class CapturingNamespace implements DurableObjectNamespaceLike {
  readonly calls: Array<{ objectName: string; method: string; pathname: string; upgrade: string | null }> = [];

  idFromName(name: string): unknown { return name; }

  get(id: unknown): DurableObjectStubLike {
    const objectName = String(id);
    return {
      fetch: async (request) => {
        const url = new URL(request.url);
        this.calls.push({
          objectName,
          method: request.method,
          pathname: url.pathname,
          upgrade: request.headers.get("Upgrade"),
        });
        if (url.pathname === "/player/feed") {
          return Response.json({ matches: [], invitations: [], favoriteGameIds: [], themeId: "standard" });
        }
        if (url.pathname === "/directory/list") return Response.json({ players: [] });
        if (url.pathname === "/directory/upsert") return Response.json({ playerId: "discord:reader" });
        if (url.pathname === "/player/events") return Response.json({ forwarded: true });
        return Response.json({});
      },
    };
  }
}

function environment(namespace: DurableObjectNamespaceLike): GameFrameWorkerEnv {
  return {
    MATCHES: namespace,
    ASSETS: { fetch: async () => new Response("asset") },
  };
}

function worker() {
  return createGameFrameWorker({ authenticator: new DevelopmentHeaderAuthenticator() });
}

test("feed and player-directory reads do not perform presence or projection writes", async () => {
  const namespace = new CapturingNamespace();
  const env = environment(namespace);

  const feed = await worker().fetch(authenticatedRequest("/api/me/feed"), env);
  assert.equal(feed.status, 200);
  assert.deepEqual(namespace.calls, [{
    objectName: "player:discord:reader",
    method: "GET",
    pathname: "/player/feed",
    upgrade: null,
  }]);

  namespace.calls.length = 0;
  const players = await worker().fetch(authenticatedRequest("/api/players"), env);
  assert.equal(players.status, 200);
  assert.deepEqual(namespace.calls, [{
    objectName: "directory:players",
    method: "GET",
    pathname: "/directory/list",
    upgrade: null,
  }]);
});

test("session establishment is the explicit presence-touch boundary", async () => {
  const namespace = new CapturingNamespace();
  const response = await worker().fetch(authenticatedRequest("/api/session"), environment(namespace));
  assert.equal(response.status, 200);
  assert.deepEqual(namespace.calls, [{
    objectName: "directory:players",
    method: "POST",
    pathname: "/directory/upsert",
    upgrade: null,
  }]);
});

test("authenticated player event upgrades route directly to the player's durable object", async () => {
  const namespace = new CapturingNamespace();
  const response = await worker().fetch(authenticatedRequest("/api/me/events", {
    headers: { Upgrade: "websocket" },
  }), environment(namespace));

  assert.equal(response.status, 200);
  assert.deepEqual(namespace.calls, [{
    objectName: "player:discord:reader",
    method: "GET",
    pathname: "/player/events",
    upgrade: "websocket",
  }]);
});
