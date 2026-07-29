import assert from "node:assert/strict";
import test from "node:test";
import type { AgentDecisionContext, AgentPlayer } from "./agent-player.ts";
import { AgentDecisionError } from "./decision-protocol.ts";
import { MockDecisionProvider, type MockDecisionProviderMode } from "./mock-decision-provider.ts";
import { ProviderBackedAgentPlayer } from "./provider-backed-agent.ts";
import { ticTacToeDefinition, type TicTacToeAction, type TicTacToeObservation } from "../games/tic-tac-toe/index.ts";
import { InMemoryMatchSnapshotStore } from "../platform/match-store.ts";
import { TicTacToeMatchService } from "../server/tic-tac-toe-match-service.ts";
import type { TicTacToeState } from "../games/tic-tac-toe/index.ts";

interface TestAction {
  type: "pick";
  value: number;
}

interface TestObservation {
  label: string;
}

const legalActions: readonly TestAction[] = [
  { type: "pick", value: 1 },
  { type: "pick", value: 2 },
  { type: "pick", value: 3 },
];

function isSameAction(left: TestAction, right: TestAction): boolean {
  return left.type === right.type && left.value === right.value;
}

function context(overrides: Partial<AgentDecisionContext<TestAction, TestObservation>> = {}) {
  return {
    gameId: "test-game",
    matchId: "match-1",
    playerId: "theo",
    revision: 3,
    observation: { label: "test" },
    legalActions,
    ...overrides,
  } satisfies AgentDecisionContext<TestAction, TestObservation>;
}

function agentFor(
  provider: MockDecisionProvider<TestAction, TestObservation>,
  options: {
    timeoutMs?: number;
    fallback?: AgentPlayer<TestAction, TestObservation>;
  } = {},
) {
  let requestId = 0;
  let fallbackId = 0;
  return new ProviderBackedAgentPlayer<TestAction, TestObservation>({
    agentId: "theo",
    gameId: "test-game",
    provider,
    isSameAction,
    timeoutMs: options.timeoutMs,
    fallback: options.fallback,
    requestIdGenerator: () => `request-${++requestId}`,
    fallbackActionIdGenerator: () => `fallback-${++fallbackId}`,
    now: () => 1_700_000_000_000,
  });
}

function expectDecisionError(code: string) {
  return (error: unknown) => {
    assert.ok(error instanceof AgentDecisionError);
    assert.equal(error.code, code);
    return true;
  };
}

test("provider-backed agent sends a correlated versioned request and accepts a legal response", async () => {
  const provider = new MockDecisionProvider<TestAction, TestObservation>();
  const agent = agentFor(provider);

  const decision = await agent.chooseDecision(context());

  assert.deepEqual(decision.action, legalActions[0]);
  assert.equal(decision.actionId, "mock:1");
  assert.equal(provider.requests.length, 1);
  assert.deepEqual(provider.requests[0], {
    protocolVersion: "1",
    requestId: "request-1",
    gameId: "test-game",
    matchId: "match-1",
    playerId: "theo",
    expectedRevision: 3,
    observation: { label: "test" },
    legalActions,
    deadlineAt: "2023-11-14T22:13:25.000Z",
  });
});

test("scripted and seeded-random providers remain deterministic", async () => {
  const scripted = agentFor(new MockDecisionProvider({
    mode: "scripted",
    scriptedActions: [legalActions[2]!],
  }));
  assert.deepEqual((await scripted.chooseDecision(context())).action, legalActions[2]);

  const first = agentFor(new MockDecisionProvider({ mode: "seeded-random", seed: 77 }));
  const second = agentFor(new MockDecisionProvider({ mode: "seeded-random", seed: 77 }));
  assert.deepEqual(
    (await first.chooseDecision(context())).action,
    (await second.chooseDecision(context())).action,
  );
});

for (const [mode, code] of [
  ["unavailable", "provider_unavailable"],
  ["malformed", "invalid_action_id"],
  ["illegal", "illegal_action"],
  ["stale", "stale_revision"],
  ["mismatched-request", "request_mismatch"],
  ["mismatched-player", "player_mismatch"],
] as const satisfies readonly [MockDecisionProviderMode, string][]) {
  test(`provider mode ${mode} fails closed with ${code}`, async () => {
    const provider = new MockDecisionProvider<TestAction, TestObservation>({
      mode,
      illegalAction: { type: "pick", value: 99 },
    });
    await assert.rejects(agentFor(provider).chooseDecision(context()), expectDecisionError(code));
  });
}

test("provider timeout fails closed and does not accept a late response", async () => {
  const provider = new MockDecisionProvider<TestAction, TestObservation>({
    mode: "delayed",
    delayMs: 40,
  });
  await assert.rejects(
    agentFor(provider, { timeoutMs: 5 }).chooseDecision(context()),
    expectDecisionError("provider_timeout"),
  );
});

test("duplicate provider action IDs are rejected across decisions", async () => {
  const provider = new MockDecisionProvider<TestAction, TestObservation>({ mode: "duplicate" });
  const agent = agentFor(provider);
  await agent.chooseDecision(context());
  await assert.rejects(
    agent.chooseDecision(context({ revision: 4 })),
    expectDecisionError("duplicate_action_id"),
  );
});

test("documented deterministic fallback handles provider failure", async () => {
  const fallback: AgentPlayer<TestAction, TestObservation> = {
    agentId: "theo",
    async chooseAction() {
      return legalActions[1]!;
    },
  };
  const provider = new MockDecisionProvider<TestAction, TestObservation>({ mode: "malformed" });
  const decision = await agentFor(provider, { fallback }).chooseDecision(context());

  assert.deepEqual(decision.action, legalActions[1]);
  assert.equal(decision.actionId, "theo:fallback:fallback-1");
});

test("provider-backed agents require authoritative match context", async () => {
  const provider = new MockDecisionProvider<TestAction, TestObservation>();
  await assert.rejects(
    agentFor(provider).chooseDecision({
      observation: { label: "missing" },
      legalActions,
    }),
    expectDecisionError("missing_context"),
  );
});

test("tic-tac-toe service commits a provider-supplied structured action", async () => {
  const provider = new MockDecisionProvider<TicTacToeAction, TicTacToeObservation>();
  const theo = new ProviderBackedAgentPlayer<TicTacToeAction, TicTacToeObservation>({
    agentId: "theo",
    gameId: ticTacToeDefinition.gameId,
    provider,
    isSameAction: ticTacToeDefinition.isSameAction.bind(ticTacToeDefinition),
    requestIdGenerator: () => "tic-request-1",
  });
  const service = new TicTacToeMatchService({
    store: new InMemoryMatchSnapshotStore<TicTacToeState, TicTacToeAction>(),
    idGenerator: () => "generated-id",
    theo,
  });

  await service.createMatch(["human", "theo"], "provider-match");
  const view = await service.submitAction({
    matchId: "provider-match",
    playerId: "human",
    actionId: "human:1",
    expectedRevision: 0,
    action: { type: "place", cell: 4 },
  });
  const snapshot = await service.snapshot("provider-match");

  assert.equal(view.revision, 2);
  assert.equal(provider.requests.length, 1);
  assert.equal(provider.requests[0]!.matchId, "provider-match");
  assert.equal(provider.requests[0]!.expectedRevision, 1);
  assert.match(JSON.stringify(snapshot.events), /mock:1/);
});
