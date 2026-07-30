import { env, exports as workerExports } from "cloudflare:workers";
import { evictDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { SignedSessionCodec } from "../../src/auth/signed-session.ts";
import type {
  TacticalCombatAction,
  TacticalCombatObservation,
} from "../../src/games/tactical-combat/index.ts";

const sessionCodec = new SignedSessionCodec("gf0002-workerd-session-secret-0123456789abcdef");

interface TacticalCombatMatchView {
  gameId: "tactical-combat-canary";
  matchId: string;
  revision: number;
  playerIds: string[];
  eventCount: number;
  observation: TacticalCombatObservation;
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

function matchStub(matchId: string): any {
  const matches = (env as any).MATCHES;
  return matches.get(matches.idFromName(matchId));
}

async function createCombatMatch(playerIds: [string, string]): Promise<TacticalCombatMatchView> {
  const response = await workerFetch("/api/matches", playerIds[0], {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ gameId: "tactical-combat-canary", playerIds }),
  });
  expect(response.status).toBe(201);
  return response.json() as Promise<TacticalCombatMatchView>;
}

function actionOfType<Type extends TacticalCombatAction["type"]>(
  view: TacticalCombatMatchView,
  type: Type,
): Extract<TacticalCombatAction, { type: Type }> {
  const action = view.observation.legalActions.find((candidate) => candidate.type === type);
  expect(action).toBeDefined();
  return action as Extract<TacticalCombatAction, { type: Type }>;
}

describe("tactical combat in the real workerd runtime", () => {
  it("persists a human combat activation through Durable Object eviction", async () => {
    const created = await createCombatMatch(["alpha", "beta"]);
    expect(created.gameId).toBe("tactical-combat-canary");
    expect(created.revision).toBe(0);
    expect(created.observation.board.units).toHaveLength(4);
    expect(created.observation.activeUnitId).toBe("alpha-vanguard");

    const endActivation = actionOfType(created, "end-activation");
    const actionResponse = await workerFetch(
      `/api/matches/${encodeURIComponent(created.matchId)}/actions`,
      "alpha",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actionId: "workerd-combat-alpha-end",
          expectedRevision: 0,
          action: endActivation,
        }),
      },
    );
    expect(actionResponse.status).toBe(200);
    const advanced = await actionResponse.json() as TacticalCombatMatchView;
    expect(advanced.revision).toBe(1);
    expect(advanced.observation.activePlayerId).toBe("beta");
    expect(advanced.observation.activeUnitId).toBe("beta-vanguard");

    await evictDurableObject(matchStub(created.matchId));

    const restoredResponse = await workerFetch(
      `/api/matches/${encodeURIComponent(created.matchId)}`,
      "alpha",
    );
    expect(restoredResponse.status).toBe(200);
    const restored = await restoredResponse.json() as TacticalCombatMatchView;
    expect(restored.revision).toBe(advanced.revision);
    expect(restored.observation.board).toEqual(advanced.observation.board);
    expect(restored.observation.legalActions).toEqual(advanced.observation.legalActions);

    const betaView = await workerFetch(
      `/api/matches/${encodeURIComponent(created.matchId)}`,
      "beta",
    ).then((response) => response.json() as Promise<TacticalCombatMatchView>);
    expect(betaView.observation.legalActions.length).toBeGreaterThan(0);
  });

  it("commits Theo's complete multi-action activation before persistence", async () => {
    const created = await createCombatMatch(["human", "theo"]);
    const endActivation = actionOfType(created, "end-activation");
    const response = await workerFetch(
      `/api/matches/${encodeURIComponent(created.matchId)}/actions`,
      "human",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actionId: "workerd-combat-human-end",
          expectedRevision: 0,
          action: endActivation,
        }),
      },
    );
    expect(response.status).toBe(200);
    const advanced = await response.json() as TacticalCombatMatchView;
    expect(advanced.revision).toBe(3);
    expect(advanced.eventCount).toBe(3);
    expect(advanced.observation.activePlayerId).toBe("human");
    expect(advanced.observation.activeUnitId).toBe("alpha-ranger");

    await evictDurableObject(matchStub(created.matchId));
    const restored = await workerFetch(
      `/api/matches/${encodeURIComponent(created.matchId)}`,
      "human",
    ).then((result) => result.json() as Promise<TacticalCombatMatchView>);
    expect(restored.revision).toBe(advanced.revision);
    expect(restored.observation.board).toEqual(advanced.observation.board);
  });
});
