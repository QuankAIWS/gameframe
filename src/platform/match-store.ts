import type { MatchSnapshot } from "./match-session.ts";

export interface MatchSnapshotStore<State, Action> {
  load(matchId: string): Promise<MatchSnapshot<State, Action> | null>;
  save(snapshot: MatchSnapshot<State, Action>): Promise<void>;
}

export class InMemoryMatchSnapshotStore<State, Action>
  implements MatchSnapshotStore<State, Action>
{
  readonly #snapshots = new Map<string, MatchSnapshot<State, Action>>();

  async load(matchId: string): Promise<MatchSnapshot<State, Action> | null> {
    const snapshot = this.#snapshots.get(matchId);
    return snapshot ? structuredClone(snapshot) : null;
  }

  async save(snapshot: MatchSnapshot<State, Action>): Promise<void> {
    this.#snapshots.set(snapshot.matchId, structuredClone(snapshot));
  }
}
