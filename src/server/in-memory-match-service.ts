import type { TicTacToeAction, TicTacToeState } from "../games/tic-tac-toe/index.ts";
import { InMemoryMatchSnapshotStore } from "../platform/match-store.ts";
import { TicTacToeMatchService, type PublicMatchView } from "./tic-tac-toe-match-service.ts";

export type { PublicMatchView };

export class InMemoryTicTacToeService extends TicTacToeMatchService {
  constructor() {
    super({
      store: new InMemoryMatchSnapshotStore<TicTacToeState, TicTacToeAction>(),
    });
  }
}
