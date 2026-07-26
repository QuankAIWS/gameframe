import type { TicTacToeAction, TicTacToeState } from "../games/tic-tac-toe/index.ts";
import type { MatchSnapshot } from "../platform/match-session.ts";
import type { MatchSnapshotStore } from "../platform/match-store.ts";
import type { DurableStorageLike } from "./runtime-contracts.ts";

const SNAPSHOT_KEY = "match-snapshot";

export class DurableObjectMatchStore
  implements MatchSnapshotStore<TicTacToeState, TicTacToeAction>
{
  readonly #storage: DurableStorageLike;

  constructor(storage: DurableStorageLike) {
    this.#storage = storage;
  }

  async load(matchId: string): Promise<MatchSnapshot<TicTacToeState, TicTacToeAction> | null> {
    const snapshot = await this.#storage.get<MatchSnapshot<TicTacToeState, TicTacToeAction>>(SNAPSHOT_KEY);
    if (!snapshot) return null;
    if (snapshot.matchId !== matchId) {
      throw new Error(`Durable Object contains ${snapshot.matchId}, not ${matchId}.`);
    }
    return structuredClone(snapshot);
  }

  async save(snapshot: MatchSnapshot<TicTacToeState, TicTacToeAction>): Promise<void> {
    await this.#storage.put(SNAPSHOT_KEY, structuredClone(snapshot));
  }
}
