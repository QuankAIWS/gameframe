import { randomUUID } from "node:crypto";
import { PerfectTicTacToePlayer, ticTacToeDefinition, type TicTacToeAction, type TicTacToeObservation, type TicTacToeState } from "../games/tic-tac-toe/index.ts";
import { MatchSession, type MatchSnapshot } from "../platform/match-session.ts";

export interface PublicMatchView {
  matchId: string;
  revision: number;
  observation: TicTacToeObservation;
  eventCount: number;
}

export class InMemoryTicTacToeService {
  readonly #matches = new Map<string, MatchSession<TicTacToeState, TicTacToeAction, TicTacToeObservation>>();
  readonly #theo = new PerfectTicTacToePlayer("theo");

  createHumanVsTheo(humanPlayerId: string): PublicMatchView {
    if (!humanPlayerId || humanPlayerId === "theo") {
      throw new Error("A distinct human player ID is required.");
    }
    const matchId = randomUUID();
    const session = new MatchSession({
      matchId,
      definition: ticTacToeDefinition,
      playerIds: [humanPlayerId, "theo"],
    });
    this.#matches.set(matchId, session);
    return this.view(matchId, humanPlayerId);
  }

  view(matchId: string, playerId: string): PublicMatchView {
    const session = this.#requireMatch(matchId);
    return {
      matchId,
      revision: session.revision,
      observation: session.observe(playerId),
      eventCount: session.snapshot().events.length,
    };
  }

  async submitHumanAction(input: {
    matchId: string;
    playerId: string;
    actionId: string;
    expectedRevision: number;
    action: TicTacToeAction;
  }): Promise<PublicMatchView> {
    const session = this.#requireMatch(input.matchId);
    const result = session.submit({
      actionId: input.actionId,
      playerId: input.playerId,
      expectedRevision: input.expectedRevision,
      action: input.action,
    });
    if (!result.accepted) {
      const error = new Error(result.message);
      Object.assign(error, { code: result.code, revision: result.revision });
      throw error;
    }

    const theoObservation = session.observe("theo");
    if (theoObservation.status.lifecycle === "active" && theoObservation.nextPlayerId === "theo") {
      const action = await this.#theo.chooseAction({
        observation: theoObservation,
        legalActions: theoObservation.legalActions,
      });
      session.submit({
        actionId: `theo:${randomUUID()}`,
        playerId: "theo",
        expectedRevision: session.revision,
        action,
      });
    }

    return this.view(input.matchId, input.playerId);
  }

  snapshot(matchId: string): MatchSnapshot<TicTacToeState> {
    return this.#requireMatch(matchId).snapshot();
  }

  replay(matchId: string): TicTacToeState {
    return this.#requireMatch(matchId).replay();
  }

  #requireMatch(matchId: string): MatchSession<TicTacToeState, TicTacToeAction, TicTacToeObservation> {
    const session = this.#matches.get(matchId);
    if (!session) {
      throw new Error(`Unknown match: ${matchId}`);
    }
    return session;
  }
}
