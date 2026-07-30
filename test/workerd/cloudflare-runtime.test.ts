import { env, exports as workerExports } from "cloudflare:workers";
import { evictDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { SignedSessionCodec } from "../../src/auth/signed-session.ts";

const sessionSecret = "gf0002-workerd-session-secret-0123456789abcdef";
const sessionCodec = new SignedSessionCodec(sessionSecret);

interface TicTacToeMatchView {
  gameId: "tic-tac-toe";
  matchId: string;
  revision: number;
  playerIds: string[];
  observation: {
    board: Array<"X" | "O" | null>;
    nextPlayerId: string | null;
  };
}

interface CheckersAction {
  type: "move";
  pieceId: string;
  from: number;
  path: number[];
  capturedPieceIds: string[];
}

interface CheckersMatchView {
  gameId: "american-checkers";
  matchId: string;
  revision: number;
  playerIds: string[];
  observation: {
    board: Array<{ id: string; color: "black" | "red"; rank: "man" | "king" } | null>;
    activePlayerId: string | null;
    legalActions: CheckersAction[];
  };
}

interface TacticalMoveAction {
  type: "move";
  unitId: string;
  from: { x: number; y: number };
  path: Array<{ x: number; y: number }>;
  movementCost: number;
}

interface TacticalMatchView {
  gameId: "tactical-movement-canary";
  matchId: string;
  revision: number;
  playerIds: string[];
  observation: {
    board: {
      map: { width: number; height: number; cells: unknown[] };
      units: Array<{ id: string; ownerId: string; position: { x: number; y: number } }>;
    };
    activePlayerId: string | null;
    activeUnitId: string | null;
    legalActions: TacticalMoveAction[];
  };
}

type PublicMatchView = TicTacToeMatchView | CheckersMatchView | TacticalMatchView;

interface MatchStateMessage {
  type: "match_state";
  reason: "initial" | "update" | "refresh";
  view: PublicMatchView;
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

async function createMatch(
  playerIds: [string, string],
  gameId: "tic-tac-toe" | "american-checkers" | "tactical-movement-canary" = "tic-tac-toe",
): Promise<PublicMatchView> {
  const response = await workerFetch("/api/matches", playerIds[0], {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ gameId, playerIds }),
  });
  expect(response.status).toBe(201);
  return response.json() as Promise<PublicMatchView>;
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

describe("GameFrame real workerd runtime", () => {
  it("advertises every supported deterministic game", async () => {
    const response = await workerExports.default.fetch(new Request("https://games.example/api/health"));
    expect(response.status).toBe(200);
    const health = await response.json() as { games: string[] };
    expect(health.games).toEqual([
      "tic-tac-toe",
      "american-checkers",
      "tactical-movement-canary",
    ]);
  });

  it("restores committed tic-tac-toe state after Durable Object eviction", async () => {
    const created = await createMatch(["human", "theo"]) as TicTacToeMatchView;
    expect(created.gameId).toBe("tic-tac-toe");

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
    const advanced = await actionResponse.json() as TicTacToeMatchView;
    expect(advanced.revision).toBe(2);
    expect(advanced.observation.board[0]).toBe("X");
    expect(advanced.observation.board[4]).toBe("O");

    await evictDurableObject(matchStub(created.matchId));

    const restoredResponse = await workerFetch(
      `/api/matches/${encodeURIComponent(created.matchId)}`,
      "human",
    );
    expect(restoredResponse.status).toBe(200);
    const restored = await restoredResponse.json() as TicTacToeMatchView;
    expect(restored.revision).toBe(advanced.revision);
    expect(restored.observation.board).toEqual(advanced.observation.board);
  });

  it("restores committed Checkers state after Durable Object eviction", async () => {
    const created = await createMatch(
      ["checkers-human", "theo"],
      "american-checkers",
    ) as CheckersMatchView;
    expect(created.gameId).toBe("american-checkers");
    expect(created.observation.legalActions).toHaveLength(7);

    const actionResponse = await workerFetch(
      `/api/matches/${encodeURIComponent(created.matchId)}/actions`,
      "checkers-human",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actionId: "workerd-checkers-human-1",
          expectedRevision: 0,
          action: created.observation.legalActions[0],
        }),
      },
    );
    expect(actionResponse.status).toBe(200);
    const advanced = await actionResponse.json() as CheckersMatchView;
    expect(advanced.gameId).toBe("american-checkers");
    expect(advanced.revision).toBe(2);
    expect(advanced.observation.activePlayerId).toBe("checkers-human");

    await evictDurableObject(matchStub(created.matchId));

    const restoredResponse = await workerFetch(
      `/api/matches/${encodeURIComponent(created.matchId)}`,
      "checkers-human",
    );
    expect(restoredResponse.status).toBe(200);
    const restored = await restoredResponse.json() as CheckersMatchView;
    expect(restored.gameId).toBe("american-checkers");
    expect(restored.revision).toBe(advanced.revision);
    expect(restored.observation.board).toEqual(advanced.observation.board);
    expect(restored.observation.legalActions).toEqual(advanced.observation.legalActions);
  });

  it("restores tactical state and canonical paths after Durable Object eviction", async () => {
    const created = await createMatch(
      ["tactical-human", "theo"],
      "tactical-movement-canary",
    ) as TacticalMatchView;
    expect(created.gameId).toBe("tactical-movement-canary");
    expect(created.observation.board.map.width).toBe(24);
    expect(created.observation.board.map.height).toBe(24);
    expect(created.observation.legalActions.length).toBeGreaterThan(0);

    const action = created.observation.legalActions[0];
    expect(action.path.length).toBeGreaterThan(0);
    const actionResponse = await workerFetch(
      `/api/matches/${encodeURIComponent(created.matchId)}/actions`,
      "tactical-human",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actionId: "workerd-tactical-human-1",
          expectedRevision: 0,
          action,
        }),
      },
    );
    expect(actionResponse.status).toBe(200);
    const advanced = await actionResponse.json() as TacticalMatchView;
    expect(advanced.revision).toBe(2);
    expect(advanced.observation.activePlayerId).toBe("tactical-human");

    await evictDurableObject(matchStub(created.matchId));

    const restoredResponse = await workerFetch(
      `/api/matches/${encodeURIComponent(created.matchId)}`,
      "tactical-human",
    );
    expect(restoredResponse.status).toBe(200);
    const restored = await restoredResponse.json() as TacticalMatchView;
    expect(restored.gameId).toBe("tactical-movement-canary");
    expect(restored.revision).toBe(advanced.revision);
    expect(restored.observation.board).toEqual(advanced.observation.board);
    expect(restored.observation.legalActions).toEqual(advanced.observation.legalActions);
  });

  it("serializes competing writes inside the real Durable Object runtime", async () => {
    const created = await createMatch(["alice", "bob"]) as TicTacToeMatchView;
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
    const created = await createMatch(["socket-human", "theo"]) as TicTacToeMatchView;
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
