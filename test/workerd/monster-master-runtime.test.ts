import { env, exports as workerExports } from "cloudflare:workers";
import { evictDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { GAMEFRAME_BOT_PLAYER_ID } from "../../src/agents/gameframe-bot.ts";
import { SignedSessionCodec } from "../../src/auth/signed-session.ts";
import type { MonsterMasterAction, MonsterMasterObservation } from "../../src/games/monster-master/index.ts";

const sessionCodec = new SignedSessionCodec("gf0002-workerd-session-secret-0123456789abcdef");

interface MonsterMasterMatchView {
  gameId: "monster-master-duel";
  matchId: string;
  revision: number;
  playerIds: string[];
  eventCount: number;
  observation: MonsterMasterObservation;
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

async function createMatch(playerIds: [string, string]): Promise<MonsterMasterMatchView> {
  const response = await workerFetch("/api/matches", playerIds[0], {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ gameId: "monster-master-duel", playerIds }),
  });
  expect(response.status).toBe(201);
  return response.json() as Promise<MonsterMasterMatchView>;
}

function actionOfType<Type extends MonsterMasterAction["type"]>(
  view: MonsterMasterMatchView,
  type: Type,
): Extract<MonsterMasterAction, { type: Type }> {
  const action = view.observation.legalActions.find((candidate) => candidate.type === type);
  expect(action).toBeDefined();
  return action as Extract<MonsterMasterAction, { type: Type }>;
}

async function submit(
  view: MonsterMasterMatchView,
  playerId: string,
  action: MonsterMasterAction,
  actionId: string,
): Promise<MonsterMasterMatchView> {
  const response = await workerFetch(
    `/api/matches/${encodeURIComponent(view.matchId)}/actions`,
    playerId,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actionId,
        expectedRevision: view.revision,
        action,
      }),
    },
  );
  expect(response.status).toBe(200);
  return response.json() as Promise<MonsterMasterMatchView>;
}

describe("Monster Master in the real workerd runtime", () => {
  it("persists alternating deployment and player projections through eviction", async () => {
    let view = await createMatch(["human", GAMEFRAME_BOT_PLAYER_ID]);
    expect(view.observation.phase).toBe("deployment");
    expect(view.observation.board.units).toHaveLength(0);

    view = await submit(
      view,
      "human",
      actionOfType(view, "deploy-unit"),
      "workerd-mm-human-deploy-1",
    );
    expect(view.revision).toBe(2);
    expect(view.eventCount).toBe(2);
    expect(view.observation.board.units).toHaveLength(2);
    expect(view.observation.activePlayerId).toBe("human");

    await evictDurableObject(matchStub(view.matchId));

    const restored = await workerFetch(
      `/api/matches/${encodeURIComponent(view.matchId)}`,
      "human",
    ).then((response) => response.json() as Promise<MonsterMasterMatchView>);
    expect(restored.revision).toBe(view.revision);
    expect(restored.observation.board).toEqual(view.observation.board);
    expect(restored.observation.undeployedUnitIds).toEqual(view.observation.undeployedUnitIds);
    expect(restored.observation.legalActions).toEqual(view.observation.legalActions);

    const botView = await workerFetch(
      `/api/matches/${encodeURIComponent(view.matchId)}`,
      GAMEFRAME_BOT_PLAYER_ID,
    ).then((response) => response.json() as Promise<MonsterMasterMatchView>);
    expect(botView.observation.activePlayerId).toBe("human");
    expect(botView.observation.legalActions).toHaveLength(0);
  });

  it("persists the completed deployment transition and Monster Master BattleBot combat activation", async () => {
    let view = await createMatch(["human", GAMEFRAME_BOT_PLAYER_ID]);
    for (let deployment = 0; deployment < 3; deployment += 1) {
      view = await submit(
        view,
        "human",
        actionOfType(view, "deploy-unit"),
        `workerd-mm-human-deploy-${deployment + 1}`,
      );
    }
    expect(view.revision).toBe(6);
    expect(view.observation.phase).toBe("combat");
    expect(view.observation.activeUnitId).toBe("alpha-emberling");

    view = await submit(
      view,
      "human",
      actionOfType(view, "end-activation"),
      "workerd-mm-human-end-emberling",
    );
    expect(view.revision).toBe(9);
    expect(view.observation.activePlayerId).toBe("human");
    expect(view.observation.activeUnitId).toBe("alpha-master");

    await evictDurableObject(matchStub(view.matchId));
    const restored = await workerFetch(
      `/api/matches/${encodeURIComponent(view.matchId)}`,
      "human",
    ).then((response) => response.json() as Promise<MonsterMasterMatchView>);
    expect(restored.revision).toBe(view.revision);
    expect(restored.observation.phase).toBe("combat");
    expect(restored.observation.board).toEqual(view.observation.board);
    expect(restored.observation.commandByPlayer).toEqual(view.observation.commandByPlayer);
  });
});
