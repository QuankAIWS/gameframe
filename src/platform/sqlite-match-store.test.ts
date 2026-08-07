import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { MatchSnapshot } from "./match-session.ts";
import { SqliteMatchSnapshotStore } from "./sqlite-match-store.ts";

const directories: string[] = [];

test.afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-sqlite-match-store-"));
  directories.push(directory);
  return join(directory, "gameframe.sqlite");
}

type State = { turn: string; value: number };
type Action = { type: "advance"; amount: number };

function snapshot(revision = 1): MatchSnapshot<State, Action> {
  const events = revision === 0
    ? []
    : [{
        sequence: 1,
        revision: 1,
        actionId: "action-one",
        playerId: "player:ada",
        action: { type: "advance", amount: 1 } as const,
        summary: "advanced",
        occurredAt: "2026-08-07T13:20:00.000Z",
      }];
  return {
    matchId: "rpg:encounter-one",
    gameId: "monster-master-duel",
    playerIds: ["rpg-team:encounter-one", "gameframe-bot"],
    revision,
    initialState: { turn: "player:ada", value: 0 },
    state: { turn: "gameframe-bot", value: revision },
    events,
    rejectedActions: [],
  };
}

test("persists and restores an exact match snapshot across store restart", async () => {
  const filePath = databasePath();
  const first = new SqliteMatchSnapshotStore<State, Action>({
    filePath,
    clock: () => "2026-08-07T13:20:00.000Z",
  });
  await first.save(snapshot());
  first.close();

  const second = new SqliteMatchSnapshotStore<State, Action>({ filePath });
  assert.deepEqual(await second.load("rpg:encounter-one"), snapshot());
  const advanced = snapshot();
  advanced.state = { turn: "rpg-team:encounter-one", value: 2 };
  await second.save(advanced);
  second.close();

  const third = new SqliteMatchSnapshotStore<State, Action>({ filePath });
  assert.deepEqual((await third.load("rpg:encounter-one"))?.state, {
    turn: "rpg-team:encounter-one",
    value: 2,
  });
  assert.equal(await third.load("rpg:missing"), null);
  third.close();
});
