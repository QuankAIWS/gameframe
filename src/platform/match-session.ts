import type {
  ActionEnvelope,
  ActionResult,
  GameDefinition,
  MatchEvent,
  MatchId,
  PlayerId,
} from "./contracts.ts";

export interface MatchSnapshot<State> {
  matchId: MatchId;
  gameId: string;
  playerIds: readonly PlayerId[];
  revision: number;
  state: State;
  events: readonly MatchEvent<unknown>[];
}

export interface MatchSessionOptions<State, Action, Observation> {
  matchId: MatchId;
  definition: GameDefinition<State, Action, Observation>;
  playerIds: readonly PlayerId[];
  now?: () => Date;
}

export class MatchSession<State, Action, Observation> {
  readonly #matchId: MatchId;
  readonly #definition: GameDefinition<State, Action, Observation>;
  readonly #playerIds: readonly PlayerId[];
  readonly #initialState: State;
  readonly #now: () => Date;
  #state: State;
  #revision = 0;
  #events: MatchEvent<Action>[] = [];
  #processed = new Map<string, ActionResult<State>>();

  constructor(options: MatchSessionOptions<State, Action, Observation>) {
    this.#matchId = options.matchId;
    this.#definition = options.definition;
    this.#playerIds = [...options.playerIds];
    this.#initialState = this.#definition.createInitialState(this.#playerIds);
    this.#state = this.#definition.cloneState(this.#initialState);
    this.#now = options.now ?? (() => new Date());
  }

  get matchId(): MatchId {
    return this.#matchId;
  }

  get revision(): number {
    return this.#revision;
  }

  submit(envelope: ActionEnvelope<Action>): ActionResult<State> {
    const duplicate = this.#processed.get(envelope.actionId);
    if (duplicate) {
      if (duplicate.accepted) {
        return { ...duplicate, duplicate: true, state: this.#definition.cloneState(duplicate.state) };
      }
      return duplicate;
    }

    const rejection = this.#validate(envelope);
    if (rejection) {
      this.#processed.set(envelope.actionId, rejection);
      return rejection;
    }

    const transition = this.#definition.applyAction(
      this.#state,
      envelope.playerId,
      envelope.action,
    );
    this.#state = this.#definition.cloneState(transition.state);
    this.#revision += 1;

    const event: MatchEvent<Action> = {
      sequence: this.#events.length + 1,
      revision: this.#revision,
      actionId: envelope.actionId,
      playerId: envelope.playerId,
      action: structuredClone(envelope.action),
      summary: transition.summary,
      occurredAt: this.#now().toISOString(),
    };
    this.#events.push(event);

    const accepted: ActionResult<State> = {
      accepted: true,
      duplicate: false,
      revision: this.#revision,
      state: this.#definition.cloneState(this.#state),
      event: event as MatchEvent<unknown>,
    };
    this.#processed.set(envelope.actionId, accepted);
    return accepted;
  }

  observe(playerId: PlayerId): Observation {
    if (!this.#playerIds.includes(playerId)) {
      throw new Error(`Unknown player: ${playerId}`);
    }
    return this.#definition.getObservation(this.#state, playerId);
  }

  snapshot(): MatchSnapshot<State> {
    return {
      matchId: this.#matchId,
      gameId: this.#definition.gameId,
      playerIds: [...this.#playerIds],
      revision: this.#revision,
      state: this.#definition.cloneState(this.#state),
      events: structuredClone(this.#events),
    };
  }

  replay(): State {
    let replayed = this.#definition.cloneState(this.#initialState);
    for (const event of this.#events) {
      replayed = this.#definition.applyAction(
        replayed,
        event.playerId,
        event.action,
      ).state;
    }
    return this.#definition.cloneState(replayed);
  }

  #validate(envelope: ActionEnvelope<Action>): ActionResult<State> | null {
    if (!this.#playerIds.includes(envelope.playerId)) {
      return this.#reject("unknown_player", `Player ${envelope.playerId} is not in this match.`);
    }

    if (this.#definition.getStatus(this.#state).lifecycle === "completed") {
      return this.#reject("match_completed", "The match is already complete.");
    }

    if (envelope.expectedRevision !== this.#revision) {
      return this.#reject(
        "stale_revision",
        `Expected revision ${this.#revision}, received ${envelope.expectedRevision}.`,
      );
    }

    if (this.#definition.getActivePlayerId(this.#state) !== envelope.playerId) {
      return this.#reject("not_your_turn", "It is not this player's turn.");
    }

    const legalActions = this.#definition.listLegalActions(this.#state, envelope.playerId);
    if (!legalActions.some((candidate) => this.#definition.isSameAction(candidate, envelope.action))) {
      return this.#reject("illegal_action", "The requested action is not legal in the current state.");
    }

    return null;
  }

  #reject(code: "unknown_player" | "match_completed" | "not_your_turn" | "stale_revision" | "illegal_action", message: string): ActionResult<State> {
    return {
      accepted: false,
      duplicate: false,
      revision: this.#revision,
      code,
      message,
    };
  }
}
