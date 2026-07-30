import type {
  ActionEnvelope,
  ActionResult,
  GameDefinition,
  MatchEvent,
  MatchId,
  PlayerId,
  RejectedAction,
} from "./contracts.ts";

export interface PersistedRejectedAction {
  actionId: string;
  result: RejectedAction;
}

export interface MatchSnapshot<State, Action = unknown> {
  matchId: MatchId;
  gameId: string;
  playerIds: readonly PlayerId[];
  revision: number;
  initialState?: State;
  state: State;
  events: readonly MatchEvent<Action>[];
  rejectedActions?: readonly PersistedRejectedAction[];
}

export interface MatchSessionOptions<State, Action, Observation> {
  matchId: MatchId;
  definition: GameDefinition<State, Action, Observation>;
  playerIds: readonly PlayerId[];
  snapshot?: MatchSnapshot<State, Action>;
  now?: () => Date;
}

export class MatchSession<State, Action, Observation> {
  readonly #matchId: MatchId;
  readonly #definition: GameDefinition<State, Action, Observation>;
  readonly #playerIds: readonly PlayerId[];
  #initialState: State;
  readonly #now: () => Date;
  #state: State;
  #revision = 0;
  #events: MatchEvent<Action>[] = [];
  #rejected = new Map<string, RejectedAction>();

  constructor(options: MatchSessionOptions<State, Action, Observation>) {
    this.#matchId = options.matchId;
    this.#definition = options.definition;
    this.#playerIds = [...options.playerIds];
    this.#initialState = this.#definition.createInitialState(this.#playerIds);
    this.#state = this.#definition.cloneState(this.#initialState);
    this.#now = options.now ?? (() => new Date());

    if (options.snapshot) {
      this.#restore(options.snapshot);
    }
  }

  get matchId(): MatchId {
    return this.#matchId;
  }

  get revision(): number {
    return this.#revision;
  }

  submit(envelope: ActionEnvelope<Action>): ActionResult<State> {
    const acceptedEvent = this.#events.find((event) => event.actionId === envelope.actionId);
    if (acceptedEvent) {
      return {
        accepted: true,
        duplicate: true,
        revision: acceptedEvent.revision,
        state: this.#stateAtRevision(acceptedEvent.revision),
        event: structuredClone(acceptedEvent) as MatchEvent<unknown>,
      };
    }

    const rejected = this.#rejected.get(envelope.actionId);
    if (rejected) {
      return structuredClone(rejected);
    }

    const rejection = this.#validate(envelope);
    if (rejection) {
      this.#rejected.set(envelope.actionId, rejection);
      return structuredClone(rejection);
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

    return {
      accepted: true,
      duplicate: false,
      revision: this.#revision,
      state: this.#definition.cloneState(this.#state),
      event: structuredClone(event) as MatchEvent<unknown>,
    };
  }

  observe(playerId: PlayerId): Observation {
    if (!this.#playerIds.includes(playerId)) {
      throw new Error(`Unknown player: ${playerId}`);
    }
    return this.#definition.getObservation(this.#state, playerId);
  }

  snapshot(): MatchSnapshot<State, Action> {
    return {
      matchId: this.#matchId,
      gameId: this.#definition.gameId,
      playerIds: [...this.#playerIds],
      revision: this.#revision,
      initialState: this.#definition.cloneState(this.#initialState),
      state: this.#definition.cloneState(this.#state),
      events: structuredClone(this.#events),
      rejectedActions: [...this.#rejected.entries()].map(([actionId, result]) => ({
        actionId,
        result: structuredClone(result),
      })),
    };
  }

  replay(): State {
    return this.#stateAtRevision(this.#revision);
  }

  #restore(snapshot: MatchSnapshot<State, Action>): void {
    if (snapshot.matchId !== this.#matchId) {
      throw new Error("Snapshot match ID does not match the requested session.");
    }
    if (snapshot.gameId !== this.#definition.gameId) {
      throw new Error("Snapshot game ID does not match the selected game definition.");
    }
    if (snapshot.playerIds.length !== this.#playerIds.length ||
      snapshot.playerIds.some((playerId, index) => playerId !== this.#playerIds[index])) {
      throw new Error("Snapshot player order does not match the requested session.");
    }

    const events = structuredClone(snapshot.events) as MatchEvent<Action>[];
    for (const [index, event] of events.entries()) {
      const expected = index + 1;
      if (event.sequence !== expected || event.revision !== expected) {
        throw new Error(`Snapshot event ${expected} has an invalid sequence or revision.`);
      }
    }
    if (snapshot.revision !== events.length) {
      throw new Error("Snapshot revision does not match its event history.");
    }

    if (snapshot.initialState !== undefined) {
      this.#initialState = this.#definition.cloneState(snapshot.initialState);
    } else if (snapshot.revision === 0 && events.length === 0) {
      // A revision-zero snapshot may intentionally seed a configured scenario instead of
      // using the game definition's ordinary default setup. Persist that setup as the
      // replay origin so later snapshots can reconstruct the exact encounter.
      this.#initialState = this.#definition.cloneState(snapshot.state);
    }

    this.#events = events;
    this.#revision = snapshot.revision;
    this.#state = this.#stateAtRevision(this.#revision);
    this.#rejected = new Map(
      (snapshot.rejectedActions ?? []).map(({ actionId, result }) => [actionId, structuredClone(result)]),
    );
  }

  #stateAtRevision(revision: number): State {
    let replayed = this.#definition.cloneState(this.#initialState);
    for (const event of this.#events) {
      if (event.revision > revision) break;
      replayed = this.#definition.applyAction(
        replayed,
        event.playerId,
        event.action,
      ).state;
    }
    return this.#definition.cloneState(replayed);
  }

  #validate(envelope: ActionEnvelope<Action>): RejectedAction | null {
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

  #reject(code: RejectedAction["code"], message: string): RejectedAction {
    return {
      accepted: false,
      duplicate: false,
      revision: this.#revision,
      code,
      message,
    };
  }
}
