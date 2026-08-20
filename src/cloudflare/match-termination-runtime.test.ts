import assert from "node:assert/strict";
import test from "node:test";
import { GameFrameMatchObjectRuntime } from "./match-object-runtime.ts";
import type { DurableStorageLike } from "./runtime-contracts.ts";

class MemoryStorage implements DurableStorageLike {
  readonly values = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    const value = this.values.get(key);
    return value === undefined ? undefined : structuredClone(value) as T;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.values.set(key, structuredClone(value));
  }
}

function post(path: string, body: unknown) {
  return new Request(`https://match.internal${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("a seated player can resign and the match becomes terminal for every viewer", async () => {
  const runtime = new GameFrameMatchObjectRuntime(new MemoryStorage(), () => "action-id");
  const initialized = await runtime.fetch(post("/initialize", {
    matchId: "match-resign",
    gameId: "tic-tac-toe",
    playerIds: ["alice", "bob"],
  }));
  assert.equal(initialized.status, 201);

  const resigned = await runtime.fetch(post("/resign", {
    matchId: "match-resign",
    playerId: "alice",
  }));
  assert.equal(resigned.status, 200);
  const resignedView = await resigned.json() as any;
  assert.equal(resignedView.observation.status.lifecycle, "completed");
  assert.equal(resignedView.observation.status.winnerPlayerId, "bob");
  assert.equal(resignedView.observation.status.draw, false);
  assert.equal(resignedView.observation.status.termination, "resignation");
  assert.equal(resignedView.observation.status.resignedPlayerId, "alice");
  assert.deepEqual(resignedView.observation.legalActions, []);

  const bobViewResponse = await runtime.fetch(new Request(
    "https://match.internal/view?matchId=match-resign&playerId=bob",
  ));
  assert.equal(bobViewResponse.status, 200);
  const bobView = await bobViewResponse.json() as any;
  assert.equal(bobView.observation.status.lifecycle, "completed");
  assert.equal(bobView.observation.status.winnerPlayerId, "bob");

  const actionAfterResign = await runtime.fetch(post("/actions", {
    matchId: "match-resign",
    playerId: "bob",
    actionId: "bob-after-resign",
    expectedRevision: 0,
    action: { type: "place", cell: 4 },
  }));
  assert.equal(actionAfterResign.status, 409);
  assert.equal((await actionAfterResign.json() as any).error, "match_completed");

  const secondResign = await runtime.fetch(post("/resign", {
    matchId: "match-resign",
    playerId: "bob",
  }));
  assert.equal(secondResign.status, 409);
});

test("non-seated players cannot resign a match", async () => {
  const runtime = new GameFrameMatchObjectRuntime(new MemoryStorage());
  await runtime.fetch(post("/initialize", {
    matchId: "match-seat-authz",
    gameId: "tic-tac-toe",
    playerIds: ["alice", "bob"],
  }));

  const response = await runtime.fetch(post("/resign", {
    matchId: "match-seat-authz",
    playerId: "mallory",
  }));
  assert.equal(response.status, 403);
  assert.equal((await response.json() as any).error, "forbidden");
});

test("admin void makes an active match terminal without awarding a winner", async () => {
  const runtime = new GameFrameMatchObjectRuntime(new MemoryStorage());
  await runtime.fetch(post("/initialize", {
    matchId: "match-void",
    gameId: "tic-tac-toe",
    playerIds: ["alice", "bob"],
  }));

  const voided = await runtime.fetch(post("/admin/void", { matchId: "match-void" }));
  assert.equal(voided.status, 200);
  const view = await voided.json() as any;
  assert.equal(view.observation.status.lifecycle, "completed");
  assert.equal(view.observation.status.winnerPlayerId, null);
  assert.equal(view.observation.status.draw, false);
  assert.equal(view.observation.status.termination, "void");
  assert.equal(view.observation.status.voided, true);
  assert.deepEqual(view.observation.legalActions, []);

  const actionAfterVoid = await runtime.fetch(post("/actions", {
    matchId: "match-void",
    playerId: "alice",
    actionId: "alice-after-void",
    expectedRevision: 0,
    action: { type: "place", cell: 0 },
  }));
  assert.equal(actionAfterVoid.status, 409);
  assert.equal((await actionAfterVoid.json() as any).error, "match_completed");
});
