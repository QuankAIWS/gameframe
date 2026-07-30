import assert from "node:assert/strict";
import test from "node:test";
import { MockDecisionProvider } from "../agents/mock-decision-provider.ts";
import { ProviderBackedAgentPlayer } from "../agents/provider-backed-agent.ts";
import {
  tacticalMovementDefinition,
  type TacticalMovementAction,
  type TacticalMovementObservation,
  type TacticalMovementState,
} from "../games/tactical-core/index.ts";
import { InMemoryMatchSnapshotStore } from "../platform/match-store.ts";
import { TacticalMovementMatchService } from "./tactical-movement-match-service.ts";

function service(options: {
  theo?: ProviderBackedAgentPlayer<TacticalMovementAction, TacticalMovementObservation>;
  ids?: string[];
} = {}) {
  const ids = [...(options.ids ?? ["generated-1", "generated-2", "generated-3"])];
  return new TacticalMovementMatchService({
    store: new InMemoryMatchSnapshotStore<TacticalMovementState, TacticalMovementAction>(),
    idGenerator: () => ids.shift() ?? crypto.randomUUID(),
    ...(options.theo ? { theo: options.theo } : {}),
  });
}

test("authoritative tactical movement service advances and restores a two-human match", async () => {
  const matches = service();
  const created = await matches.createMatch(["alice", "bob"], "tactical-human");
  assert.equal(created.revision, 0);
  assert.equal(created.observation.board.map.width, 24);
  assert.equal(created.observation.board.map.height, 24);
  assert.equal(created.observation.activePlayerId, "alice");
  assert.equal(created.observation.activeUnitId, "unit-alpha");
  assert.ok(created.observation.legalActions.length > 0);

  const action = created.observation.legalActions[0];
  const afterAlice = await matches.submitAction({
    matchId: created.matchId,
    playerId: "alice",
    actionId: "alice-tactical-1",
    expectedRevision: 0,
    action,
  });
  assert.equal(afterAlice.revision, 1);
  assert.equal(afterAlice.eventCount, 1);
  assert.equal(afterAlice.observation.activePlayerId, "bob");
  assert.deepEqual(await matches.replay(created.matchId), (await matches.snapshot(created.matchId)).state);
});

test("deterministic Theo answers one tactical movement action", async () => {
  const matches = service({ ids: ["theo-tactical-id"] });
  const created = await matches.createMatch(["human", "theo"], "tactical-theo");
  const updated = await matches.submitAction({
    matchId: created.matchId,
    playerId: "human",
    actionId: "human-tactical-1",
    expectedRevision: 0,
    action: created.observation.legalActions[0],
  });
  assert.equal(updated.revision, 2);
  assert.equal(updated.eventCount, 2);
  assert.equal(updated.observation.activePlayerId, "human");
  const snapshot = await matches.snapshot(created.matchId);
  assert.equal(snapshot.events[1].playerId, "theo");
  assert.equal(snapshot.events[1].actionId, "theo:theo-tactical-id");
});

test("provider-backed Theo receives tactical map, path, and revision context", async () => {
  const provider = new MockDecisionProvider<TacticalMovementAction, TacticalMovementObservation>({
    mode: "deterministic",
  });
  const theo = new ProviderBackedAgentPlayer<TacticalMovementAction, TacticalMovementObservation>({
    agentId: "theo",
    gameId: tacticalMovementDefinition.gameId,
    provider,
    isSameAction: tacticalMovementDefinition.isSameAction.bind(tacticalMovementDefinition),
    requestIdGenerator: () => "tactical-request-1",
  });
  const matches = service({ theo });
  const created = await matches.createMatch(["human", "theo"], "tactical-provider");
  const updated = await matches.submitAction({
    matchId: created.matchId,
    playerId: "human",
    actionId: "human-provider-1",
    expectedRevision: 0,
    action: created.observation.legalActions[0],
  });

  assert.equal(updated.revision, 2);
  assert.equal(provider.requests.length, 1);
  assert.equal(provider.requests[0].gameId, "tactical-movement-canary");
  assert.equal(provider.requests[0].matchId, "tactical-provider");
  assert.equal(provider.requests[0].playerId, "theo");
  assert.equal(provider.requests[0].expectedRevision, 1);
  assert.equal(provider.requests[0].observation.board.map.width, 24);
  assert.ok(provider.requests[0].legalActions.some((action) => action.type === "move"));
  const move = provider.requests[0].legalActions.find((action) => action.type === "move");
  assert.ok(move && move.path.length > 0);
});

test("stale tactical movement actions fail without mutating state", async () => {
  const matches = service();
  const created = await matches.createMatch(["alice", "bob"], "tactical-stale");
  await assert.rejects(
    matches.submitAction({
      matchId: created.matchId,
      playerId: "alice",
      actionId: "stale-tactical-1",
      expectedRevision: 3,
      action: created.observation.legalActions[0],
    }),
    (error: Error & { code?: string; revision?: number }) => {
      assert.equal(error.code, "stale_revision");
      assert.equal(error.revision, 0);
      return true;
    },
  );
  assert.equal((await matches.view(created.matchId, "alice")).revision, 0);
});
