import assert from "node:assert/strict";
import test from "node:test";
import { MockDecisionProvider } from "../agents/mock-decision-provider.ts";
import { ProviderBackedAgentPlayer } from "../agents/provider-backed-agent.ts";
import {
  checkersDefinition,
  type CheckersAction,
  type CheckersObservation,
  type CheckersState,
} from "../games/checkers/index.ts";
import { InMemoryMatchSnapshotStore } from "../platform/match-store.ts";
import { CheckersMatchService } from "./checkers-match-service.ts";

function service(options: {
  theo?: ProviderBackedAgentPlayer<CheckersAction, CheckersObservation>;
  ids?: string[];
} = {}) {
  const ids = [...(options.ids ?? ["generated-1", "generated-2", "generated-3"])];
  return new CheckersMatchService({
    store: new InMemoryMatchSnapshotStore<CheckersState, CheckersAction>(),
    idGenerator: () => ids.shift() ?? crypto.randomUUID(),
    ...(options.theo ? { theo: options.theo } : {}),
  });
}

test("authoritative Checkers service advances a two-human match and restores replay", async () => {
  const matches = service();
  const created = await matches.createMatch(["alice", "bob"], "checkers-human");
  assert.equal(created.matchId, "checkers-human");
  assert.equal(created.revision, 0);
  assert.equal(created.observation.yourColor, "black");
  assert.equal(created.observation.activePlayerId, "alice");
  assert.equal(created.observation.legalActions.length, 7);

  const action = created.observation.legalActions[0];
  const afterAlice = await matches.submitAction({
    matchId: created.matchId,
    playerId: "alice",
    actionId: "alice-checkers-1",
    expectedRevision: 0,
    action,
  });
  assert.equal(afterAlice.revision, 1);
  assert.equal(afterAlice.observation.activePlayerId, "bob");
  assert.equal(afterAlice.eventCount, 1);

  const bobView = await matches.view(created.matchId, "bob");
  assert.equal(bobView.observation.yourColor, "red");
  assert.ok(bobView.observation.legalActions.length > 0);
  assert.deepEqual(await matches.replay(created.matchId), (await matches.snapshot(created.matchId)).state);
});

test("deterministic Theo answers a human Checkers move through the authoritative service", async () => {
  const matches = service({ ids: ["theo-action-id"] });
  const created = await matches.createMatch(["human", "theo"], "checkers-theo");
  assert.equal(created.revision, 0);

  const updated = await matches.submitAction({
    matchId: created.matchId,
    playerId: "human",
    actionId: "human-checkers-1",
    expectedRevision: 0,
    action: created.observation.legalActions[0],
  });
  assert.equal(updated.revision, 2);
  assert.equal(updated.eventCount, 2);
  assert.equal(updated.observation.activePlayerId, "human");

  const snapshot = await matches.snapshot(created.matchId);
  assert.equal(snapshot.events[0].playerId, "human");
  assert.equal(snapshot.events[1].playerId, "theo");
  assert.equal(snapshot.events[1].actionId, "theo:theo-action-id");
});

test("provider-backed Theo uses the versioned Checkers decision contract", async () => {
  const provider = new MockDecisionProvider<CheckersAction, CheckersObservation>({
    mode: "deterministic",
    commentary: "Taking the first legal Checkers action.",
  });
  const theo = new ProviderBackedAgentPlayer<CheckersAction, CheckersObservation>({
    agentId: "theo",
    gameId: checkersDefinition.gameId,
    provider,
    isSameAction: checkersDefinition.isSameAction.bind(checkersDefinition),
    requestIdGenerator: () => "checkers-request-1",
  });
  const matches = service({ theo });
  const created = await matches.createMatch(["human", "theo"], "checkers-provider");

  const updated = await matches.submitAction({
    matchId: created.matchId,
    playerId: "human",
    actionId: "human-provider-1",
    expectedRevision: 0,
    action: created.observation.legalActions[0],
  });
  assert.equal(updated.revision, 2);
  assert.equal(provider.requests.length, 1);
  assert.equal(provider.requests[0].protocolVersion, "1");
  assert.equal(provider.requests[0].requestId, "checkers-request-1");
  assert.equal(provider.requests[0].gameId, "american-checkers");
  assert.equal(provider.requests[0].matchId, "checkers-provider");
  assert.equal(provider.requests[0].playerId, "theo");
  assert.equal(provider.requests[0].expectedRevision, 1);
  assert.ok(provider.requests[0].legalActions.length > 0);

  const snapshot = await matches.snapshot(created.matchId);
  assert.equal(snapshot.events[1].actionId, "mock:1");
  assert.ok(checkersDefinition.isSameAction(
    snapshot.events[1].action,
    provider.requests[0].legalActions[0],
  ));
});

test("service rejects stale Checkers actions without advancing the match", async () => {
  const matches = service();
  const created = await matches.createMatch(["alice", "bob"], "checkers-stale");
  await assert.rejects(
    matches.submitAction({
      matchId: created.matchId,
      playerId: "alice",
      actionId: "stale-checkers-1",
      expectedRevision: 9,
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
