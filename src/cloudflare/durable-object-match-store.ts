import type { MatchSnapshot } from "../platform/match-session.ts";
import type { MatchSnapshotStore } from "../platform/match-store.ts";
import type { DurableStorageLike } from "./runtime-contracts.ts";

export const MATCH_SNAPSHOT_KEY = "match-snapshot";

export class DurableObjectMatchStore<State, Action>
  implements MatchSnapshotStore<State, Action>
{
  readonly #storage: DurableStorageLike;

  constructor(storage: DurableStorageLike) {
    this.#storage = storage;
  }

  async load(matchId: string): Promise<MatchSnapshot<State, Action> | null> {
    const snapshot = await this.#storage.get<MatchSnapshot<State, Action>>(MATCH_SNAPSHOT_KEY);
    if (!snapshot) return null;
    if (snapshot.matchId !== matchId) {
      throw new Error(`Durable Object contains ${snapshot.matchId}, not ${matchId}.`);
    }
    return structuredClone(snapshot);
  }

  async save(snapshot: MatchSnapshot<State, Action>): Promise<void> {
    await this.#storage.put(MATCH_SNAPSHOT_KEY, structuredClone(snapshot));
  }
}
