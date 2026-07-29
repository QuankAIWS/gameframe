import { env, exports as workerExports } from "cloudflare:workers";
import { evictDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { SignedSessionCodec } from "../../src/auth/signed-session.ts";

const sessionSecret = "gf0002-workerd-session-secret-0123456789abcdef";
const sessionCodec = new SignedSessionCodec(sessionSecret);

interface MatchView {
  matchId: string;
  revision: number;
  playerIds: string[];
  observation: {
    board: Array<"X" | "O" | null>;
    nextPlayerId: string | null;
  };
}

interface MatchStateMessage {
  type: "match_state";
  reason: "initial" | "update" | "refresh";
  view: MatchView;
}

async function cookieFor(playerId: string): Promise<string> {
  const token = await sessionCodec.issue({ playerId, source: "development" });
  return `gameframe_session=${token}`;
}

async function workerFetch(
  path: string,
  playerId: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("cookie", await cookieFor(playerId));
  return workerExports.default.fetch(new Request(`https://games.example${path}`, {
    ...init,
    headers,
  }));
}

async function createMatch(playerIds: [string, string]): Promise<MatchView> {
  const response = await workerFetch("/api/matches", playerIds[0], {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerIds }),
  });
  expect(response.status).toBe(201);
  return response.json() as Promise<MatchView>;
}

function decodeSocketData(data: string | ArrayBuffer): string {
  return typeof data === "string" ? data : new TextDecoder().decode(data);
}

function nextSocketMessage(socket: WebSocket): Promise<MatchStateMessage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.removeEventListener("message", onMessage);
      reject(new Error("Timed out waiting for a WebSocket match-state message."));
    }, 5_000);

    function onMessage(event: MessageEvent<string | ArrayBuffer>): void {
      clearTimeout(timeout);
      socket.removeEventListener("message", onMessage);
      try {
        resolve(JSON.parse(decodeSocketData(event.data)) as MatchStateMessage);
      } catch (error) {
        reject(error);
      }
    }

    socket.addEventListener("message", onMessage);
  });
}

function matchStub(matchId: string): any {
  const matches = (env as any).MATCHES;
  return matches.get(matches.idFromName(matchId));
}

describe("GF-0002 real workerd runtime", () => {
  it("restores committed match state after Durable Object eviction", async () => {
    const created = await createMatch(["human", "theo"]);

    const actionResponse = await workerFetch(
      `/api/matches/${encodeURIComponent(created.matchId)}/actions`,
      "human",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actionId: "workerd-human-1",
          expectedRevision: 0,
          action: { type: "place", cell: 0 },
        }),
      },
    );
    expect(actionResponse.status).toBe(200);
    const advanced = await actionResponse.json() as MatchView;
    expect(advanced.revision).toBe(2);
    expect(advanced.observation.board[0]).toBe("X");
    expect(advanced.observation.board[4]).toBe("O");

    await evictDurableObject(matchStub(created.matchId));

    const restoredResponse = await workerFetch(
      `/api/matches/${encodeURIComponent(created.matchId)}`,
      "human",
    );
    expect(restoredResponse.status).toBe(200);
    const restored = await restoredResponse.json() as MatchView;
    expect(restored.revision).toBe(advanced.revision);
    expect(restored.observation.board).toEqual(advanced.observation.board);
  });

  it("serializes competing writes inside the real Durable Object runtime", async () => {
    const created = await createMatch(["alice", "bob"]);
    const path = `/api/matches/${encodeURIComponent(created.matchId)}/actions`;

    const submit = (actionId: string, cell: number) => workerFetch(path, "alice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actionId,
        expectedRevision: 0,
        action: { type: "place", cell },
      }),
    });

    const responses = await Promise.all([
      submit("workerd-race-1", 0),
      submit("workerd-race-2", 1),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
  });

  it("resumes a hibernatable WebSocket after Durable Object eviction", async () => {
    const created = await createMatch(["socket-human", "theo"]);
    const response = await workerFetch(
      `/api/matches/${encodeURIComponent(created.matchId)}/events`,
      "socket-human",
      {
        headers: {
          upgrade: "websocket",
          "sec-websocket-protocol": "gameframe-v1",
        },
      },
    );

    expect(response.status).toBe(101);
    const socket = response.webSocket;
    expect(socket).toBeDefined();
    if (!socket) throw new Error("Expected a WebSocket upgrade response.");
    socket.accept();

    const initial = await nextSocketMessage(socket);
    expect(initial.type).toBe("match_state");
    expect(initial.reason).toBe("initial");
    expect(initial.view.matchId).toBe(created.matchId);

    await evictDurableObject(matchStub(created.matchId));

    const refreshedMessage = nextSocketMessage(socket);
    socket.send(JSON.stringify({ type: "refresh" }));
    const refreshed = await refreshedMessage;
    expect(refreshed.type).toBe("match_state");
    expect(refreshed.reason).toBe("refresh");
    expect(refreshed.view.matchId).toBe(created.matchId);
    expect(refreshed.view.revision).toBe(created.revision);

    socket.close(1000, "test complete");
  });
});
